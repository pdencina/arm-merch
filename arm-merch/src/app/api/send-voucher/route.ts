import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

interface VoucherItem {
  name: string
  quantity: number
  price: number
}

interface VoucherPayload {
  to: string
  clientName: string
  orderNumber: number
  items: VoucherItem[]
  subtotal: number
  discount: number
  total: number
  paymentMethod: string
  date: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)

function buildEmailHtml(data: VoucherPayload): string {
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #2a2a2a;color:#e4e4e4;font-size:14px">${item.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #2a2a2a;color:#888;font-size:14px;text-align:center">×${item.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #2a2a2a;color:#f59e0b;font-size:14px;text-align:right;font-weight:600">${fmt(item.price * item.quantity)}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;border:1px solid #222">

        <tr><td style="background:#f59e0b;padding:28px 32px;text-align:center">
          <div style="font-size:28px;font-weight:900;color:#000;letter-spacing:-1px">ARM MERCH</div>
          <div style="font-size:13px;color:#00000099;margin-top:4px;font-weight:500">ARM Global</div>
        </td></tr>

        <tr><td style="padding:28px 32px 0">
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
            <tr>
              <td><div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Orden</div>
              <div style="font-size:22px;font-weight:700;color:#fff">#${data.orderNumber}</div></td>
              <td style="text-align:right"><div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Fecha</div>
              <div style="font-size:14px;color:#ccc">${data.date}</div></td>
            </tr>
          </table>
          <div style="background:#1a1a1a;border-radius:10px;padding:14px 16px;margin-bottom:24px;border:1px solid #2a2a2a">
            <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Cliente</div>
            <div style="font-size:16px;font-weight:600;color:#fff">${data.clientName}</div>
          </div>
        </td></tr>

        <tr><td style="padding:0 32px">
          <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px">Detalle de compra</div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <th style="text-align:left;font-size:11px;color:#555;font-weight:500;padding-bottom:8px">Producto</th>
              <th style="text-align:center;font-size:11px;color:#555;font-weight:500;padding-bottom:8px">Cant.</th>
              <th style="text-align:right;font-size:11px;color:#555;font-weight:500;padding-bottom:8px">Total</th>
            </tr>
            ${itemsHtml}
          </table>
        </td></tr>

        <tr><td style="padding:20px 32px">
          <div style="background:#1a1a1a;border-radius:10px;padding:16px;border:1px solid #2a2a2a">
            ${data.discount > 0 ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px">
              <tr><td style="color:#888;font-size:13px">Subtotal</td><td style="text-align:right;color:#ccc;font-size:13px">${fmt(data.subtotal)}</td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px">
              <tr><td style="color:#4ade80;font-size:13px">Descuento</td><td style="text-align:right;color:#4ade80;font-size:13px">−${fmt(data.discount)}</td></tr>
            </table>
            ` : ''}
            <table width="100%" cellpadding="0" cellspacing="0" style="border-top:${data.discount > 0 ? '1px solid #2a2a2a;padding-top:10px' : '0'}">
              <tr>
                <td style="color:#fff;font-size:16px;font-weight:700">Total</td>
                <td style="text-align:right;color:#f59e0b;font-size:20px;font-weight:700">${fmt(data.total)}</td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;padding-top:10px;border-top:1px solid #2a2a2a">
              <tr>
                <td style="color:#555;font-size:12px">Método de pago</td>
                <td style="text-align:right;color:#ccc;font-size:12px;text-transform:capitalize">${data.paymentMethod}</td>
              </tr>
            </table>
          </div>
        </td></tr>

        <tr><td style="padding:24px 32px;text-align:center;border-top:1px solid #1a1a1a">
          <div style="font-size:16px;color:#fff;font-weight:600;margin-bottom:4px">¡Gracias por tu compra!</div>
          <div style="font-size:13px;color:#555;margin-bottom:16px">Que Dios bendiga tu vida</div>
          <div style="font-size:11px;color:#333">— ARM Global —</div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY no configurada en variables de entorno' }, { status: 500 })
    }

    const body: VoucherPayload = await req.json()

    if (!body.to || !body.to.includes('@')) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    // Usar onboarding@resend.dev para pruebas sin dominio verificado
    // Cambiar a 'voucher@tudominio.cl' cuando verifiques tu dominio en Resend
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
    const fromName  = 'ARM Merch'

    const { data, error } = await resend.emails.send({
      from:    `${fromName} <${fromEmail}>`,
      to:      [body.to],
      subject: `Voucher ARM Merch — Orden #${body.orderNumber}`,
      html:    buildEmailHtml(body),
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id })
  } catch (err: any) {
    console.error('Send voucher error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
