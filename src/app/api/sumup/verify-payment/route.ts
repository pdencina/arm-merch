import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTrackingEmail } from '@/lib/tracking-email'

// Ruta: src/app/api/sumup/verify-payment/route.ts
// Smart POS real:
// 1) La orden nace pending desde /api/orders con payment_method=sumup.
// 2) El vendedor cobra en la máquina SumUp.
// 3) Ingresa el código TX en ARM Merch.
// 4) Esta ruta valida la transacción exacta, marca paid y descuenta stock.

const APPROVED_STATUSES = ['SUCCESSFUL', 'PAID', 'APPROVED', 'COMPLETED', 'SUCCESS']

function normalize(value: unknown) {
  return String(value ?? '').trim().toUpperCase()
}

function fmtStatus(value: unknown) {
  return String(value ?? 'SIN_ESTADO')
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const apiKey = process.env.SUMUP_API_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'SUMUP_API_KEY no configurada' }, { status: 500 })
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ success: false, error: 'Supabase admin env no configurada' }, { status: 500 })
    }

    const body = await req.json().catch(() => ({}))
    const orderId = body?.order_id
    const txCode = normalize(body?.tx_code)
    const amount = Number(body?.amount ?? 0)

    if (!orderId || !txCode) {
      return NextResponse.json(
        { success: false, error: 'order_id y tx_code requeridos' },
        { status: 400 },
      )
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select(`
        id,
        order_number,
        campus_id,
        status,
        total,
        tracking_token,
        production_status,
        order_items(product_id, quantity, unit_price, size)
      `)
      .eq('id', orderId)
      .maybeSingle()

    if (orderError) {
      console.error('[Smart POS Verify] Order query error:', orderError)
      return NextResponse.json({ success: false, error: 'Error consultando la orden' }, { status: 500 })
    }

    if (!order) {
      return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404 })
    }

    if (order.status === 'paid') {
      return NextResponse.json({
        success: true,
        already_paid: true,
        order_number: order.order_number,
        tx_code: txCode,
      })
    }

    if (order.status === 'cancelled') {
      return NextResponse.json({
        success: false,
        message: 'La orden ya está cancelada. Genera una nueva venta.',
      })
    }

    const sumupRes = await fetch(
      `https://api.sumup.com/v0.1/me/transactions?transaction_code=${encodeURIComponent(txCode)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
    )

    const rawText = await sumupRes.text()
    let tx: any = {}

    try {
      tx = JSON.parse(rawText)
    } catch {
      tx = { raw: rawText }
    }

    console.log('[Smart POS Verify] SumUp HTTP:', sumupRes.status)
    console.log('[Smart POS Verify] SumUp TX:', JSON.stringify(tx, null, 2))

    if (!sumupRes.ok) {
      return NextResponse.json(
        {
          success: false,
          message: 'No se pudo consultar SumUp. Revisa el código de transacción.',
          detail: tx,
        },
        { status: 400 },
      )
    }

    const returnedCode = normalize(tx?.transaction_code ?? tx?.id)

    if (!returnedCode || returnedCode !== txCode) {
      return NextResponse.json({
        success: false,
        message: `No se encontró la transacción ${txCode}`,
      })
    }

    const txStatus = normalize(tx?.status ?? tx?.transaction_status)

    if (!APPROVED_STATUSES.includes(txStatus)) {
      return NextResponse.json({
        success: false,
        message: `La transacción ${txCode} no está aprobada. Estado: ${fmtStatus(tx?.status ?? tx?.transaction_status)}`,
        sumup_status: txStatus,
      })
    }

    const txAmount = Number(tx?.amount ?? tx?.total_amount ?? 0)
    const expectedAmount = Number(amount || order.total || 0)

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

    // Voucher por correo solo después de pago confirmado.
    let emailSent = false
    try {
      const { data: contact } = await adminClient
        .from('order_contacts')
        .select('client_name, client_email')
        .eq('order_id', order.id)
        .maybeSingle()

      if (contact?.client_email && process.env.RESEND_API_KEY) {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)

        const { data: itemsData } = await adminClient
          .from('order_items')
          .select('quantity, unit_price, products(name)')
          .eq('order_id', order.id)

        const fmtCLP = (n: number) =>
          new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            maximumFractionDigits: 0,
          }).format(n)

        const rows = (itemsData ?? [])
          .map((item: any) => {
            const name = item.products?.name ?? 'Producto'
            const lineTotal = Number(item.unit_price) * Number(item.quantity)
            return `<tr>
              <td style="padding:10px 6px;border-bottom:1px solid #eee;">${name}</td>
              <td style="padding:10px 6px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
              <td style="padding:10px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${fmtCLP(lineTotal)}</td>
            </tr>`
          })
          .join('')

        const { error: mailError } = await resend.emails.send({
          from: 'ARM Merch <no-reply@armerch.com>',
          to: contact.client_email,
          subject: `Comprobante Orden #${order.order_number}`,
          html: `
            <div style="font-family:Arial,sans-serif;padding:24px;max-width:560px;margin:auto;">
              <h2>✅ Pago confirmado</h2>
              <p>Hola <strong>${contact.client_name ?? 'Cliente'}</strong>, gracias por tu compra.</p>
              <p><strong>Orden:</strong> #${order.order_number}</p>
              <p><strong>Método:</strong> Smart POS SumUp</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-collapse:collapse;">
                <thead>
                  <tr>
                    <th align="left" style="padding:8px 6px;border-bottom:2px solid #ddd;">Producto</th>
                    <th align="center" style="padding:8px 6px;border-bottom:2px solid #ddd;">Cant.</th>
                    <th align="right" style="padding:8px 6px;border-bottom:2px solid #ddd;">Total</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
              <h3 style="text-align:right;margin-top:18px;">Total pagado: ${fmtCLP(Number(order.total ?? expectedAmount))}</h3>
              <p style="font-size:12px;color:#777;">TX: ${txCode}</p>
            </div>
          `,
        })

        if (!mailError) emailSent = true
        else console.error('[Smart POS Verify] Email error:', mailError)
      }
    } catch (emailError) {
      console.error('[Smart POS Verify] Email exception:', emailError)
    }

    console.log('[Smart POS Verify] ✅ Orden pagada:', order.order_number)

    try {
      await sendTrackingEmail({
        orderId: order.id,
        status: order.production_status === 'pending_production' ? 'pending_production' : 'purchase_confirmed',
        appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://armerch.com',
      })
    } catch (trackingEmailError) {
      console.error('[Smart POS Verify] Tracking email error:', trackingEmailError)
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
