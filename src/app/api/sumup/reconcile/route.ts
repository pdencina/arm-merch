import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTrackingEmail } from '@/lib/tracking-email'

/**
 * Reconciliación automática de órdenes SumUp Solo pendientes.
 * Se ejecuta cada 2 minutos via Vercel Cron.
 * Busca órdenes en estado 'pending' con payment_method 'solo'
 * y verifica contra el historial de transacciones de SumUp.
 */

const CRON_SECRET = 'arm-merch-cron-2026'

const PAID_STATUSES = [
  'PAID', 'PAID_OUT', 'SUCCESS', 'SUCCESSFUL', 'APPROVED',
  'COMPLETED', 'COMPLETE', 'FINISHED', 'CHECKOUT_FINISHED',
  'ACCEPTED', 'AUTHORISED', 'AUTHORIZED',
]

function normalize(value: unknown) {
  return String(value ?? '').trim().toUpperCase()
}

function getTxStatus(tx: any) {
  return normalize(
    tx?.status ?? tx?.transaction_status ?? tx?.state ?? tx?.payment_status ??
    tx?.checkout_status ?? tx?.transactions?.[0]?.status ?? tx?.transaction?.status
  )
}

function getTxAmount(tx: any) {
  const value = tx?.amount ?? tx?.total_amount?.value ?? tx?.transaction_amount ??
    tx?.gross_amount ?? tx?.transactions?.[0]?.amount ?? tx?.transaction?.amount
  const parsed = Number(value ?? 0)
  const minorUnit = Number(tx?.total_amount?.minor_unit ?? tx?.transactions?.[0]?.total_amount?.minor_unit ?? 0)
  if (parsed > 1000 && minorUnit === 2) return Math.round(parsed / 100)
  return Math.round(parsed)
}

function getTxReference(tx: any) {
  return String(
    tx?.checkout_reference ?? tx?.reference ?? tx?.foreign_transaction_id ??
    tx?.client_transaction_id ?? tx?.transaction_id ?? tx?.id ??
    tx?.transaction_code ?? tx?.transactions?.[0]?.transaction_code ??
    tx?.description ?? ''
  )
}

function getTransactionArray(payload: any): any[] {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.transactions)) return payload.transactions
  if (Array.isArray(payload?.data)) return payload.data
  if (payload?.id || payload?.transaction_id || payload?.status) return [payload]
  return []
}

export async function GET(req: NextRequest) {
  try {
    const secret = req.nextUrl.searchParams.get('secret')
    if (secret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const sumupApiKey = process.env.SUMUP_API_KEY!
    const sumupApiBase = process.env.SUMUP_API_BASE || 'https://api.sumup.com'

    if (!supabaseUrl || !serviceRoleKey || !sumupApiKey) {
      return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Buscar órdenes SumUp Solo pendientes (últimas 2 horas)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

    const { data: pendingOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, total, notes, campus_id, status, created_at, order_items(product_id, quantity, unit_price, size, fulfillment_type)')
      .eq('status', 'pending')
      .eq('payment_method', 'solo')
      .gte('created_at', twoHoursAgo)
      .order('created_at', { ascending: false })
      .limit(20)

    if (ordersError || !pendingOrders || pendingOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending SOLO orders to reconcile',
        checked: 0,
      })
    }

    // Obtener transacciones recientes de SumUp
    const historyUrl = `${sumupApiBase}/v0.1/me/transactions/history?limit=50&order=descending`
    const historyRes = await fetch(historyUrl, {
      headers: { Authorization: `Bearer ${sumupApiKey}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
    })

    let transactions: any[] = []
    if (historyRes.ok) {
      const payload = await historyRes.json().catch(() => ({}))
      transactions = getTransactionArray(payload)
    }

    let reconciled = 0
    const results: any[] = []

    for (const order of pendingOrders) {
      const expectedAmount = Math.round(Number(order.total ?? 0))

      // Buscar transacción que coincida con esta orden
      const match = transactions.find((tx) => {
        const status = getTxStatus(tx)
        const txReference = getTxReference(tx)
        const txAmount = getTxAmount(tx)

        const referenceMatches =
          txReference.includes(String(order.order_number)) ||
          String(tx?.product_summary ?? '').includes(`#${order.order_number}`) ||
          String(tx?.description ?? '').includes(String(order.order_number))

        const amountMatches = expectedAmount > 0 && Math.abs(txAmount - expectedAmount) <= 1

        return PAID_STATUSES.includes(status) && (referenceMatches || amountMatches)
      })

      if (match) {
        const transactionCode = match?.transaction_code ?? match?.id ?? null

        // Marcar como pagada
        await supabase.from('orders').update({
          status: 'paid',
          notes: [
            order.notes ?? '',
            `[Reconciliado automáticamente]`,
            `TX: ${transactionCode ?? 'N/A'}`,
          ].filter(Boolean).join(' | '),
          updated_at: new Date().toISOString(),
        }).eq('id', order.id)

        // Historial de estado
        await supabase.from('order_status_history').insert({
          order_id: order.id,
          status: 'payment_confirmed',
          title: 'Pago confirmado (reconciliación)',
          message: 'Pago confirmado automáticamente por el sistema de reconciliación.',
          created_at: new Date().toISOString(),
        })

        // Descontar stock de items inmediatos
        for (const item of order.order_items ?? []) {
          if (item.fulfillment_type === 'production') continue

          await supabase.from('inventory_movements').insert({
            product_id: item.product_id,
            campus_id: order.campus_id,
            type: 'salida',
            quantity: item.quantity,
            notes: `Reconciliación SOLO - Orden #${order.order_number}`,
          })
        }

        // Registrar pago
        await supabase.from('order_payments').insert({
          order_id: order.id,
          amount: expectedAmount,
          payment_method: 'solo',
          payment_type: 'full_payment',
          notes: `Reconciliado automáticamente — TX: ${transactionCode ?? 'N/A'}`,
        })

        // Enviar email de confirmación
        await sendTrackingEmail({
          orderId: order.id,
          status: 'purchase_confirmed',
          appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://armerch.com',
        }).catch(() => null)

        reconciled++
        results.push({ order_number: order.order_number, status: 'reconciled', tx: transactionCode })
      } else {
        results.push({ order_number: order.order_number, status: 'still_pending' })
      }
    }

    return NextResponse.json({
      success: true,
      checked: pendingOrders.length,
      reconciled,
      results,
    })
  } catch (error: any) {
    console.error('[SumUp Reconcile] Error:', error)
    return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 })
  }
}
