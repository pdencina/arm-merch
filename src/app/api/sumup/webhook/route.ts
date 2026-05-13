import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Ruta: src/app/api/sumup/webhook/route.ts
// Objetivo:
// - SumUp avisa cambio de estado del checkout.
// - Este webhook consulta a SumUp para obtener el estado real.
// - Si PAID: marca orden como paid y descuenta stock.
// - Si FAILED / EXPIRED / CANCELLED: marca orden como cancelled y NO descuenta stock.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    console.log('[SumUp Webhook] Received:', JSON.stringify(body))

    const eventType = body?.event_type
    const checkoutId = body?.id ?? body?.checkout_id

    if (eventType && eventType !== 'CHECKOUT_STATUS_CHANGED') {
      return NextResponse.json({ received: true, action: 'ignored_event' })
    }

    if (!checkoutId) {
      return NextResponse.json({ received: true, action: 'missing_checkout_id' })
    }

    const apiKey = process.env.SUMUP_API_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!apiKey) {
      console.error('[SumUp Webhook] Missing SUMUP_API_KEY')
      return NextResponse.json({ received: true, action: 'missing_sumup_api_key' })
    }

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[SumUp Webhook] Missing Supabase admin env vars')
      return NextResponse.json({ received: true, action: 'missing_supabase_env' })
    }

    // 1) Consultar estado real del checkout en SumUp
    const checkoutRes = await fetch(`https://api.sumup.com/v0.1/checkouts/${checkoutId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    const checkoutText = await checkoutRes.text()
    let checkout: any = {}

    try {
      checkout = JSON.parse(checkoutText)
    } catch {
      checkout = { raw: checkoutText }
    }

    console.log('[SumUp Webhook] Checkout status:', checkoutRes.status)
    console.log('[SumUp Webhook] Checkout response:', checkout)

    if (!checkoutRes.ok) {
      return NextResponse.json({
        received: true,
        action: 'checkout_fetch_failed',
        status: checkoutRes.status,
        detail: checkout,
      })
    }

    const checkoutReference = checkout?.checkout_reference
    const sumupStatus = String(checkout?.status ?? '').toUpperCase()
    const transaction = checkout?.transactions?.[0] ?? null
    const transactionCode = transaction?.transaction_code ?? transaction?.id ?? ''

    if (!checkoutReference) {
      return NextResponse.json({ received: true, action: 'missing_checkout_reference' })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // 2) Buscar orden creada por ARM Merch.
    // El cart.tsx guarda notes como: sumup:<checkout_reference>
    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, order_number, campus_id, status, notes, order_items(product_id, quantity, size)')
      .ilike('notes', `%${checkoutReference}%`)
      .maybeSingle()

    if (orderError) {
      console.error('[SumUp Webhook] Order query error:', orderError)
      return NextResponse.json({ received: true, action: 'order_query_error' })
    }

    if (!order) {
      console.error('[SumUp Webhook] Order not found for reference:', checkoutReference)
      return NextResponse.json({ received: true, action: 'order_not_found', checkout_reference: checkoutReference })
    }

    // Evitar duplicar descuentos de stock si SumUp reintenta el webhook
    if (order.status === 'paid' || order.status === 'cancelled') {
      return NextResponse.json({
        received: true,
        action: 'already_processed',
        order_number: order.order_number,
        status: order.status,
      })
    }

    const paidStatuses = ['PAID', 'SUCCESSFUL', 'SUCCESS', 'COMPLETED']
    const failedStatuses = ['FAILED', 'EXPIRED', 'CANCELLED', 'CANCELED']

    // 3) Pago aprobado: marcar paid y descontar stock
    if (paidStatuses.includes(sumupStatus)) {
      const { error: updateError } = await adminClient
        .from('orders')
        .update({
          status: 'paid',
          notes: `Pagado via SumUp | Ref: ${checkoutReference} | TXN: ${transactionCode}`,
        })
        .eq('id', order.id)

      if (updateError) {
        console.error('[SumUp Webhook] Error updating paid order:', updateError)
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
            notes: `Pago link SumUp - Orden #${order.order_number} - TXN ${transactionCode}`,
          })

        if (movementError) {
          console.error('[SumUp Webhook] Inventory movement error:', movementError)
        }
      }

      console.log('[SumUp Webhook] ✅ Order paid:', order.order_number)

      return NextResponse.json({
        received: true,
        action: 'paid',
        order_number: order.order_number,
      })
    }

    // 4) Pago rechazado/expirado: marcar cancelled y NO tocar stock
    if (failedStatuses.includes(sumupStatus)) {
      const { error: cancelError } = await adminClient
        .from('orders')
        .update({
          status: 'cancelled',
          notes: `Pago ${sumupStatus.toLowerCase()} via SumUp | Ref: ${checkoutReference}`,
        })
        .eq('id', order.id)

      if (cancelError) {
        console.error('[SumUp Webhook] Error cancelling order:', cancelError)
        return NextResponse.json({ received: true, action: 'cancel_update_error' })
      }

      console.log('[SumUp Webhook] ❌ Order cancelled:', order.order_number, sumupStatus)

      return NextResponse.json({
        received: true,
        action: 'cancelled',
        order_number: order.order_number,
        sumup_status: sumupStatus,
      })
    }

    return NextResponse.json({
      received: true,
      action: 'status_ignored',
      order_number: order.order_number,
      sumup_status: sumupStatus,
    })
  } catch (error: any) {
    console.error('[SumUp Webhook] Error:', error)

    return NextResponse.json({
      received: true,
      action: 'internal_error',
      error: error?.message ?? 'Error interno',
    })
  }
}
