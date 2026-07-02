/**
 * WhatsApp — Mensaje de agradecimiento post-compra
 *
 * Se envía automáticamente después de confirmar una venta
 * cuando el cliente tiene teléfono registrado.
 *
 * Modos:
 * 1. Template aprobado por Meta (si WHATSAPP_TEMPLATE_AGRADECIMIENTO está configurado)
 * 2. Texto libre (default — funciona dentro de la ventana de 24h)
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

export interface PurchaseThanksParams {
  phone: string
  clientName: string
  orderNumber: string | number
  total: number
  campusName?: string
  paymentMethod?: string
}

export interface PurchaseThanksResult {
  sent: boolean
  provider: 'whatsapp_template' | 'whatsapp_text' | 'skipped'
  error?: string
}

export async function sendPurchaseThanks(
  params: PurchaseThanksParams
): Promise<PurchaseThanksResult> {
  const { phone: rawPhone, clientName, orderNumber, total, campusName, paymentMethod } = params

  const phone = normalizePhone(rawPhone)

  if (!phone) {
    return { sent: false, provider: 'skipped', error: 'Sin teléfono' }
  }

  const whatsappToken = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!whatsappToken || !phoneNumberId) {
    return { sent: false, provider: 'skipped', error: 'Faltan credenciales WhatsApp' }
  }

  const firstName = clientName.split(' ')[0] || 'Cliente'
  const templateName = process.env.WHATSAPP_TEMPLATE_AGRADECIMIENTO || ''

  // Si hay template configurado, usar template (funciona fuera de las 24h)
  if (templateName) {
    return sendWithTemplate({
      phone, firstName, orderNumber, total,
      whatsappToken, phoneNumberId, templateName,
    })
  }

  // Default: texto libre (funciona si el cliente escribió en las últimas 24h)
  return sendAsText({
    phone, firstName, orderNumber, total, campusName,
    whatsappToken, phoneNumberId,
  })
}

// ─── Template mode ──────────────────────────────────────────────────────────

async function sendWithTemplate(opts: {
  phone: string
  firstName: string
  orderNumber: string | number
  total: number
  whatsappToken: string
  phoneNumberId: string
  templateName: string
}): Promise<PurchaseThanksResult> {
  const { phone, firstName, orderNumber, total, whatsappToken, phoneNumberId, templateName } = opts
  const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'es_CL'

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
            { type: 'text', text: firstName },
            { type: 'text', text: String(orderNumber) },
            { type: 'text', text: formatCurrency(total) },
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
      console.error('[WhatsApp Thanks Template] Error:', data?.error?.message)
      return { sent: false, provider: 'whatsapp_template', error: data?.error?.message || `Meta ${res.status}` }
    }

    return { sent: true, provider: 'whatsapp_template' }
  } catch (err: any) {
    return { sent: false, provider: 'whatsapp_template', error: err?.message }
  }
}

// ─── Text mode (default) ────────────────────────────────────────────────────

async function sendAsText(opts: {
  phone: string
  firstName: string
  orderNumber: string | number
  total: number
  campusName?: string
  whatsappToken: string
  phoneNumberId: string
}): Promise<PurchaseThanksResult> {
  const { phone, firstName, orderNumber, total, campusName, whatsappToken, phoneNumberId } = opts

  const campus = campusName || 'ARM Merch'

  const message = [
    `Hola ${firstName} 👋`,
    ``,
    `¡Gracias por tu compra en ${campus}! 🙏`,
    ``,
    `🧾 Pedido #${orderNumber}`,
    `💰 Total: ${formatCurrency(total)}`,
    ``,
    `Bendiciones y gracias por apoyar ARM ❤️`,
  ].join('\n')

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
      console.error('[WhatsApp Thanks Text] Error:', data?.error?.message)
      return { sent: false, provider: 'whatsapp_text', error: data?.error?.message || `Meta ${res.status}` }
    }

    return { sent: true, provider: 'whatsapp_text' }
  } catch (err: any) {
    return { sent: false, provider: 'whatsapp_text', error: err?.message }
  }
}
