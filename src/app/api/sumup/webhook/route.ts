import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── POST /api/sumup/webhook ──────────────────────────────────────────────────
// SumUp llama a este endpoint cuando un pago se completa.
// Configurar en SumUp Dashboard → Webhooks → URL: /api/sumup/webhook
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[SumUp Webhook]', JSON.stringify(body))

    // SumUp envía: { id, checkout_reference, status, amount, currency, ... }
    const { checkout_reference, status, id: checkout_id } = body

    // Solo procesar pagos completados
    if (status !== 'PAID') {
      return NextResponse.json({ received: true, action: 'ignored', status })
    }

    if (!checkout_reference) {
      return NextResponse.json({ received: true, action: 'no_reference' })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Buscar la orden por checkout_reference (guardado en notes o metadata)
    // El checkout_reference lo enviamos como `arm-{order_id}` o el order_number
    const { data: order, error } = await adminClient
      .from('orders')
      .select('id, order_number, campus_id, status, payment_method, order_items(product_id, quantity)')
      .eq('sumup_checkout_id', checkout_id)
      .maybeSingle()

    if (error || !order) {
      console.error('[SumUp Webhook] Order not found for checkout:', checkout_id)
      // Try by checkout_reference
      const { data: orderByRef } = await adminClient
        .from('orders')
        .select('id, order_number, campus_id, status, order_items(product_id, quantity)')
        .eq('notes', `sumup:${checkout_reference}`)
        .maybeSingle()

      if (!orderByRef) {
        return NextResponse.json({ received: true, action: 'order_not_found' })
      }

      // Update order to paid
      await processPayment(adminClient, orderByRef)
      return NextResponse.json({ received: true, action: 'paid', order_number: orderByRef.order_number })
    }

    await processPayment(adminClient, order)
    return NextResponse.json({ received: true, action: 'paid', order_number: order.order_number })

  } catch (error: any) {
    console.error('[SumUp Webhook] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function processPayment(adminClient: any, order: any) {
  // 1. Actualizar orden a pagada
  await adminClient
    .from('orders')
    .update({ status: 'paid' })
    .eq('id', order.id)

  // 2. Descontar stock
  for (const item of (order.order_items ?? [])) {
    await adminClient
      .from('inventory_movements')
      .insert({
        product_id: item.product_id,
        campus_id:  order.campus_id,
        type:       'salida',
        quantity:   item.quantity,
        notes:      `Pago link - Orden #${order.order_number}`,
      })
  }

  console.log('[SumUp Webhook] Order paid:', order.order_number)
}
