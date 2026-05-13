import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const STATUS_CONFIG: Record<string, { title: string; message: string }> = {
  pending_production: {
    title: 'En preparación',
    message: 'Tu pedido quedó pendiente para producción.',
  },
  in_production: {
    title: 'En producción',
    message: 'Tu producto está siendo preparado por nuestro equipo.',
  },
  ready_pickup: {
    title: 'Listo para retiro',
    message: 'Tu pedido está listo para retirar en el campus indicado.',
  },
  delivered: {
    title: 'Entregado',
    message: 'Tu pedido fue entregado correctamente.',
  },
}

function getAppUrl(req: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    req.headers.get('origin') ||
    'https://armerch.com'
  ).replace(/\/$/, '')
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '').trim()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json({ error: 'Faltan variables de entorno' }, { status: 500 })
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: { user }, error: userError } = await authClient.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { status } = await req.json().catch(() => ({}))
    const nextStatus = String(status ?? '')

    if (!STATUS_CONFIG[nextStatus]) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role, campus_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, order_number, campus_id, pickup_campus_id, tracking_token, production_status')
      .eq('id', params.id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    const isSuperAdmin = profile.role === 'super_admin'
    const sameCampus = profile.campus_id === (order.pickup_campus_id || order.campus_id)

    if (!isSuperAdmin && !(nextStatus === 'delivered' && sameCampus)) {
      return NextResponse.json({ error: 'No autorizado para cambiar este estado' }, { status: 403 })
    }

    const updatePayload: Record<string, any> = {
      production_status: nextStatus,
    }

    if (nextStatus === 'ready_pickup') updatePayload.ready_at = new Date().toISOString()
    if (nextStatus === 'delivered') {
      updatePayload.delivered_at = new Date().toISOString()
      updatePayload.delivered_by = profile.id
    }

    const { error: updateError } = await adminClient
      .from('orders')
      .update(updatePayload)
      .eq('id', order.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    const config = STATUS_CONFIG[nextStatus]

    await adminClient.from('order_status_history').insert({
      order_id: order.id,
      status: nextStatus,
      title: config.title,
      message: config.message,
      created_by: profile.id,
    })

    let emailSent = false

    if (nextStatus === 'ready_pickup' && process.env.RESEND_API_KEY) {
      try {
        const [{ data: contact }, { data: campus }] = await Promise.all([
          adminClient
            .from('order_contacts')
            .select('client_name, client_email')
            .eq('order_id', order.id)
            .maybeSingle(),
          adminClient
            .from('campus')
            .select('name')
            .eq('id', order.pickup_campus_id || order.campus_id)
            .maybeSingle(),
        ])

        if (contact?.client_email) {
          const { Resend } = await import('resend')
          const resend = new Resend(process.env.RESEND_API_KEY)
          const appUrl = getAppUrl(req)
          const trackingUrl = `${appUrl}/track/${order.tracking_token}`
          const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

          const { error } = await resend.emails.send({
            from: `ARM Merch <${fromEmail}>`,
            to: contact.client_email,
            subject: `Tu pedido #${order.order_number} está listo para retiro`,
            html: `
              <div style="font-family:Arial,sans-serif;background:#f4f4f5;padding:32px;">
                <div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;">
                  <div style="background:#18181b;color:#fff;padding:28px;text-align:center;">
                    <h1 style="margin:0;font-size:24px;">ARM Merch</h1>
                    <p style="margin:8px 0 0;color:#a1a1aa;">Pedido listo para retiro</p>
                  </div>
                  <div style="padding:32px;color:#18181b;">
                    <h2 style="margin:0 0 12px;">¡Tu pedido está listo! 🙌</h2>
                    <p>Hola <strong>${contact.client_name ?? 'Cliente'}</strong>, tu pedido <strong>#${order.order_number}</strong> ya está listo para retirar.</p>
                    <p><strong>Campus de retiro:</strong> ${campus?.name ?? 'Campus informado por el equipo'}</p>
                    <p style="margin:28px 0;">
                      <a href="${trackingUrl}" style="background:#f59e0b;color:#000;padding:14px 20px;border-radius:12px;text-decoration:none;font-weight:700;display:inline-block;">Ver seguimiento</a>
                    </p>
                    <p style="font-size:13px;color:#71717a;">Presenta tu número de orden al momento de retirar.</p>
                  </div>
                </div>
              </div>
            `,
          })

          if (!error) emailSent = true
          else console.error('Ready pickup email error:', error)
        }
      } catch (emailError) {
        console.error('Ready pickup email exception:', emailError)
      }
    }

    return NextResponse.json({
      success: true,
      status: nextStatus,
      email_sent: emailSent,
    })
  } catch (error: any) {
    console.error('PATCH /api/orders/[id]/fulfillment error:', error)
    return NextResponse.json({ error: error?.message ?? 'Error interno' }, { status: 500 })
  }
}
