import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTrackingEmail } from '@/lib/tracking-email'
import { sendPickupNotification } from '@/lib/whatsapp/send-pickup-notification'

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

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending_production: ['in_production'],
  in_production: ['ready_pickup'],
  ready_pickup: ['delivered'],
  delivered: [],
  not_required: ['pending_production'],
}

function getAppUrl(req: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    req.headers.get('origin') ||
    'https://armerch.com'
  ).replace(/\/$/, '')
}

function getItemTimestampPayload(nextStatus: string) {
  const now = new Date().toISOString()

  if (nextStatus === 'in_production') {
    return {
      production_started_at: now,
    }
  }

  if (nextStatus === 'ready_pickup') {
    return {
      ready_pickup_at: now,
    }
  }

  if (nextStatus === 'delivered') {
    return {
      delivered_at: now,
    }
  }

  return {}
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
      .select('id, order_number, campus_id, pickup_campus_id, tracking_token, production_status, status')
      .eq('id', params.id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    if (order.status !== 'paid') {
      return NextResponse.json(
        { error: 'Solo se puede avanzar producción de órdenes pagadas' },
        { status: 400 }
      )
    }

    const currentStatus = String(order.production_status ?? 'pending_production')
    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? []
    if (!allowed.includes(nextStatus)) {
      return NextResponse.json(
        { error: `Transición inválida: ${currentStatus} → ${nextStatus}` },
        { status: 400 }
      )
    }

    const pickupCampusId = order.pickup_campus_id || order.campus_id
    const isGlobalAdmin = profile.role === 'super_admin' || profile.role === 'adm_merch'
    const sameCampus = profile.campus_id === pickupCampusId

    if (!isGlobalAdmin && !(nextStatus === 'delivered' && sameCampus)) {
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

    const itemTimestampPayload = getItemTimestampPayload(nextStatus)

    if (Object.keys(itemTimestampPayload).length > 0) {
      const { error: itemUpdateError } = await adminClient
        .from('order_items')
        .update(itemTimestampPayload)
        .eq('order_id', order.id)
        .eq('fulfillment_type', 'production')

      if (itemUpdateError) {
        return NextResponse.json(
          { error: itemUpdateError.message },
          { status: 400 },
        )
      }
    }

    const config = STATUS_CONFIG[nextStatus]

    await adminClient.from('order_status_history').insert({
      order_id: order.id,
      status: nextStatus,
      title: config.title,
      message: config.message,
      created_by: profile.id,
    })

    const emailResult = await sendTrackingEmail({
      orderId: order.id,
      status: nextStatus as any,
      appUrl: getAppUrl(req),
    })

    // ── WhatsApp: notificar al cliente cuando el pedido está listo ──
    let whatsappResult: any = null

    if (nextStatus === 'ready_pickup') {
      try {
        const { data: contact } = await adminClient
          .from('order_contacts')
          .select('client_name, client_phone')
          .eq('order_id', order.id)
          .maybeSingle()

        if (contact?.client_phone) {
          // Obtener campus de retiro
          const pickupCampusId = order.pickup_campus_id || order.campus_id
          let campusName = 'ARM Merch'

          if (pickupCampusId) {
            const { data: campus } = await adminClient
              .from('campus')
              .select('name')
              .eq('id', pickupCampusId)
              .maybeSingle()

            if (campus?.name) campusName = campus.name
          }

          // Obtener saldo pendiente
          const { data: orderFull } = await adminClient
            .from('orders')
            .select('balance_due, total')
            .eq('id', order.id)
            .maybeSingle()

          // Obtener nombres de productos de producción
          const { data: productionItems } = await adminClient
            .from('order_items')
            .select('quantity, size, products(name)')
            .eq('order_id', order.id)
            .eq('fulfillment_type', 'production')

          const productNames = (productionItems ?? []).map((item: any) => {
            const product = Array.isArray(item.products) ? item.products[0] : item.products
            const name = product?.name ?? 'Producto'
            const qty = item.quantity ?? 1
            const size = item.size ? ` (Talla ${item.size})` : ''
            return `${name}${size} x${qty}`
          })

          // Construir URL de tracking
          const trackingUrl = order.tracking_token
            ? `${getAppUrl(req)}/track/${order.tracking_token}`
            : null

          whatsappResult = await sendPickupNotification({
            phone: contact.client_phone,
            clientName: contact.client_name || 'Cliente',
            orderNumber: order.order_number,
            campusName,
            balanceDue: Number(orderFull?.balance_due ?? 0),
            trackingUrl,
            products: productNames,
          })
        } else {
          whatsappResult = { sent: false, provider: 'skipped', error: 'Sin teléfono registrado' }
        }
      } catch (whatsappError: any) {
        console.error('[Fulfillment] WhatsApp notification error:', whatsappError)
        whatsappResult = { sent: false, provider: 'skipped', error: whatsappError?.message }
      }
    }

    return NextResponse.json({
      success: true,
      status: nextStatus,
      email_sent: Boolean((emailResult as any)?.sent),
      email_result: emailResult,
      whatsapp_sent: Boolean(whatsappResult?.sent),
      whatsapp_result: whatsappResult,
      item_timestamps_updated: Object.keys(getItemTimestampPayload(nextStatus)).length > 0,
    })
  } catch (error: any) {
    console.error('PATCH /api/orders/[id]/fulfillment error:', error)
    return NextResponse.json({ error: error?.message ?? 'Error interno' }, { status: 500 })
  }
}
