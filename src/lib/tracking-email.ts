import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

type TrackingStatus =
  | 'purchase_confirmed'
  | 'pending_production'
  | 'in_production'
  | 'ready_pickup'
  | 'delivered'

type SendTrackingEmailArgs = {
  orderId: string
  status: TrackingStatus
  appUrl?: string
}

const STATUS_CONTENT: Record<TrackingStatus, { subject: (n: string | number) => string; title: string; intro: string; badge: string }> = {
  purchase_confirmed: {
    subject: (n) => `Compra confirmada — Orden #${n}`,
    title: 'Compra confirmada',
    intro: 'Recibimos tu compra correctamente. Puedes revisar el avance de tu pedido en el seguimiento.',
    badge: 'Compra confirmada',
  },
  pending_production: {
    subject: (n) => `Tu pedido #${n} fue enviado a producción`,
    title: 'Pedido en preparación',
    intro: 'Tu pedido quedó registrado y fue enviado al equipo de producción.',
    badge: 'En preparación',
  },
  in_production: {
    subject: (n) => `Tu pedido #${n} está en producción`,
    title: 'Tu pedido está en producción',
    intro: 'Nuestro equipo ya está preparando tu producto.',
    badge: 'En producción',
  },
  ready_pickup: {
    subject: (n) => `Tu pedido #${n} está listo para retiro`,
    title: '¡Tu pedido está listo!',
    intro: 'Tu pedido ya está listo para retirar en el campus indicado.',
    badge: 'Listo para retiro',
  },
  delivered: {
    subject: (n) => `Pedido #${n} entregado`,
    title: 'Pedido entregado',
    intro: 'Tu pedido fue entregado correctamente. Gracias por comprar en ARM Merch.',
    badge: 'Entregado',
  },
}

