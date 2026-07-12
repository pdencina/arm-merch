/**
 * n8n Integration — Envía eventos del ciclo de compra a n8n
 *
 * n8n recibe estos eventos via webhook y ejecuta flujos de WhatsApp,
 * emails, notificaciones, etc.
 *
 * Eventos soportados:
 * - order_paid: Venta completada exitosamente
 * - order_production: Pedido enviado a producción
 * - order_ready: Pedido listo para retiro
 * - order_delivered: Pedido entregado al cliente
 * - order_refunded: Devolución procesada
 */

export type N8nEventType =
  | 'order_paid'
  | 'order_production'
  | 'order_ready'
  | 'order_delivered'
  | 'order_refunded'

export interface N8nEventPayload {
  event: N8nEventType
  timestamp: string
  order_id: string
  order_number: number | string
  client_name: string
  client_phone?: string | null
  client_email?: string | null
  total: number
  amount_paid?: number
  balance_due?: number
  payment_method?: string | null
  campus_name?: string | null
  campus_id?: string | null
  items?: Array<{
    name: string
    quantity: number
    size?: string | null
    variant_value?: string | null
    unit_price: number
  }>
  // Extras según el evento
  tracking_url?: string | null
  delivery_notes?: string | null
  refund_amount?: number
}

/**
 * Envía un evento a n8n de forma fire-and-forget.
 * Si N8N_WEBHOOK_URL no está configurado, no hace nada (silencioso).
 */
export async function sendN8nEvent(payload: N8nEventPayload): Promise<void> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL

  if (!webhookUrl) return // n8n no configurado, skip silenciosamente

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })
  } catch (error) {
    // Fire-and-forget: no bloquea la operación si n8n falla
    console.error('[n8n] Error enviando evento:', error)
  }
}
