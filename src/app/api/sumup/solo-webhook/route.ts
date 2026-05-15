import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PAID_STATUSES = ['PAID', 'SUCCESSFUL', 'SUCCESS', 'COMPLETED', 'APPROVED']
const FAILED_STATUSES = ['FAILED', 'EXPIRED', 'CANCELLED', 'CANCELED', 'DECLINED', 'REJECTED']

function normalize(value: unknown) {
  return String(value ?? '').trim().toUpperCase()
}

function getEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
}

function getStatus(body: any) {
  return normalize(
    body?.status ||
      body?.transaction_status ||
      body?.event_status ||
      body?.checkout_status ||
      body?.data?.status ||
      body?.data?.transaction_status,
  )
}

function getOrderId(req: NextRequest, body: any) {
  const fromQuery = req.nextUrl.searchParams.get('order_id')
  if (fromQuery) return fromQuery

  return (
    body?.order_id ||
    body?.affiliate?.tags?.order_id ||
    body?.affiliate?.foreign_transaction_id?.replace(/^arm-order-/, '') ||
    body?.data?.affiliate?.tags?.order_id ||
    body?.data?.affiliate?.foreign_transaction_id?.replace(/^arm-order-/, '') ||
    null
  )
}

async function handle(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    console.log('[SOLO Webhook] Received:', JSON.stringify(body))

    const orderId = getOrderId(req, body)
    const status = getStatus(body)
    const transactionCode =
      body?.transaction_code ||
      body?.transaction_id ||
      body?.id ||
      body?.data?.transaction_code ||
      body?.data?.id ||
      ''

    if (!orderId) {
      return NextResponse.json({ received: true, action: 'missing_order_id' })
    }

    if (!status) {
      return NextResponse.json({ received: true, action: 'missing_status', order_id: orderId })
    }

    const { supabaseUrl, serviceRoleKey } = getEnv()

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ received: true, action: 'missing_supabase_env' })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, order_number, campus_id, status, total, production_status, order_items(product_id, quantity, size)')
      .eq('id', orderId)
      .maybeSingle()

    if (orderError) {
      console.error('[SOLO Webhook] Order error:', orderError)
      return NextResponse.json({ received: true, action: 'order_query_error' })
    }

    if (!order) {
      return NextResponse.json({ received: true, action: 'order_not_found', order_id: orderId })
    }

    if (order.status === 'paid' || order.status === 'cancelled') {
      return NextResponse.json({
        received: true,
        action: 'already_processed',
        order_number: order.order_number,
        status: order.status,
      })
    }

    if (PAID_STATUSES.includes(status)) {
      const { error: updateError } = await adminClient
        .from('orders')
        .update({
          status: 'paid',
          notes: `Pagado via SumUp SOLO | TXN: ${transactionCode || 'sin_tx'}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      if (updateError) {
        console.error('[SOLO Webhook] Paid update error:', updateError)
        return NextResponse.json({ received: true, action: 'paid_update_error' })
      }

      for (const item of order.order_items ?? []) {
        const { error: movementError } = await adminClient
          .from('inventory_movements')
          .insert({
            product_id: item.product_id,
            campus_id: order.campus_id,
            type: 'salida',
            quantity: item.quantity,
            notes: `Pago SumUp SOLO - Orden #${order.order_number} - TXN ${transactionCode || 'sin_tx'}`,
          })

        if (movementError) {
          console.error('[SOLO Webhook] Inventory movement error:', movementError)
        }
      }

      console.log('[SOLO Webhook] ✅ Order paid:', order.order_number)
      return NextResponse.json({ received: true, action: 'paid', order_number: order.order_number })
    }

    if (FAILED_STATUSES.includes(status)) {
      const { error: cancelError } = await adminClient
        .from('orders')
        .update({
          status: 'cancelled',
          notes: `Pago SumUp SOLO ${status.toLowerCase()} | TXN: ${transactionCode || 'sin_tx'}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      if (cancelError) {
        console.error('[SOLO Webhook] Cancel update error:', cancelError)
        return NextResponse.json({ received: true, action: 'cancel_update_error' })
      }

      return NextResponse.json({ received: true, action: 'cancelled', order_number: order.order_number })
    }

    return NextResponse.json({
      received: true,
      action: 'status_ignored',
      order_number: order.order_number,
      status,
    })
  } catch (error: any) {
    console.error('[SOLO Webhook] Error:', error)
    return NextResponse.json({ received: true, action: 'internal_error', error: error?.message })
  }
}

export async function POST(req: NextRequest) {
  return handle(req)
}

export async function GET(req: NextRequest) {
  return handle(req)
}
