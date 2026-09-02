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

    // Buscar órdenes SumUp Solo pendientes O canceladas (últimas 2 horas)
    // Incluye canceladas porque el timeout del frontend puede cancelarlas
    // antes de que SumUp confirme el pago.
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

    const { data: pendingOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, total, notes, campus_id, status, created_at, order_items(product_id, quantity, unit_price, size, fulfillment_type)')
      .eq('payment_method', 'solo')
      .in('status', ['pending', 'cancelled'])
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
    const usedTransactions = new Set<string>() // Evitar que una TX matchee múltiples órdenes

    for (const order of pendingOrders) {
      const expectedAmount = Math.round(Number(order.total ?? 0))

      // Extraer referencia de la orden desde notes
      const orderRef = String(order.notes ?? '')
      const refMatch = orderRef.match(/arm-merch-order-\d+-\d+/)
      const orderReference = refMatch?.[0] ?? null

      // Candidatos: transacciones pagadas con el monto esperado y no usadas aún.
      const candidates = transactions.filter((tx) => {
        const txId = String(tx?.transaction_code ?? tx?.id ?? tx?.client_transaction_id ?? '')
        if (usedTransactions.has(txId)) return false // Ya usada para otra orden

        const status = getTxStatus(tx)
        if (!PAID_STATUSES.includes(status)) return false

        const txAmount = getTxAmount(tx)
        return expectedAmount > 0 && Math.abs(txAmount - expectedAmount) <= 1
      })

      // Pasada 1: match por referencia (confiable).
      let match = candidates.find((tx) => {
        const txReference = getTxReference(tx)

        return (
          (orderReference && txReference.includes(orderReference)) ||
          txReference.includes(`order-${order.order_number}-`) ||
          String(tx?.description ?? '').includes(`#${order.order_number}`)
        )
      })

      // Pasada 2 (fallback): SumUp no siempre expone la referencia en el historial.
      // Aceptamos match por monto solo si esa TX no está ya asociada a otra orden pagada.
      if (!match) {
        for (const tx of candidates) {
          const txId = String(tx?.transaction_code ?? tx?.id ?? tx?.client_transaction_id ?? '')
          if (!txId) continue

          const { data: alreadyUsed } = await supabase
            .from('orders')
            .select('id')
            .ilike('notes', `%TX: ${txId}%`)
            .neq('id', order.id)
            .limit(1)

          if (!alreadyUsed || alreadyUsed.length === 0) {
            match = tx
            break
          }
        }
      }

      if (match) {
        const txId = String(match?.transaction_code ?? match?.id ?? match?.client_transaction_id ?? '')
        usedTransactions.add(txId)
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
