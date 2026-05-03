import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── POST /api/sumup/webhook ──────────────────────────────────────────────────
// SumUp llama automáticamente a este endpoint cuando el estado del checkout cambia.
// Se configura via return_url en la creación del checkout.
// Maneja: PAID, FAILED, CANCELLED
// ─────────────────────────────────────────────────────────────────────────────

const log = (...args: any[]) => process.env.NODE_ENV !== 'production' && console.log(...args)


export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    log('[SumUp Webhook] Received:', JSON.stringify(body))

    const { checkout_reference, status, id: checkout_id, transaction_code } = body

    if (!checkout_reference) {
      return NextResponse.json({ received: true, action: 'no_reference' })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Buscar la orden por checkout_reference (enviamos arm-{timestamp} al crear)
    // También intentamos por sumup_checkout_id como fallback
    let order: any = null

    // Intento 1: por checkout_reference en notes
    const { data: o1 } = await adminClient
      .from('orders')
      .select('id, order_number, campus_id, status, order_items(product_id, quantity, size)')
      .ilike('notes', `%${checkout_reference}%`)
      .maybeSingle()

    if (o1) order = o1

    // Intento 2: por sumup_checkout_id si existe la columna
    if (!order && checkout_id) {
      const { data: o2 } = await adminClient
        .from('orders')
        .select('id, order_number, campus_id, status, order_items(product_id, quantity, size)')
        .eq('sumup_checkout_id', checkout_id)
        .maybeSingle()
      if (o2) order = o2
    }

    if (!order) {
      console.error('[SumUp Webhook] Order not found for reference:', checkout_reference)
      return NextResponse.json({ received: true, action: 'order_not_found', checkout_reference })
    }

    // Ya procesada — evitar duplicados
    if (order.status === 'paid' || order.status === 'cancelled') {
      log('[SumUp Webhook] Already processed:', order.order_number, order.status)
      return NextResponse.json({ received: true, action: 'already_processed' })
    }

    // ── PAGO ACEPTADO ─────────────────────────────────────────────────────────
    if (status === 'PAID') {
      await adminClient
        .from('orders')
        .update({
          status: 'paid',
          notes: `Pagado via SumUp | Ref: ${checkout_reference} | TXN: ${transaction_code ?? ''}`,
        })
        .eq('id', order.id)

      // Descontar stock por campus
      for (const item of (order.order_items ?? [])) {
        await adminClient
          .from('inventory_movements')
          .insert({
            product_id: item.product_id,
            campus_id:  order.campus_id,
            type:       'salida',
            quantity:   item.quantity,
            notes:      `Pago link SumUp - Orden #${order.order_number}`,
          })
      }

      log('[SumUp Webhook] ✅ Order PAID:', order.order_number)
      return NextResponse.json({ received: true, action: 'paid', order_number: order.order_number })
    }

    // ── PAGO FALLIDO O CANCELADO ──────────────────────────────────────────────
    if (status === 'FAILED' || status === 'CANCELLED' || status === 'EXPIRED') {
      await adminClient
        .from('orders')
        .update({
          status: 'cancelled',
          notes: `Pago ${status.toLowerCase()} via SumUp | Ref: ${checkout_reference}`,
        })
        .eq('id', order.id)

      log('[SumUp Webhook] ❌ Order', status, ':', order.order_number)
      return NextResponse.json({ received: true, action: status.toLowerCase(), order_number: order.order_number })
    }

    // Otros estados (PENDING, etc) — solo loguear
    log('[SumUp Webhook] Status ignored:', status)
    return NextResponse.json({ received: true, action: 'ignored', status })

  } catch (error: any) {
    console.error('[SumUp Webhook] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
