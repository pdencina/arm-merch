import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/api'

const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v22.0'

/**
 * GET /api/whatsapp/status
 *
 * Verifica la conectividad con la API de WhatsApp Business.
 * Retorna estado de la configuración y info del número registrado.
 */
async function handler(req: NextRequest, ctx: AuthContext) {
  const whatsappToken = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN

  // Verificar variables de entorno
  const envStatus = {
    WHATSAPP_TOKEN: !!whatsappToken,
    WHATSAPP_PHONE_NUMBER_ID: !!phoneNumberId,
    WHATSAPP_VERIFY_TOKEN: !!verifyToken,
    WHATSAPP_GRAPH_API_VERSION: GRAPH_API_VERSION,
    WHATSAPP_TEMPLATE_PEDIDO_LISTO: process.env.WHATSAPP_TEMPLATE_PEDIDO_LISTO || '(no configurado — usa texto libre)',
    WHATSAPP_TEMPLATE_AGRADECIMIENTO: process.env.WHATSAPP_TEMPLATE_AGRADECIMIENTO || 'agradecimiento_compra',
    WHATSAPP_TEMPLATE_LINK_PAGO: process.env.WHATSAPP_TEMPLATE_LINK_PAGO || 'link_pago',
  }

  if (!whatsappToken || !phoneNumberId) {
    return NextResponse.json({
      connected: false,
      error: 'Faltan variables de entorno (WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID)',
      env: envStatus,
    })
  }

  // Consultar la API de Meta para obtener info del número
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,platform_type,status`,
      {
        headers: { Authorization: `Bearer ${whatsappToken}` },
        cache: 'no-store',
      }
    )

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      return NextResponse.json({
        connected: false,
        error: data?.error?.message || `Meta respondió ${res.status}`,
        env: envStatus,
        meta_error: data?.error,
      })
    }

    return NextResponse.json({
      connected: true,
      phone_number: data?.display_phone_number,
      verified_name: data?.verified_name,
      quality_rating: data?.quality_rating,
      platform_type: data?.platform_type,
      status: data?.status,
      env: envStatus,
    })
  } catch (error: any) {
    return NextResponse.json({
      connected: false,
      error: error?.message || 'Error de red al conectar con Meta',
      env: envStatus,
    })
  }
}

export const GET = withAuth(handler)
