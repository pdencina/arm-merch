import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const orderId = body?.order_id
    let checkoutId = body?.checkout_id

    if (!orderId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'order_id requerido',
        },
        { status: 400 },
      )
    }

    // Buscar orden
    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select(`
        id,
        order_number,
        campus_id,
        pickup_campus_id,
        status,
        payment_method,
        notes,
        tracking_token,
        production_status,
        sumup_checkout_id,
        order_items (
          product_id,
          quantity,
          size
        )
      `)
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Orden no encontrada',
        },
        { status: 404 },
      )
    }

    // Si no viene checkout_id desde frontend usamos el guardado en DB
    if (!checkoutId) {
      checkoutId = order?.sumup_checkout_id
    }

    if (!checkoutId) {
      return NextResponse.json({
        ok: true,
        action: 'pending',
        status: 'pending',
        order_status: 'pending',
        sumup_status: 'WAITING_CHECKOUT_ID',
        order_number: order.order_number,
      })
    }

    // Consultar SumUp
    const response = await fetch(
      `${process.env.SUMUP_API_BASE}/v0.1/checkouts/${checkoutId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.SUMUP_API_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    )

    const checkoutData = await response.json().catch(() => null)

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: checkoutData?.message || 'Error consultando checkout SumUp',
          sumup: checkoutData,
        },
        { status: 400 },
      )
    }

    const resolvedStatus = String(
      checkoutData?.status ||
        checkoutData?.transaction_code ||
        'PENDING',
    ).toUpperCase()

    const isPaid = [
      'PAID',
      'SUCCESSFUL',
      'SUCCESS',
      'COMPLETED',
    ].includes(resolvedStatus)

    const isRejected = [
      'FAILED',
      'CANCELLED',
      'DECLINED',
      'EXPIRED',
    ].includes(resolvedStatus)

    // Si pagó exitosamente
    if (isPaid) {
      // Evitar reprocesar stock
      if (order.status !== 'paid') {
        // Actualizar orden
        await adminClient
          .from('orders')
          .update({
            status: 'paid',
            payment_method: 'sumup_solo',
            paid_at: new Date().toISOString(),
          })
          .eq('id', order.id)

        // Descuento stock
        if (Array.isArray(order.order_items)) {
          for (const item of order.order_items) {
            const qty = Number(item.quantity || 0)

            if (!item.product_id || qty <= 0) continue

            // Obtener stock actual
            const { data: inventory } = await adminClient
              .from('inventory')
              .select('id, stock')
              .eq('product_id', item.product_id)
              .eq('campus_id', order.campus_id)
              .maybeSingle()

            if (!inventory) continue

            const newStock = Math.max(0, Number(inventory.stock || 0) - qty)

            await adminClient
              .from('inventory')
              .update({
                stock: newStock,
              })
              .eq('id', inventory.id)
          }
        }

        // Intentar enviar voucher
        try {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/orders/send-voucher`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              order_id: order.id,
            }),
          })
        } catch (voucherError) {
          console.error('Voucher error:', voucherError)
        }
      }

      return NextResponse.json({
        ok: true,
        paid: true,
        final: true,
        action: 'paid',
        status: 'paid',
        order_status: 'paid',
        sumup_status: resolvedStatus,
        order_number: order.order_number,
        email_sent: true,
      })
    }

    // Rechazado / cancelado
    if (isRejected) {
      await adminClient
        .from('orders')
        .update({
          status: 'cancelled',
        })
        .eq('id', order.id)

      return NextResponse.json({
        ok: true,
        paid: false,
        final: true,
        action: 'rejected',
        status: 'rejected',
        order_status: 'rejected',
        sumup_status: resolvedStatus,
        order_number: order.order_number,
      })
    }

    // Pendiente
    return NextResponse.json({
      ok: true,
      paid: false,
      final: false,
      action: 'pending',
      status: 'pending',
      order_status: 'pending',
      sumup_status: resolvedStatus || 'PENDING',
      order_number: order.order_number,
    })
  } catch (error: any) {
    console.error('[SumUp Check Checkout] Error:', error)

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Internal Server Error',
      },
      { status: 500 },
    )
  }
}
