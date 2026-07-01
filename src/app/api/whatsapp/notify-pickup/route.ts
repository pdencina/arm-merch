import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/api'
import { sendPickupNotification } from '@/lib/whatsapp/send-pickup-notification'

/**
 * POST /api/whatsapp/notify-pickup
 *
 * Envía notificación de pedido listo para retiro por WhatsApp.
 * Body: { phone, client_name, order_number, campus_name, balance_due?, products? }
 */
async function handler(req: NextRequest, ctx: AuthContext) {
  const body = await req.json().catch(() => ({}))

  const phone = String(body?.phone || '').trim()
  const clientName = String(body?.client_name || 'Cliente').trim()
  const orderNumber = String(body?.order_number || '').trim()
  const campusName = String(body?.campus_name || 'tu campus ARM').trim()
  const balanceDue = Number(body?.balance_due || 0)
  const trackingUrl = body?.tracking_url || null
  const products = Array.isArray(body?.products) ? body.products : []

  if (!phone) {
    return NextResponse.json(
      { error: 'Teléfono del cliente es obligatorio' },
      { status: 400 }
    )
  }

  // Convertir items a nombres de productos para el mensaje
  const productNames: string[] = products.map((p: any) => {
    const name = p?.name || 'Producto'
    const size = p?.size ? ` (Talla ${p.size})` : ''
    const qty = p?.quantity ? ` ×${p.quantity}` : ''
    return `${name}${size}${qty}`
  })

  const result = await sendPickupNotification({
    phone,
    clientName,
    orderNumber,
    campusName,
    balanceDue,
    trackingUrl,
    products: productNames.length > 0 ? productNames : undefined,
  })

  if (!result.sent) {
    return NextResponse.json(
      {
        error: result.error || 'No se pudo enviar la notificación',
        provider: result.provider,
      },
      { status: result.provider === 'skipped' ? 422 : 500 }
    )
  }

  return NextResponse.json({
    success: true,
    provider: result.provider,
    meta: result.meta,
  })
}

export const POST = withAuth(handler, { permission: 'deliveries.whatsapp' })
