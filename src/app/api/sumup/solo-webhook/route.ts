import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PAID_STATUSES = [
  'PAID',
  'SUCCESSFUL',
  'SUCCESS',
  'COMPLETED',
  'APPROVED',
  'CHECKOUT_FINISHED',
  'FINISHED',
]

const FAILED_STATUSES = [
  'FAILED',
  'EXPIRED',
  'CANCELLED',
  'CANCELED',
  'DECLINED',
  'REJECTED',
  'TIMEOUT',
  'TIMED_OUT',
  'ERROR',
]

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
      body?.payment_status ||
      body?.event_type ||
      body?.type ||
      body?.data?.status ||
      body?.data?.transaction_status ||
      body?.data?.checkout_status ||
      body?.data?.payment_status ||
      body?.data?.event_type ||
      body?.data?.type,
  )
}

function getOrderId(req: NextRequest, body: any) {
  const fromQuery = req.nextUrl.searchParams.get('order_id')
  if (fromQuery) return fromQuery

  return (
    body?.order_id ||
    body?.metadata?.order_id ||
    body?.affiliate?.tags?.order_id ||
    body?.data?.order_id ||
    body?.data?.metadata?.order_id ||
    body?.data?.affiliate?.tags?.order_id ||
    null
  )
}

function getCheckoutReference(req: NextRequest, body: any) {
  const fromQuery =
    req.nextUrl.searchParams.get('checkout_reference') ||
    req.nextUrl.searchParams.get('reference') ||
    req.nextUrl.searchParams.get('foreign_transaction_id')

  if (fromQuery) return fromQuery

  return String(
    body?.checkout_reference ||
      body?.foreign_transaction_id ||
      body?.client_transaction_id ||
      body?.transaction_id ||
      body?.metadata?.checkout_reference ||
      body?.affiliate?.foreign_transaction_id ||
      body?.affiliate?.checkout_reference ||
      body?.affiliate?.tags?.checkout_reference ||
      body?.data?.checkout_reference ||
      body?.data?.foreign_transaction_id ||
      body?.data?.client_transaction_id ||
      body?.data?.transaction_id ||
      body?.data?.metadata?.checkout_reference ||
      body?.data?.affiliate?.foreign_transaction_id ||
      body?.data?.affiliate?.checkout_reference ||
      body?.data?.affiliate?.tags?.checkout_reference ||
      '',
  ).trim()
}

function getTransactionCode(body: any) {
  return String(
    body?.transaction_code ||
      body?.transaction_id ||
      body?.client_transaction_id ||
      body?.id ||
      body?.data?.transaction_code ||
      body?.data?.transaction_id ||
      body?.data?.client_transaction_id ||
      body?.data?.id ||
      '',
  ).trim()
}

async function findOrder({
  adminClient,
  orderId,
  checkoutReference,
}: {
  adminClient: any
  orderId?: string | null
  checkoutReference?: string | null
}) {
  const select = `
    id,
    order_number,
    campus_id,
    status,
    total,
    notes,
    production_status,
    order_items(product_id, quantity, size)
  `

  if (orderId) {
    const { data, error } = await adminClient
      .from('orders')
      .select(select)
      .eq('id', orderId)
      .maybeSingle()

    if (error) console.error('[SOLO Webhook] Order by id error:', error)
    if (data) return data
  }

  const ref = String(checkoutReference ?? '').trim()
  if (!ref) return null

  const { data, error } = await adminClient
    .from('orders')
    .select(select)
    .ilike('notes', `%${ref}%`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) console.error('[SOLO Webhook] Order by reference error:', error)

  return data ?? null
}

async function handle(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    console.log('[SOLO Webhook] Received:', JSON.stringify(body))

    const orderId = getOrderId(req, body)
    const checkoutReference = getCheckoutReference(req, body)
    const status = getStatus(body)
    const transactionCode = getTransactionCode(body)

    const { supabaseUrl, serviceRoleKey } = getEnv()

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        received: true,
        action: 'missing_supabase_env',
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const order = await findOrder({
      adminClient,
      orderId,
      checkoutReference,
    })

    if (!order) {
      console.warn('[SOLO Webhook] Order not found', {
        orderId,
        checkoutReference,
        status,
      })

      return NextResponse.json({
        received: true,
        action: 'order_not_found',
        order_id: orderId,
        checkout_reference: checkoutReference,
        status,
      })
    }

    if (!status) {
      return NextResponse.json({
        received: true,
        action: 'missing_status',
        order_id: order.id,
        order_number: order.order_number,
        checkout_reference: checkoutReference,
      })
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
          notes: `${order.notes ?? ''} | Pagado via SumUp SOLO | Ref: ${
            checkoutReference || 'sin_ref'
          } | TXN: ${transactionCode || 'sin_tx'}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      if (updateError) {
        console.error('[SOLO Webhook] Paid update error:', updateError)

        return NextResponse.json({
          received: true,
          action: 'paid_update_error',
          order_number: order.order_number,
        })
      }

      for (const item of order.order_items ?? []) {
        const { error: movementError } = await adminClient
          .from('inventory_movements')
          .insert({
            product_id: item.product_id,
            campus_id: order.campus_id,
            type: 'salida',
            quantity: item.quantity,
            notes: `Pago SumUp SOLO - Orden #${order.order_number} - TXN ${
              transactionCode || 'sin_tx'
            }`,
          })

        if (movementError) {
          console.error('[SOLO Webhook] Inventory movement error:', movementError)
        }
      }

      console.log('[SOLO Webhook] ✅ Order paid:', order.order_number)

      return NextResponse.json({
        received: true,
        action: 'paid',
        order_number: order.order_number,
        checkout_reference: checkoutReference,
        transaction_code: transactionCode,
      })
    }

    if (FAILED_STATUSES.includes(status)) {
      const { error: cancelError } = await adminClient
        .from('orders')
        .update({
          status: 'cancelled',
          notes: `${order.notes ?? ''} | Pago SumUp SOLO ${status.toLowerCase()} | Ref: ${
            checkoutReference || 'sin_ref'
          } | TXN: ${transactionCode || 'sin_tx'}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      if (cancelError) {
        console.error('[SOLO Webhook] Cancel update error:', cancelError)

        return NextResponse.json({
          received: true,
          action: 'cancel_update_error',
          order_number: order.order_number,
        })
      }

      return NextResponse.json({
        received: true,
        action: 'cancelled',
        order_number: order.order_number,
        checkout_reference: checkoutReference,
        transaction_code: transactionCode,
      })
    }

    return NextResponse.json({
      received: true,
      action: 'status_ignored',
      order_number: order.order_number,
      status,
      checkout_reference: checkoutReference,
      transaction_code: transactionCode,
    })
  } catch (error: any) {
    console.error('[SOLO Webhook] Error:', error)

    return NextResponse.json({
      received: true,
      action: 'internal_error',
      error: error?.message,
    })
  }
}

export async function POST(req: NextRequest) {
  return handle(req)
}

export async function GET(req: NextRequest) {
  return handle(req)
}
