/**
 * WhatsApp — Mensaje de agradecimiento post-compra
 *
 * Se envía automáticamente después de confirmar una venta
 * cuando el cliente tiene teléfono registrado.
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
  provider: 'whatsapp_text' | 'skipped'
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
  const templateName = process.env.WHATSAPP_TEMPLATE_AGRADECIMIENTO || 'agradecimiento_compra'
  const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'es_CL'

  // Usar template si está configurado
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
      console.error('[WhatsApp Thanks] Error:', data?.error?.message)
      return { sent: false, provider: 'whatsapp_text', error: data?.error?.message || `Meta ${res.status}` }
    }

    return { sent: true, provider: 'whatsapp_text' }
  } catch (err: any) {
    return { sent: false, provider: 'whatsapp_text', error: err?.message }
  }
}
