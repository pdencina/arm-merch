import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTrackingEmail } from '@/lib/tracking-email'

const PAID_STATUSES = ['PAID', 'SUCCESSFUL', 'SUCCESS', 'COMPLETED', 'APPROVED']
const FAILED_STATUSES = [
  'FAILED',
  'DECLINED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
  'CANCELED',
  'CANCELLED_BY_USER',
  'CANCELED_BY_USER',
]

function normalizeStatus(value: unknown) {
  return String(value ?? '').trim().toUpperCase()
}

function appendNotes(current: string | null | undefined, ...parts: Array<string | null | undefined>) {
  return [current ?? '', ...parts]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' | ')
}

function getMostRelevantTransaction(checkout: any) {
  const transactions = Array.isArray(checkout?.transactions)
    ? checkout.transactions
    : Array.isArray(checkout?.transaction)
      ? checkout.transaction
      : []

  return transactions?.[0] ?? null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const checkoutReference = String(body?.checkout_reference ?? '').trim()

    if (!checkoutReference) {
      return NextResponse.json(
        { ok: false, error: 'checkout_reference es requerido' },
        { status: 400 },
      )
    }

    const apiKey = process.env.SUMUP_API_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const sumupApiBase = process.env.SUMUP_API_BASE || 'https://api.sumup.com'

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: 'SUMUP_API_KEY no configurada' },
        { status: 500 },
      )
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { ok: false, error: 'Supabase admin env no configurada' },
        { status: 500 },
      )
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select(`
        id,
        order_number,
        campus_id,
        status,
        notes,
        sumup_checkout_id,
        order_items(product_id, quantity, size, fulfillment_type)
      `)
      .ilike('notes', `%${checkoutReference}%`)
      .maybeSingle()

    if (orderError) {
      console.error('[SumUp Confirm By Reference] Order query error:', orderError)
      return NextResponse.json(
        { ok: false, error: 'order_query_error' },
        { status: 500 },
      )
    }

    if (!order) {
      return NextResponse.json(
        {
          ok: true,
          action: 'pending',
          order_status: 'pending',
          sumup_status: 'ORDER_NOT_FOUND',
        },
        { status: 200 },
      )
    }

    if (order.status === 'paid' || order.status === 'cancelled') {
      return NextResponse.json({
        ok: true,
        action: 'already_processed',
        order_status: order.status,
        status: order.status,
        order_number: order.order_number,
      })
    }

    const checkoutId = order.sumup_checkout_id || checkoutReference

    const checkoutRes = await fetch(
      `${sumupApiBase}/v0.1/checkouts/${encodeURIComponent(checkoutId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
    )

    const checkoutText = await checkoutRes.text()
    let checkout: any = {}

    try {
      checkout = JSON.parse(checkoutText)
    } catch {
      checkout = { raw: checkoutText }
    }

    console.log('[SumUp Confirm By Reference] Checkout status:', checkoutRes.status)
    console.log('[SumUp Confirm By Reference] Checkout response:', JSON.stringify(checkout))

    if (!checkoutRes.ok) {
      return NextResponse.json(
        {
          ok: true,
          action: 'pending',
          order_status: 'pending',
          sumup_status: null,
          order_number: order.order_number,
          detail: checkout,
        },
        { status: 200 },
      )
    }

    const checkoutStatus = normalizeStatus(checkout?.status)
    const transaction = getMostRelevantTransaction(checkout)
    const transactionStatus = normalizeStatus(transaction?.status)
    const resolvedStatus = checkoutStatus || transactionStatus
    const transactionCode =
      transaction?.transaction_code ??
      transaction?.id ??
      checkout?.transaction_code ??
      checkout?.transaction_id ??
      ''

    const isPaid =
      PAID_STATUSES.includes(checkoutStatus) ||
      PAID_STATUSES.includes(transactionStatus) ||
      PAID_STATUSES.includes(resolvedStatus)

    const isFailed =
      FAILED_STATUSES.includes(checkoutStatus) ||
      FAILED_STATUSES.includes(transactionStatus) ||
      FAILED_STATUSES.includes(resolvedStatus)

    if (isPaid) {
      const { error: updateError } = await adminClient
        .from('orders')
        .update({
          status: 'paid',
          notes: appendNotes(
            order.notes,
            'Pagado vía SumUp Wallet/Link',
            `Ref: ${checkoutReference}`,
            `TXN: ${transactionCode || 'N/A'}`,
            `Estado: ${resolvedStatus || 'PAID'}`,
          ),
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      if (updateError) {
        console.error('[SumUp Confirm By Reference] Paid update error:', updateError)
        return NextResponse.json(
          { ok: false, error: 'paid_update_error' },
          { status: 500 },
        )
      }

      await adminClient.from('order_status_history').insert({
        order_id: order.id,
        status: 'payment_confirmed',
        title: 'Pago confirmado',
        message: 'El pago fue confirmado correctamente por SumUp Wallet/Link.',
        created_at: new Date().toISOString(),
      }).then(() => null)

      for (const item of order.order_items ?? []) {
        if (item.fulfillment_type === 'production') continue

        const { error: movementError } = await adminClient
          .from('inventory_movements')
          .insert({
            product_id: item.product_id,
            campus_id: order.campus_id,
            type: 'salida',
            quantity: item.quantity,
            notes: `Pago link SumUp - Orden #${order.order_number} - TXN ${transactionCode || 'N/A'}`,
          })

        if (movementError) {
          console.error('[SumUp Confirm By Reference] Inventory movement error:', movementError)
        }
      }

      const emailResult = await sendTrackingEmail({
        orderId: order.id,
        status: 'purchase_confirmed',
        appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://armerch.com',
      }).catch((error) => {
        console.error('[SumUp Confirm By Reference] Tracking email error:', error)
        return { sent: false, error: String(error) }
      })

      return NextResponse.json({
        ok: true,
        action: 'paid',
        status: 'paid',
        order_status: 'paid',
        order_number: order.order_number,
        sumup_status: resolvedStatus,
        email_sent: Boolean(emailResult?.sent),
      })
    }

    if (isFailed) {
      const { error: cancelError } = await adminClient
        .from('orders')
        .update({
          status: 'cancelled',
          notes: appendNotes(
            order.notes,
            `Pago ${String(resolvedStatus || 'cancelled').toLowerCase()} vía SumUp Wallet/Link`,
            `Ref: ${checkoutReference}`,
          ),
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      if (cancelError) {
        console.error('[SumUp Confirm By Reference] Cancel update error:', cancelError)
        return NextResponse.json(
          { ok: false, error: 'cancel_update_error' },
          { status: 500 },
        )
      }

      return NextResponse.json({
        ok: true,
        action: 'cancelled',
        status: 'cancelled',
        order_status: 'cancelled',
        order_number: order.order_number,
        sumup_status: resolvedStatus,
      })
    }

    return NextResponse.json({
      ok: true,
      action: 'pending',
      status: 'pending',
      order_status: 'pending',
      order_number: order.order_number,
      sumup_status: resolvedStatus || 'PENDING',
    })
  } catch (error: any) {
    console.error('[SumUp Confirm By Reference] Error:', error)

    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? 'Error interno',
      },
      { status: 500 },
    )
  }
}
