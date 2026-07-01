import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/api'
import { sendPurchaseThanks } from '@/lib/whatsapp/send-purchase-thanks'

/**
 * POST /api/whatsapp/send-thanks
 *
 * Envía mensaje de agradecimiento post-compra por WhatsApp.
 * Se llama automáticamente desde el POS al completar una venta (si hay teléfono).
 * Body: { phone, client_name, order_number, total, campus_name?, payment_method? }
 */
async function handler(req: NextRequest, ctx: AuthContext) {
  const body = await req.json().catch(() => ({}))

  const phone = String(body?.phone || '').trim()
  const clientName = String(body?.client_name || 'Cliente').trim()
  const orderNumber = String(body?.order_number || '').trim()
  const total = Number(body?.total || 0)
  const campusName = body?.campus_name || undefined
  const paymentMethod = body?.payment_method || undefined

  if (!phone) {
    return NextResponse.json(
      { error: 'Teléfono del cliente es obligatorio' },
      { status: 400 }
    )
  }

  const result = await sendPurchaseThanks({
    phone,
    clientName,
    orderNumber,
    total,
    campusName,
    paymentMethod,
  })

  if (!result.sent) {
    return NextResponse.json(
      {
        error: result.error || 'No se pudo enviar el agradecimiento',
        provider: result.provider,
      },
      { status: result.provider === 'skipped' ? 422 : 500 }
    )
  }

  return NextResponse.json({
    success: true,
    provider: result.provider,
  })
}

export const POST = withAuth(handler)
