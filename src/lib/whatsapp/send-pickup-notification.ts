/**
 * WhatsApp — Notificación de pedido listo para retiro
 *
 * Se dispara automáticamente cuando una orden de producción
 * pasa a estado "ready_pickup".
 */

const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v22.0'

function normalizePhone(input: string) {
  const digits = String(input || '').replace(/\D/g, '')

  if (!digits) return ''
  if (digits.startsWith('56')) return digits
  if (digits.startsWith('9') && digits.length === 9) return `56${digits}`
  if (digits.length === 8) return `569${digits}`

  return digits
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

export interface PickupNotificationParams {
  phone: string
  clientName: string
  orderNumber: string | number
  campusName: string
  balanceDue: number
  trackingUrl?: string | null
  products?: string[]
}

export interface PickupNotificationResult {
  sent: boolean
  provider: 'whatsapp_template' | 'whatsapp_text' | 'skipped'
  error?: string
  meta?: any
}

/**
 * Envía notificación de retiro por WhatsApp.
 *
 * Modos:
 * 1. Template aprobado por Meta (`pedido_listo` o configurable via env)
 * 2. Mensaje de texto libre (fallback si no hay template configurado)
 * 3. Skip si faltan credenciales
 */
export async function sendPickupNotification(
  params: PickupNotificationParams
): Promise<PickupNotificationResult> {
  const {
    phone: rawPhone,
    clientName,
    orderNumber,
    campusName,
    balanceDue,
    trackingUrl,
    products,
  } = params

  const phone = normalizePhone(rawPhone)

  if (!phone) {
    return { sent: false, provider: 'skipped', error: 'Sin teléfono del cliente' }
  }

  const whatsappToken = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!whatsappToken || !phoneNumberId) {
    return { sent: false, provider: 'skipped', error: 'Faltan credenciales WhatsApp (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)' }
  }

  const templateName = process.env.WHATSAPP_TEMPLATE_PEDIDO_LISTO || ''
  const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'es_CL'

  // Si hay template configurado, usar template; si no, texto libre
  if (templateName) {
    return sendWithTemplate({
      phone,
      clientName,
      orderNumber,
      campusName,
      balanceDue,
      trackingUrl,
      whatsappToken,
      phoneNumberId,
      templateName,
      templateLanguage,
    })
  }

  return sendAsText({
    phone,
    clientName,
    orderNumber,
    campusName,
    balanceDue,
    trackingUrl,
    products,
    whatsappToken,
    phoneNumberId,
  })
}

// ─── Template mode ──────────────────────────────────────────────────────────

async function sendWithTemplate(opts: {
  phone: string
  clientName: string
  orderNumber: string | number
  campusName: string
  balanceDue: number
  trackingUrl?: string | null
  whatsappToken: string
  phoneNumberId: string
  templateName: string
  templateLanguage: string
}): Promise<PickupNotificationResult> {
  const {
    phone, clientName, orderNumber, campusName, balanceDue,
    whatsappToken, phoneNumberId, templateName, templateLanguage,
  } = opts

  // Template variables:
  // {{1}} = nombre cliente
  // {{2}} = número de orden
  // {{3}} = campus de retiro
  // {{4}} = saldo pendiente o "Pagado"
  const balanceText = balanceDue > 0
    ? `Saldo pendiente: ${formatCurrency(balanceDue)}`
    : 'Sin saldo pendiente ✅'

  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLanguage },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: clientName },
            { type: 'text', text: String(orderNumber) },
            { type: 'text', text: campusName },
            { type: 'text', text: balanceText },
          ],
        },
      ],
    },
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
      }
    )

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      console.error('[WhatsApp Pickup Template] Error:', data)
      return {
        sent: false,
        provider: 'whatsapp_template',
        error: data?.error?.message || `Meta respondió ${res.status}`,
        meta: data,
      }
    }

    return { sent: true, provider: 'whatsapp_template', meta: data }
  } catch (err: any) {
    console.error('[WhatsApp Pickup Template] Exception:', err)
    return { sent: false, provider: 'whatsapp_template', error: err?.message }
  }
}

// ─── Text message mode (no template needed) ─────────────────────────────────

async function sendAsText(opts: {
  phone: string
  clientName: string
  orderNumber: string | number
  campusName: string
  balanceDue: number
  trackingUrl?: string | null
  products?: string[]
  whatsappToken: string
  phoneNumberId: string
}): Promise<PickupNotificationResult> {
  const {
    phone, clientName, orderNumber, campusName, balanceDue,
    trackingUrl, products, whatsappToken, phoneNumberId,
  } = opts

  let message = `Hola ${clientName} 👋\n\n`
  message += `Tu pedido #${orderNumber} de ARM Merch ya está listo para retiro 🎉\n\n`

  if (products && products.length > 0) {
    message += `📦 Productos:\n`
    products.forEach(p => { message += `• ${p}\n` })
    message += '\n'
  }

  message += `📍 Retira en: ${campusName}\n`

  if (balanceDue > 0) {
    message += `💰 Saldo pendiente: ${formatCurrency(balanceDue)}\n`
    message += `   (Se paga al momento del retiro)\n`
  }

  if (trackingUrl) {
    message += `\n🔗 Seguimiento: ${trackingUrl}\n`
  }

  message += `\nGracias por apoyar ARM ❤️`

  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'text',
    text: { body: message },
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
      }
    )

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      console.error('[WhatsApp Pickup Text] Error:', data)
      return {
        sent: false,
        provider: 'whatsapp_text',
        error: data?.error?.message || `Meta respondió ${res.status}`,
        meta: data,
      }
    }

    return { sent: true, provider: 'whatsapp_text', meta: data }
  } catch (err: any) {
    console.error('[WhatsApp Pickup Text] Exception:', err)
    return { sent: false, provider: 'whatsapp_text', error: err?.message }
  }
}
