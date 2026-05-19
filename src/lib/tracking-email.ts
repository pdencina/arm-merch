import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

export type TrackingEmailStatus =
  | 'confirmed'
  | 'purchase_confirmed'
  | 'pending_production'
  | 'in_preparation'
  | 'in_production'
  | 'ready_pickup'
  | 'delivered'
  | 'cancelled'

type TrackingEmailInput = {
  // Modo simple usado por fulfillment:
  // sendTrackingEmail({ orderId, status, appUrl })
  orderId?: string

  // Modo completo usado por otros endpoints:
  to?: string
  clientName?: string | null
  orderNumber?: string | number
  trackingToken?: string | null
  status: TrackingEmailStatus
  campusName?: string | null
  pickupAddress?: string | null
  total?: number | null
  items?: Array<{
    quantity: number
    unit_price?: number | null
    size?: string | null
    fulfillment_type?: string | null
    product_name?: string | null
  }>
  appUrl?: string | null
}

type ResolvedEmailData = {
  to: string
  clientName?: string | null
  orderNumber: string | number
  trackingToken: string
  status: TrackingEmailStatus
  campusName?: string | null
  pickupAddress?: string | null
  total?: number | null
  items?: Array<{
    quantity: number
    unit_price?: number | null
    size?: string | null
    fulfillment_type?: string | null
    product_name?: string | null
  }>
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
    message:
      'Recibimos tu pedido correctamente. Puedes revisar el avance desde el botón de seguimiento.',
    color: '#16a34a',
  },
  purchase_confirmed: {
    subject: 'Compra confirmada',
    title: 'Tu compra fue confirmada',
    eyebrow: 'Compra confirmada',
    message:
      'Recibimos tu pedido correctamente. Puedes revisar el avance desde el botón de seguimiento.',
    color: '#16a34a',
  },
  pending_production: {
    subject: 'Pedido recibido',
    title: 'Recibimos tu pedido',
    eyebrow: 'Pedido recibido',
    message: 'Tu pedido ya está en nuestra cola de preparación.',
    color: '#f59e0b',
  },
  in_preparation: {
    subject: 'Tu pedido está en preparación',
    title: 'Tu pedido está en preparación',
    eyebrow: 'En preparación',
    message: 'Estamos preparando los detalles de tu pedido.',
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

function buildTrackingTokenFallback(orderNumber: string | number) {
  return `ARM-${String(orderNumber).padStart(6, '0')}`
}

async function resolveEmailData(input: TrackingEmailInput): Promise<ResolvedEmailData | null> {
  // Si viene completo, no consultamos BD.
  if (input.to && input.orderNumber && input.trackingToken) {
    return {
      to: input.to,
      clientName: input.clientName,
      orderNumber: input.orderNumber,
      trackingToken: input.trackingToken,
      status: input.status,
      campusName: input.campusName,
      pickupAddress: input.pickupAddress,
      total: input.total,
      items: input.items,
      appUrl: input.appUrl,
    }
  }

  // Si viene orderId, consultamos BD.
  if (!input.orderId) {
    console.warn('[Tracking Email] Faltan datos: se requiere orderId o payload completo')
    return null
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[Tracking Email] Supabase admin env no configurada')
    return null
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data: order, error: orderError } = await adminClient
    .from('orders')
    .select(
      `
      id,
      order_number,
      tracking_token,
      total,
      campus_id,
      pickup_campus_id
    `,
    )
    .eq('id', input.orderId)
    .maybeSingle()

  if (orderError || !order) {
    console.error('[Tracking Email] Orden no encontrada:', orderError)
    return null
  }

  const [
    { data: contact },
    { data: campus },
    { data: pickupCampus },
  ] = await Promise.all([
    adminClient
      .from('order_contacts')
      .select('client_name, client_email, client_phone')
      .eq('order_id', input.orderId)
      .maybeSingle(),

    order.campus_id
      ? adminClient
          .from('campus')
          .select('id, name, address')
          .eq('id', order.campus_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    order.pickup_campus_id
      ? adminClient
          .from('campus')
          .select('id, name, address')
          .eq('id', order.pickup_campus_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const email = contact?.client_email

  if (!email) {
    console.warn('[Tracking Email] La orden no tiene email de cliente')
    return null
  }

  const { data: orderItems } = await adminClient
    .from('order_items')
    .select(`
      quantity,
      unit_price,
      size,
      fulfillment_type,
      products (
        name
      )
    `)
    .eq('order_id', input.orderId)

  const destinationCampus =
    pickupCampus?.name
      ? pickupCampus
      : campus?.name
        ? campus
        : null

  return {
    to: email,
    clientName: contact?.client_name,
    orderNumber: order.order_number,
    trackingToken:
      order.tracking_token || buildTrackingTokenFallback(order.order_number),
    status: input.status,
    campusName: destinationCampus?.name,
    pickupAddress: destinationCampus?.address,
    total: order.total,
    items: (orderItems || []).map((item: any) => ({
      quantity: Number(item.quantity || 0),
      unit_price: Number(item.unit_price || 0),
      size: item.size || null,
      fulfillment_type: item.fulfillment_type || 'immediate',
      product_name: item.products?.name || 'Producto',
    })),
    appUrl: input.appUrl,
  }
}

export async function sendTrackingEmail(input: TrackingEmailInput) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Tracking Email] RESEND_API_KEY no configurada')
    return { sent: false, error: 'RESEND_API_KEY no configurada' }
  }

  const data = await resolveEmailData(input)

  if (!data) {
    return { sent: false, error: 'No se pudo resolver información del correo' }
  }

  if (!data.to?.includes('@')) {
    return { sent: false, error: 'Email inválido' }
  }

  const appUrl =
    data.appUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'https://armerch.com'

  const copy = STATUS_COPY[data.status] ?? STATUS_COPY.confirmed
  const trackingUrl = `${String(appUrl).replace(/\/$/, '')}/track/${encodeURIComponent(data.trackingToken)}`
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'no-reply@armerch.com'

  const productionItems = (data.items || []).filter(
    (item) => item.fulfillment_type === 'production',
  )

  const immediateItems = (data.items || []).filter(
    (item) => item.fulfillment_type !== 'production',
  )

  const renderItemsRows = (items: NonNullable<typeof data.items>) =>
    items
      .map((item) => {
        const isProduction = item.fulfillment_type === 'production'
        const lineTotal = Number(item.unit_price || 0) * Number(item.quantity || 0)

        return `
          <tr>
            <td style="padding:13px 0;border-bottom:1px solid #e4e4e7;">
              <p style="margin:0;color:#18181b;font-size:14px;font-weight:800;">${esc(item.product_name || 'Producto')}</p>
              ${item.size ? `<p style="margin:4px 0 0;color:#71717a;font-size:12px;">Talla: ${esc(item.size)}</p>` : ''}
              <p style="margin:6px 0 0;color:${isProduction ? '#7c3aed' : '#16a34a'};font-size:12px;font-weight:800;">
                ${isProduction ? 'Pendiente producción' : 'Entrega inmediata'}
              </p>
            </td>
            <td style="padding:13px 0;border-bottom:1px solid #e4e4e7;text-align:center;color:#18181b;font-size:13px;font-weight:800;">
              x${Number(item.quantity || 0)}
            </td>
            <td style="padding:13px 0;border-bottom:1px solid #e4e4e7;text-align:right;color:#18181b;font-size:13px;font-weight:900;">
              ${fmtCLP(lineTotal)}
            </td>
          </tr>`
      })
      .join('')

  const productionItemsHtml = renderItemsRows(productionItems)
  const immediateItemsHtml = renderItemsRows(immediateItems)
  const hasItemsHtml = Boolean(productionItemsHtml || immediateItemsHtml)

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
                Hola <strong>${esc(data.clientName || 'Cliente')}</strong>, ${esc(copy.message)}
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#f4f4f5;border-radius:18px;overflow:hidden;">
                <tr>
                  <td style="padding:18px 20px;border-bottom:1px solid #e4e4e7;">
                    <p style="margin:0;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:800;">Número de seguimiento</p>
                    <p style="margin:6px 0 0;color:#18181b;font-family:monospace;font-size:20px;font-weight:900;">${esc(data.trackingToken)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 20px;border-bottom:1px solid #e4e4e7;">
                    <p style="margin:0;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:800;">Orden</p>
                    <p style="margin:6px 0 0;color:#18181b;font-size:16px;font-weight:800;">#${esc(data.orderNumber)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 20px;border-bottom:1px solid #e4e4e7;">
                    <p style="margin:0;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:800;">Campus retiro</p>
                    <p style="margin:6px 0 0;color:#18181b;font-size:15px;font-weight:700;">${esc(data.campusName || 'Por confirmar')}</p>
                    ${data.pickupAddress ? `<p style="margin:4px 0 0;color:#71717a;font-size:13px;">${esc(data.pickupAddress)}</p>` : ''}
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:800;">Total</p>
                    <p style="margin:6px 0 0;color:#18181b;font-size:22px;font-weight:900;">${fmtCLP(data.total)}</p>
                  </td>
                </tr>
              </table>

              ${hasItemsHtml ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#ffffff;border:1px solid #e4e4e7;border-radius:18px;overflow:hidden;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 14px;color:#18181b;font-size:16px;font-weight:900;">Detalle de compra</p>

                    ${productionItemsHtml ? `
                      <p style="margin:12px 0 8px;color:#7c3aed;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;">Productos en producción</p>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <thead>
                          <tr>
                            <th style="padding:0 0 10px;text-align:left;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Producto</th>
                            <th style="padding:0 0 10px;text-align:center;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Cant.</th>
                            <th style="padding:0 0 10px;text-align:right;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Total</th>
                          </tr>
                        </thead>
                        <tbody>${productionItemsHtml}</tbody>
                      </table>
                    ` : ''}

                    ${immediateItemsHtml ? `
                      <p style="margin:18px 0 8px;color:#16a34a;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;">Productos entregados</p>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <thead>
                          <tr>
                            <th style="padding:0 0 10px;text-align:left;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Producto</th>
                            <th style="padding:0 0 10px;text-align:center;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Cant.</th>
                            <th style="padding:0 0 10px;text-align:right;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Total</th>
                          </tr>
                        </thead>
                        <tbody>${immediateItemsHtml}</tbody>
                      </table>
                    ` : ''}
                  </td>
                </tr>
              </table>
              ` : ''}

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
    const { error, data: resendData } = await resend.emails.send({
      from: `ARM Merch <${fromEmail}>`,
      to: data.to,
      subject: `${copy.subject} · Orden #${data.orderNumber}`,
      html,
    })

    if (error) {
      console.error('[Tracking Email] Error:', error)
      return { sent: false, error: error.message }
    }

    return { sent: true, id: resendData?.id }
  } catch (error: any) {
    console.error('[Tracking Email] Exception:', error)
    return { sent: false, error: error?.message ?? 'Error enviando email' }
  }
}
