import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Ruta: src/app/api/sumup/webhook/route.ts
// Uso recomendado:
// - Procesa pagos tipo LINK / QR checkout.
// - NO procesa SumUp SOLO Reader, porque SOLO se confirma con /api/sumup/solo-status.
// - Evita doble descuento usando order.status.
// - Conserva notas anteriores para no romper trazabilidad.

const PAID_STATUSES = ['PAID', 'SUCCESSFUL', 'SUCCESS', 'COMPLETED', 'APPROVED']
const FAILED_STATUSES = ['FAILED', 'EXPIRED', 'CANCELLED', 'CANCELED', 'DECLINED', 'REJECTED']

function normalize(value: unknown) {
  return String(value ?? '').trim().toUpperCase()
}

function appendNotes(current: string | null | undefined, ...parts: Array<string | null | undefined>) {
  return [current ?? '', ...parts]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' | ')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    console.log('[SumUp Webhook] Received:', JSON.stringify(body))

    const eventType = body?.event_type
    const checkoutId = body?.id ?? body?.checkout_id ?? body?.checkout?.id

    if (eventType && eventType !== 'CHECKOUT_STATUS_CHANGED') {
      return NextResponse.json({ received: true, action: 'ignored_event' })
    }

    if (!checkoutId) {
      return NextResponse.json({ received: true, action: 'missing_checkout_id' })
    }

    const apiKey = process.env.SUMUP_API_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const sumupApiBase = process.env.SUMUP_API_BASE || 'https://api.sumup.com'

    if (!apiKey) {
      console.error('[SumUp Webhook] Missing SUMUP_API_KEY')
      return NextResponse.json({ received: true, action: 'missing_sumup_api_key' })
    }

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[SumUp Webhook] Missing Supabase admin env vars')
      return NextResponse.json({ received: true, action: 'missing_supabase_env' })
    }

    const checkoutRes = await fetch(`${sumupApiBase}/v0.1/checkouts/${checkoutId}`, {
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

    const checkoutReference =
      checkout?.checkout_reference ??
      checkout?.reference ??
      checkout?.client_transaction_id ??
      body?.checkout_reference ??
      body?.reference

    const sumupStatus = normalize(checkout?.status ?? body?.status)
    const transaction = checkout?.transactions?.[0] ?? checkout?.transaction ?? null
    const transactionCode =
      transaction?.transaction_code ??
      transaction?.id ??
      checkout?.transaction_code ??
      checkout?.transaction_id ??
      ''

    if (!checkoutReference) {
      return NextResponse.json({ received: true, action: 'missing_checkout_reference' })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, order_number, campus_id, status, payment_method, notes, order_items(product_id, quantity, size, fulfillment_type)')
      .or(`notes.ilike.%${checkoutReference}%,sumup_checkout_id.eq.${checkoutId}`)
      .maybeSingle()

    if (orderError) {
      console.error('[SumUp Webhook] Order query error:', orderError)
      return NextResponse.json({ received: true, action: 'order_query_error', detail: orderError.message })
    }

    if (!order) {
      console.error('[SumUp Webhook] Order not found for reference:', checkoutReference)
      return NextResponse.json({ received: true, action: 'order_not_found', checkout_reference: checkoutReference })
    }

    // SumUp SOLO Reader se confirma por /api/sumup/solo-status.
    // Esto evita mezclar link checkout con reader checkout y evita descuentos erróneos.
    if (order.payment_method === 'solo' || String(order.notes ?? '').includes('SumUp SOLO')) {
      return NextResponse.json({
        received: true,
        action: 'solo_ignored_use_solo_status',
        order_number: order.order_number,
        status: order.status,
      })
    }

    // Idempotencia: si ya está finalizada, no volver a descontar.
    if (order.status === 'paid' || order.status === 'cancelled') {
      return NextResponse.json({
        received: true,
        action: 'already_processed',
        order_number: order.order_number,
        status: order.status,
      })
    }

    if (PAID_STATUSES.includes(sumupStatus)) {
      const { error: updateError } = await adminClient
        .from('orders')
        .update({
          status: 'paid',
          notes: appendNotes(
            order.notes,
            'Pagado vía SumUp Link',
            `Ref: ${checkoutReference}`,
            `TXN: ${transactionCode || 'N/A'}`,
            `Estado: ${sumupStatus}`,
          ),
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      if (updateError) {
        console.error('[SumUp Webhook] Error updating paid order:', updateError)
        return NextResponse.json({ received: true, action: 'paid_update_error', detail: updateError.message })
      }

      await adminClient.from('order_status_history').insert({
        order_id: order.id,
        status: 'payment_confirmed',
        title: 'Pago confirmado',
        message: 'El pago fue confirmado correctamente por SumUp Link.',
        created_at: new Date().toISOString(),
      }).then(() => null)

      for (const item of order.order_items ?? []) {
        // Si era producción, no descontamos stock hasta que el proceso real lo requiera.
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
          console.error('[SumUp Webhook] Inventory movement error:', movementError)
        }
      }

      console.log('[SumUp Webhook] ✅ Order paid:', order.order_number)

      return NextResponse.json({
        received: true,
        action: 'paid',
        order_number: order.order_number,
        sumup_status: sumupStatus,
      })
    }

    if (FAILED_STATUSES.includes(sumupStatus)) {
      const { error: cancelError } = await adminClient
        .from('orders')
        .update({
          status: 'cancelled',
          notes: appendNotes(
            order.notes,
            `Pago ${sumupStatus.toLowerCase()} vía SumUp Link`,
            `Ref: ${checkoutReference}`,
          ),
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      if (cancelError) {
        console.error('[SumUp Webhook] Error cancelling order:', cancelError)
        return NextResponse.json({ received: true, action: 'cancel_update_error', detail: cancelError.message })
      }

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
