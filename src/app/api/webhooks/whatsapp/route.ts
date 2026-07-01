import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!

/**
 * GET /api/webhooks/whatsapp
 * Verificación del webhook por Meta (challenge handshake)
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams

  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse('Verification failed', { status: 403 })
}

/**
 * POST /api/webhooks/whatsapp
 * Recibe notificaciones de Meta: mensajes entrantes, status updates, etc.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Meta siempre envía un objeto con "entry" que contiene los cambios
    const entries = body?.entry ?? []

    for (const entry of entries) {
      const changes = entry?.changes ?? []

      for (const change of changes) {
        const value = change?.value
        if (!value) continue

        // ─── Status updates (mensajes enviados: sent, delivered, read) ───
        const statuses = value?.statuses ?? []
        for (const status of statuses) {
          await handleStatusUpdate(status)
        }

        // ─── Mensajes entrantes del cliente ───
        const messages = value?.messages ?? []
        const contacts = value?.contacts ?? []

        for (const message of messages) {
          const contact = contacts.find(
            (c: any) => c?.wa_id === message?.from
          )
          await handleIncomingMessage(message, contact)
        }
      }
    }

    // Meta espera un 200 siempre
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[WhatsApp Webhook] Error processing:', error)
    // Aún así retornamos 200 para que Meta no reintente
    return NextResponse.json({ received: true })
  }
}

// ─── Handlers ──────────────────────────────────────────────────────────────

/**
 * Maneja actualizaciones de estado de mensajes enviados.
 * Posibles: sent, delivered, read, failed
 */
async function handleStatusUpdate(status: any) {
  const messageId = status?.id
  const statusValue = status?.status // sent | delivered | read | failed
  const recipientId = status?.recipient_id
  const timestamp = status?.timestamp

  if (!messageId || !statusValue) return

  // Registrar en log para trazabilidad
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) return

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  await supabase.from('whatsapp_logs').insert({
    direction: 'status',
    phone: recipientId || null,
    message_id: messageId,
    status: statusValue,
    payload: status,
    created_at: timestamp
      ? new Date(Number(timestamp) * 1000).toISOString()
      : new Date().toISOString(),
  }).then(() => {})  // No bloquear si falla
}

/**
 * Maneja mensajes entrantes de clientes.
 * Por ahora solo los registra. Se puede extender para respuestas automáticas.
 */
async function handleIncomingMessage(message: any, contact: any) {
  const from = message?.from // número del remitente
  const messageType = message?.type // text, image, document, etc.
  const messageId = message?.id
  const timestamp = message?.timestamp
  const contactName = contact?.profile?.name || null

  if (!from || !messageId) return

  // Extraer texto del mensaje
  let text = ''
  if (messageType === 'text') {
    text = message?.text?.body || ''
  } else if (messageType === 'button') {
    text = message?.button?.text || ''
  } else if (messageType === 'interactive') {
    text = message?.interactive?.button_reply?.title ||
           message?.interactive?.list_reply?.title || ''
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) return

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  await supabase.from('whatsapp_logs').insert({
    direction: 'incoming',
    phone: from,
    message_id: messageId,
    message_type: messageType,
    text: text || null,
    contact_name: contactName,
    payload: message,
    created_at: timestamp
      ? new Date(Number(timestamp) * 1000).toISOString()
      : new Date().toISOString(),
  }).then(() => {})  // No bloquear si falla
}
