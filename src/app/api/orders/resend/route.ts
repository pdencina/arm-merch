import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function escapeHtml(value: string) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Falta RESEND_API_KEY' },
        { status: 500 }
      )
    }

    const { order_id } = await req.json()

    if (!order_id) {
      return NextResponse.json(
        { error: 'order_id requerido' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const resend = new Resend(process.env.RESEND_API_KEY)

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        created_at,
        total,
        discount,
        payment_method,
        notes
      `)
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      )
    }

    const { data: contact, error: contactError } = await supabase
      .from('order_contacts')
      .select(`
        client_name,
        client_email
      `)
      .eq('order_id', order_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (contactError) {
      return NextResponse.json(
        { error: contactError.message },
        { status: 400 }
      )
    }

    if (!contact?.client_email) {
      return NextResponse.json(
        { error: 'La orden no tiene correo registrado' },
        { status: 400 }
      )
    }

    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select(`
        id,
        quantity,
        unit_price,
        products (
          name,
          sku
        )
      `)
      .eq('order_id', order_id)

    if (itemsError) {
      return NextResponse.json(
        { error: itemsError.message },
        { status: 400 }
      )
    }

    const safeItems = (items ?? []).map((item: any) => {
      const product = Array.isArray(item.products)
        ? item.products[0]
        : item.products

      return {
        name: product?.name ?? 'Producto',
        sku: product?.sku ?? '—',
        quantity: Number(item.quantity ?? 0),
        unitPrice: Number(item.unit_price ?? 0),
        lineTotal: Number(item.quantity ?? 0) * Number(item.unit_price ?? 0),
      }
    })

    const subtotal = safeItems.reduce(
      (sum: number, item: any) => sum + item.lineTotal,
      0
    )

    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
        <div style="text-align:center; margin-bottom: 24px;">
          <div style="width:48px; height:48px; line-height:48px; margin:0 auto 12px; background:#111; color:#fff; border-radius:12px; font-weight:700;">A</div>
          <h2 style="margin:0;">ARM MERCH</h2>
          <p style="margin:6px 0 0; color:#666;">Reenvío de comprobante</p>
        </div>

        <hr style="border:none; border-top:1px solid #ddd; margin:16px 0;" />

        <p><strong>Cliente:</strong> ${escapeHtml(contact.client_name || 'Cliente')}</p>
        <p><strong>Orden:</strong> #${escapeHtml(String(order.order_number))}</p>
        <p><strong>Fecha:</strong> ${escapeHtml(new Date(order.created_at).toLocaleString('es-CL'))}</p>
        <p><strong>Método de pago:</strong> ${escapeHtml(order.payment_method ?? 'Sin definir')}</p>

        <hr style="border:none; border-top:1px solid #ddd; margin:16px 0;" />

        ${safeItems.map((item) => `
          <div style="display:flex; justify-content:space-between; gap:16px; margin-bottom:12px;">
            <div>
              <div style="font-weight:600;">${escapeHtml(item.name)}</div>
              <div style="font-size:12px; color:#666;">SKU: ${escapeHtml(item.sku)}</div>
              <div style="font-size:12px; color:#666;">${item.quantity} × ${escapeHtml(formatCurrency(item.unitPrice))}</div>
            </div>
            <div style="font-weight:600; white-space:nowrap;">
              ${escapeHtml(formatCurrency(item.lineTotal))}
            </div>
          </div>
        `).join('')}

        <hr style="border:none; border-top:1px solid #ddd; margin:16px 0;" />

        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span style="color:#666;">Subtotal</span>
          <span>${escapeHtml(formatCurrency(subtotal))}</span>
        </div>

        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span style="color:#666;">Descuento</span>
          <span>${escapeHtml(formatCurrency(Number(order.discount ?? 0)))}</span>
        </div>

        <div style="display:flex; justify-content:space-between; font-size:18px; font-weight:700; margin-top:10px;">
          <span>Total</span>
          <span>${escapeHtml(formatCurrency(Number(order.total ?? 0)))}</span>
        </div>

        ${
          order.notes
            ? `
          <hr style="border:none; border-top:1px solid #ddd; margin:16px 0;" />
          <div>
            <div style="font-size:12px; color:#666; margin-bottom:4px;">Nota</div>
            <div>${escapeHtml(order.notes)}</div>
          </div>
        `
            : ''
        }

        <hr style="border:none; border-top:1px solid #ddd; margin:16px 0;" />

        <p style="text-align:center; color:#666; font-size:12px;">
          Gracias por tu compra 🙌
        </p>
      </div>
    `

    const { error: mailError } = await resend.emails.send({
      from: 'ARM Merch <onboarding@resend.dev>',
      to: contact.client_email,
      subject: `Reenvío comprobante #${order.order_number}`,
      html,
    })

    if (mailError) {
      return NextResponse.json(
        { error: mailError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Error reenviando voucher' },
      { status: 500 }
    )
  }
}