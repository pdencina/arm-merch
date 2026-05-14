import { NextRequest, NextResponse } from 'next/server'

    if (Math.abs(txAmount - expectedAmount) > 1) {
      return NextResponse.json({
        success: false,
        message: `El monto no coincide. SumUp: $${txAmount.toLocaleString('es-CL')} / Orden: $${expectedAmount.toLocaleString('es-CL')}`,
        tx_amount: txAmount,
        order_amount: expectedAmount,
      })
    }

    const { error: updateError } = await adminClient
      .from('orders')
      .update({
        status: 'paid',
        notes: `Smart POS SumUp | TX: ${txCode}`,
      })
      .eq('id', order.id)

    if (updateError) {
      console.error('[Smart POS Verify] Error updating order:', updateError)
      return NextResponse.json({ success: false, error: 'No se pudo marcar la orden como pagada' }, { status: 500 })
    }

    for (const item of order.order_items ?? []) {
      const { error: movementError } = await adminClient
        .from('inventory_movements')
        .insert({
          product_id: item.product_id,
          campus_id: order.campus_id,
          type: 'salida',
          quantity: item.quantity,
          notes: `Smart POS SumUp - Orden #${order.order_number} - TX ${txCode}`,
        })

      if (movementError) {
        console.error('[Smart POS Verify] Inventory movement error:', movementError)
      }
    }

    let emailSent = false

    // ... RESTO DEL ARCHIVO SE MANTIENE IGUAL ...

    console.log('[Smart POS Verify] ✅ Orden pagada:', order.order_number)

    // Enviar tracking SOLO para pedidos en producción
    if (order.production_status === 'pending_production') {
      try {
        await sendTrackingEmail({
          orderId: order.id,
          status: 'pending_production',
          appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://armerch.com',
        })
      } catch (trackingEmailError) {
        console.error('[Smart POS Verify] Tracking email error:', trackingEmailError)
      }
    }

    return NextResponse.json({
      success: true,
      found: true,
      order_number: order.order_number,
      tx_code: txCode,
      email_sent: emailSent,
    })
  } catch (error: any) {
    console.error('[Smart POS Verify] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Error interno' },
      { status: 500 },
    )
  }
}