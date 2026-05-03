import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── POST /api/whatsapp ───────────────────────────────────────────────────────
// Envía notificación WhatsApp al cliente cuando su pedido está listo.
// Llamado desde deliveries/page.tsx al marcar un pedido como 'ready'.
// ─────────────────────────────────────────────────────────────────────────────

function formatPhone(phone: string): string {
  // Normalizar a formato internacional chileno
  const clean = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '')
  if (clean.startsWith('+')) return clean
  if (clean.startsWith('56')) return `+${clean}`
  if (clean.startsWith('9') && clean.length === 9) return `+56${clean}`
  return `+56${clean}`
}

function buildMessage(
  clientName: string,
  items: { name: string; size?: string | null; quantity: number }[],
  campusName: string,
  paymentUrl?: string | null,
  totalAmount?: number | null,
): string {
  const firstName = clientName.split(' ')[0]

  const productLines = items
    .map(i => {
      const size = i.size ? ` (Talla ${i.size})` : ''
      return `• ${i.name}${size} × ${i.quantity}`
    })
    .join('\n')

  const fmtCLP = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

  // Payment link message
  if (paymentUrl) {
    return `¡Hola ${firstName}! 👋

Tu pedido de ARM Merch está listo para pagar:

${productLines}

💳 Total: ${totalAmount ? fmtCLP(totalAmount) : ''}

Paga con tarjeta, Apple Pay o Google Pay aquí:
${paymentUrl}

¡Te esperamos! — Equipo ARM Merch`
  }

  // Ready for pickup message
  return `¡Hola ${firstName}! 🎉

Tu pedido de ARM Merch está listo para retirar:

${productLines}

📍 Puedes retirarlo en: ${campusName}

¡Te esperamos pronto! — Equipo ARM Merch`
}

const log = (...args: any[]) => process.env.NODE_ENV !== 'production' && console.log(...args)


export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '').trim()

    const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnon   = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const authClient = createClient(supabaseUrl, supabaseAnon)
    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Twilio credentials
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken  = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_WHATSAPP_FROM // e.g. whatsapp:+14155238886

    if (!accountSid || !authToken || !fromNumber) {
      return NextResponse.json(
        { error: 'Twilio no configurado. Agrega TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_WHATSAPP_FROM en Vercel.' },
        { status: 500 }
      )
    }

    // Parse body
    const body = await req.json()
    const { phone, client_name, items, campus_name, order_id, payment_url, total_amount } = body

    if (!phone || !client_name || !items?.length || !campus_name) {
      return NextResponse.json({ error: 'Faltan datos: phone, client_name, items, campus_name' }, { status: 400 })
    }

    const toNumber  = `whatsapp:${formatPhone(phone)}`
    const message   = buildMessage(client_name, items, campus_name, payment_url, total_amount)

    // Send via Twilio REST API (no need to install twilio package)
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

    const params = new URLSearchParams({
      From: fromNumber,
      To:   toNumber,
      Body: message,
    })

    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      },
      body: params.toString(),
    })

    const twilioData = await twilioRes.json().catch(() => null)

    if (!twilioRes.ok) {
      console.error('[WhatsApp] Twilio error:', JSON.stringify(twilioData))
      // Return the full Twilio error for debugging
      return NextResponse.json(
        {
          error: twilioData?.message ?? 'Error al enviar WhatsApp',
          code: twilioData?.code,
          status: twilioData?.status,
          more_info: twilioData?.more_info,
          to: toNumber,
          from: fromNumber,
        },
        { status: 400 }
      )
    }

    // Log in Supabase (opcional — para auditoría)
    if (order_id) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      await adminClient.from('delivery_updates').insert({
        order_id,
        from_status: 'ready',
        to_status:   'ready',
        notes:       `WhatsApp enviado a ${formatPhone(phone)}`,
      }).then(() => {})  // fire and forget
    }

    log('[WhatsApp] Sent to', toNumber, '| SID:', twilioData?.sid)

    return NextResponse.json({
      success: true,
      sid: twilioData?.sid,
      to: toNumber,
    })
  } catch (error: any) {
    console.error('[WhatsApp] Error:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Error interno' },
      { status: 500 }
    )
  }
}
