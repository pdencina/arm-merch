import { Resend } from 'resend'

export type TrackingEmailStatus =
  | 'confirmed'
  | 'pending_production'
  | 'in_production'
  | 'ready_pickup'
  | 'delivered'
  | 'cancelled'

type TrackingEmailInput = {
  to: string
  clientName?: string | null
  orderNumber: string | number
  trackingToken: string
  status: TrackingEmailStatus
  campusName?: string | null
  pickupAddress?: string | null
  total?: number | null
  appUrl?: string | null
}

const STATUS_COPY: Record<
  TrackingEmailStatus,
  {
    subject: string
    title: string
    eyebrow: string
    message: string
    color: string
  }
> = {
  confirmed: {
    subject: 'Compra confirmada',
    title: 'Tu compra fue confirmada',
    eyebrow: 'Compra confirmada',
    message: 'Recibimos tu pedido correctamente. Puedes revisar el avance desde el botón de seguimiento.',
    color: '#16a34a',
  },
  pending_production: {
    subject: 'Pedido recibido',
    title: 'Recibimos tu pedido',
    eyebrow: 'Pedido recibido',
    message: 'Tu pedido ya está en nuestra cola de preparación.',
    color: '#f59e0b',
  },
  in_production: {
    subject: 'Tu pedido está en producción',
    title: 'Tu pedido está en producción',
    eyebrow: 'En producción',
    message: 'El equipo ARM Merch ya está preparando tu producto.',
    color: '#3b82f6',
  },
  ready_pickup: {
    subject: 'Tu pedido está listo para retirar',
    title: 'Tu pedido está listo para retiro',
    eyebrow: 'Listo para retiro',
    message: 'Ya puedes acercarte al campus indicado para retirar tu pedido.',
    color: '#10b981',
  },
  delivered: {
    subject: 'Pedido entregado',
    title: 'Tu pedido fue entregado',
    eyebrow: 'Entregado',
    message: 'Tu pedido fue retirado exitosamente. ¡Gracias por comprar en ARM Merch!',
    color: '#22c55e',
  },
  cancelled: {
    subject: 'Pedido cancelado',
    title: 'Tu pedido fue cancelado',
    eyebrow: 'Cancelado',
    message: 'El pedido fue cancelado o no pudo ser confirmado.',
    color: '#ef4444',
  },
}

function fmtCLP(value?: number | null) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0))
}

function esc(value?: string | number | null) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export async function sendTrackingEmail(input: TrackingEmailInput) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Tracking Email] RESEND_API_KEY no configurada')
    return { sent: false, error: 'RESEND_API_KEY no configurada' }
  }

  if (!input.to?.includes('@')) {
    return { sent: false, error: 'Email inválido' }
  }

  const appUrl =
    input.appUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}` ||
    'https://armerch.com'

  const copy = STATUS_COPY[input.status] ?? STATUS_COPY.confirmed
  const trackingUrl = `${String(appUrl).replace(/\/$/, '')}/track/${encodeURIComponent(input.trackingToken)}`
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#090b10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#090b10;padding:32px 12px;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="width:100%;max-width:580px;">
          <tr>
            <td style="padding:26px 28px;background:#18181b;border-radius:24px 24px 0 0;text-align:center;">
              <p style="margin:0;color:#f59e0b;font-size:12px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">ARM Merch</p>
              <h1 style="margin:10px 0 0;color:#ffffff;font-size:28px;line-height:1.15;font-weight:900;">${esc(copy.title)}</h1>
            </td>
          </tr>

          <tr>
            <td style="background:#ffffff;padding:30px 28px;">
              <div style="display:inline-block;background:${copy.color};color:#ffffff;border-radius:999px;padding:7px 13px;font-size:12px;font-weight:800;">
                ${esc(copy.eyebrow)}
              </div>

              <p style="margin:22px 0 0;color:#18181b;font-size:16px;line-height:1.6;">
                Hola <strong>${esc(input.clientName || 'Cliente')}</strong>, ${esc(copy.message)}
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#f4f4f5;border-radius:18px;overflow:hidden;">
                <tr>
                  <td style="padding:18px 20px;border-bottom:1px solid #e4e4e7;">
                    <p style="margin:0;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:800;">Número de seguimiento</p>
                    <p style="margin:6px 0 0;color:#18181b;font-family:monospace;font-size:20px;font-weight:900;">${esc(input.trackingToken)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 20px;border-bottom:1px solid #e4e4e7;">
                    <p style="margin:0;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:800;">Orden</p>
                    <p style="margin:6px 0 0;color:#18181b;font-size:16px;font-weight:800;">#${esc(input.orderNumber)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 20px;border-bottom:1px solid #e4e4e7;">
                    <p style="margin:0;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:800;">Campus retiro</p>
                    <p style="margin:6px 0 0;color:#18181b;font-size:15px;font-weight:700;">${esc(input.campusName || 'Por confirmar')}</p>
                    ${input.pickupAddress ? `<p style="margin:4px 0 0;color:#71717a;font-size:13px;">${esc(input.pickupAddress)}</p>` : ''}
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:800;">Total</p>
                    <p style="margin:6px 0 0;color:#18181b;font-size:22px;font-weight:900;">${fmtCLP(input.total)}</p>
                  </td>
                </tr>
              </table>

              <a href="${trackingUrl}" style="display:block;background:#f59e0b;color:#000000;text-decoration:none;text-align:center;border-radius:18px;padding:16px 18px;font-size:15px;font-weight:900;">
                Ver seguimiento
              </a>

              <p style="margin:20px 0 0;color:#71717a;font-size:13px;line-height:1.6;text-align:center;">
                Guarda este correo para revisar el avance de tu pedido cuando quieras.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:#18181b;border-radius:0 0 24px 24px;padding:22px;text-align:center;">
              <p style="margin:0;color:#71717a;font-size:12px;">ARM Merch · ARM Global · armerch.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error, data } = await resend.emails.send({
      from: `ARM Merch <${fromEmail}>`,
      to: input.to,
      subject: `${copy.subject} · Orden #${input.orderNumber}`,
      html,
    })

    if (error) {
      console.error('[Tracking Email] Error:', error)
      return { sent: false, error: error.message }
    }

    return { sent: true, id: data?.id }
  } catch (error: any) {
    console.error('[Tracking Email] Exception:', error)
    return { sent: false, error: error?.message ?? 'Error enviando email' }
  }
}
