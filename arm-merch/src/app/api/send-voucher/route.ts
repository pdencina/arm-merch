import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

interface VoucherItem { name: string; quantity: number; price: number }

interface VoucherPayload {
  to: string; clientName: string; orderNumber: number
  items: VoucherItem[]; subtotal: number; discount: number
  total: number; paymentMethod: string; date: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(n)

const METHOD_LABEL: Record<string, string> = {
  efectivo:'Efectivo', transferencia:'Transferencia bancaria',
  debito:'Tarjeta de débito', credito:'Tarjeta de crédito'
}

function buildEmailHtml(d: VoucherPayload): string {
  const initials = d.clientName.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()

  const itemsHtml = d.items.map(item => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #f0f0f0">
        <div style="font-size:14px;color:#1a1a1a;font-weight:500">${item.name}</div>
        <div style="font-size:12px;color:#888;margin-top:2px">${fmt(item.price)} × ${item.quantity} unidades</div>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;text-align:right;vertical-align:top">
        <div style="font-size:14px;color:#1a1a1a;font-weight:600">${fmt(item.price * item.quantity)}</div>
      </td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Comprobante de compra ARM Merch #${d.orderNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px">
  <tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">

    <!-- Header -->
    <tr><td style="background:#18181b;border-radius:16px 16px 0 0;padding:32px;text-align:center">
      <div style="display:inline-block;background:#f59e0b;border-radius:12px;padding:8px 20px;margin-bottom:16px">
        <span style="font-size:18px;font-weight:900;color:#000;letter-spacing:-0.5px">ARM MERCH</span>
      </div>
      <div style="font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;margin-bottom:4px">
        Comprobante de compra
      </div>
      <div style="font-size:14px;color:#71717a">Orden <span style="color:#f59e0b;font-weight:600">#${d.orderNumber}</span></div>
    </td></tr>

    <!-- Body -->
    <tr><td style="background:#ffffff;padding:32px">

      <!-- Cliente card -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #e5e5e5;border-radius:12px;margin-bottom:28px;overflow:hidden">
        <tr>
          <td style="padding:16px 20px">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;padding-right:14px">
                  <div style="width:44px;height:44px;border-radius:50%;background:#f59e0b;display:flex;align-items:center;justify-content:center;text-align:center;line-height:44px">
                    <span style="font-size:16px;font-weight:700;color:#000">${initials}</span>
                  </div>
                </td>
                <td style="vertical-align:middle">
                  <div style="font-size:16px;font-weight:600;color:#1a1a1a">${d.clientName}</div>
                  <div style="font-size:12px;color:#888;margin-top:2px">${d.date}</div>
                </td>
              </tr>
            </table>
          </td>
          <td style="padding:16px 20px;text-align:right;vertical-align:middle">
            <div style="display:inline-block;background:#dcfce7;border-radius:20px;padding:4px 12px">
              <span style="font-size:12px;font-weight:600;color:#16a34a">✓ Confirmado</span>
            </div>
          </td>
        </tr>
      </table>

      <!-- Productos -->
      <div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px">Detalle de productos</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
        ${itemsHtml}
      </table>

      <!-- Totales -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #e5e5e5;border-radius:12px;padding:20px;margin-bottom:24px">
        <tr>
          <td style="padding:20px">
            ${d.discount > 0 ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px">
              <tr>
                <td style="font-size:13px;color:#888">Subtotal</td>
                <td style="text-align:right;font-size:13px;color:#888">${fmt(d.subtotal)}</td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px">
              <tr>
                <td style="font-size:13px;color:#16a34a">Descuento aplicado</td>
                <td style="text-align:right;font-size:13px;color:#16a34a;font-weight:600">−${fmt(d.discount)}</td>
              </tr>
            </table>
            <tr><td colspan="2" style="border-top:1px solid #e5e5e5;padding-top:10px"></td></tr>
            ` : ''}
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:16px;font-weight:700;color:#1a1a1a">Total pagado</td>
                <td style="text-align:right;font-size:22px;font-weight:800;color:#f59e0b">${fmt(d.total)}</td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e5e5">
              <tr>
                <td style="font-size:12px;color:#888">Método de pago</td>
                <td style="text-align:right;font-size:12px;color:#555;font-weight:500">${METHOD_LABEL[d.paymentMethod] ?? d.paymentMethod}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Mensaje -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;margin-bottom:8px">
        <tr><td style="padding:20px;text-align:center">
          <div style="font-size:20px;margin-bottom:8px">🙏</div>
          <div style="font-size:15px;font-weight:600;color:#92400e;margin-bottom:4px">¡Gracias por tu compra!</div>
          <div style="font-size:13px;color:#a16207">Que Dios bendiga tu vida</div>
        </td></tr>
      </table>

    </td></tr>

    <!-- Footer -->
    <tr><td style="background:#18181b;border-radius:0 0 16px 16px;padding:24px 32px;text-align:center">
      <div style="font-size:13px;color:#52525b;margin-bottom:6px">
        Este comprobante fue generado automáticamente por <strong style="color:#a1a1aa">ARM Merch</strong>
      </div>
      <div style="font-size:12px;color:#3f3f46">ARM Global · Sistema de Merchandising</div>
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
      return NextResponse.json({ error: 'RESEND_API_KEY no configurada' }, { status: 500 })
    }

    const body: VoucherPayload = await req.json()

    if (!body.to?.includes('@')) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

    const { data, error } = await resend.emails.send({
      from:    `ARM Merch <${fromEmail}>`,
      to:      [body.to],
      subject: `Tu comprobante de compra — Orden #${body.orderNumber}`,
      html:    buildEmailHtml(body),
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