function fmt(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function esc(value: any) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function normalizeAppUrl(appUrl?: string) {
  return (appUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://armerch.com').replace(/\/$/, '')
}

function buildTimeline(current: TrackingStatus) {
  const steps: Array<{ key: TrackingStatus; label: string }> = [
    { key: 'purchase_confirmed', label: 'Compra confirmada' },
    { key: 'pending_production', label: 'En preparación' },
    { key: 'in_production', label: 'En producción' },
    { key: 'ready_pickup', label: 'Listo para retiro' },
    { key: 'delivered', label: 'Entregado' },
  ]

  const currentIndex = Math.max(0, steps.findIndex((s) => s.key === current))

  return steps
    .map((step, index) => {
      const done = index <= currentIndex
      return `
        <tr>
          <td style="width:28px;vertical-align:top;padding:8px 0;">
            <div style="width:18px;height:18px;border-radius:50%;background:${done ? '#16a34a' : '#d4d4d8'};color:white;text-align:center;font-size:12px;line-height:18px;font-weight:700;">${done ? '✓' : ''}</div>
          </td>
          <td style="padding:8px 0;font-size:14px;color:${done ? '#18181b' : '#71717a'};font-weight:${done ? '700' : '500'};">
            ${step.label}
          </td>
        </tr>
      `
    })
    .join('')
}

export async function sendTrackingEmail({ orderId, status, appUrl }: SendTrackingEmailArgs) {
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, reason: 'RESEND_API_KEY no configurada' }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return { sent: false, reason: 'Supabase admin env no configurada' }
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const [{ data: order }, { data: contact }, { data: items }] = await Promise.all([
    adminClient
      .from('orders')
      .select('id, order_number, total, tracking_token, production_status, campus_id, pickup_campus_id, created_at')
      .eq('id', orderId)
      .maybeSingle(),
    adminClient
      .from('order_contacts')
      .select('client_name, client_email')
      .eq('order_id', orderId)
      .maybeSingle(),
    adminClient
      .from('order_items')
      .select('quantity, unit_price, size, products(name, sku)')
      .eq('order_id', orderId),
  ])

  if (!order) return { sent: false, reason: 'Orden no encontrada' }
  if (!contact?.client_email) return { sent: false, reason: 'Orden sin email de cliente' }
  if (!order.tracking_token) return { sent: false, reason: 'Orden sin tracking_token' }

  const pickupCampusId = order.pickup_campus_id || order.campus_id
  const { data: campus } = pickupCampusId
    ? await adminClient.from('campus').select('name').eq('id', pickupCampusId).maybeSingle()
    : { data: null as any }

  const normalizedAppUrl = normalizeAppUrl(appUrl)
  const trackingUrl = `${normalizedAppUrl}/track/${order.tracking_token}`
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
  const content = STATUS_CONTENT[status]
  const itemRows = (items ?? [])
    .map((item: any) => {
      const product = Array.isArray(item.products) ? item.products[0] : item.products
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
            <div style="font-size:14px;color:#18181b;font-weight:600;">${esc(product?.name ?? 'Producto')}</div>
            <div style="font-size:12px;color:#71717a;margin-top:2px;">Cantidad: ${item.quantity}${item.size ? ` · Talla: ${esc(item.size)}` : ''}</div>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;font-weight:700;color:#18181b;">${fmt(Number(item.unit_price) * Number(item.quantity))}</td>
        </tr>
      `
    })
    .join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.06);">
        <tr>
          <td style="background:#18181b;padding:30px;text-align:center;">
            <div style="font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-.5px;">ARM Merch</div>
            <div style="margin-top:6px;font-size:13px;color:#a1a1aa;">Seguimiento de pedido</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 34px 22px;">
            <div style="display:inline-block;background:#f59e0b;color:#111827;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:800;margin-bottom:16px;">${esc(content.badge)}</div>
            <h1 style="margin:0 0 10px;font-size:24px;line-height:1.2;color:#18181b;">${esc(content.title)}</h1>
            <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#3f3f46;">Hola <strong>${esc(contact.client_name ?? 'Cliente')}</strong>, ${esc(content.intro)}</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #e5e7eb;border-radius:14px;margin-bottom:24px;">
              <tr>
                <td style="padding:16px 18px;border-bottom:1px solid #e5e7eb;">
                  <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.08em;">Número de seguimiento</div>
                  <div style="font-size:20px;font-weight:900;color:#18181b;margin-top:3px;">ARM-${String(order.tracking_token).slice(0, 8).toUpperCase()}</div>
                </td>
                <td style="padding:16px 18px;border-bottom:1px solid #e5e7eb;text-align:right;">
                  <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.08em;">Orden</div>
                  <div style="font-size:18px;font-weight:900;color:#18181b;margin-top:3px;">#${order.order_number}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 18px;">
                  <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.08em;">Campus retiro</div>
                  <div style="font-size:14px;font-weight:700;color:#18181b;margin-top:3px;">${esc(campus?.name ?? 'Por confirmar')}</div>
                </td>
                <td style="padding:16px 18px;text-align:right;">
                  <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.08em;">Total</div>
                  <div style="font-size:16px;font-weight:900;color:#18181b;margin-top:3px;">${fmt(Number(order.total ?? 0))}</div>
                </td>
              </tr>
            </table>

            <div style="font-size:13px;font-weight:900;color:#18181b;margin-bottom:10px;text-transform:uppercase;letter-spacing:.06em;">Avance del pedido</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:26px;">
              ${buildTimeline(status)}
            </table>

            ${itemRows ? `<div style="font-size:13px;font-weight:900;color:#18181b;margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">Productos</div><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:26px;">${itemRows}</table>` : ''}

            <div style="text-align:center;margin:28px 0 8px;">
              <a href="${trackingUrl}" style="display:inline-block;background:#f59e0b;color:#111827;text-decoration:none;font-weight:900;border-radius:14px;padding:15px 22px;">Ver seguimiento</a>
            </div>
            <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#71717a;text-align:center;">Guarda este correo. Podrás revisar el avance de tu compra usando el botón de seguimiento.</p>
          </td>
        </tr>
        <tr><td style="background:#fafafa;border-top:1px solid #e5e7eb;padding:20px 30px;text-align:center;color:#a1a1aa;font-size:12px;">ARM Merch · ARM Global · armerch.com</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: `ARM Merch <${fromEmail}>`,
    to: contact.client_email,
    subject: content.subject(order.order_number),
    html,
  })

  if (error) {
    console.error('[Tracking Email] Resend error:', error)
    return { sent: false, reason: error.message }
  }

  return { sent: true }
}
