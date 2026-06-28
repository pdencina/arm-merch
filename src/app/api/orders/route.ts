import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTrackingEmail } from '@/lib/tracking-email'
import { requireApiPermission } from '@/lib/permissions/api'

// ─── POST /api/orders ─────────────────────────────────────────────────────────
// Reglas importantes:
// - Pagos normales: crean orden paid, descuentan stock y envían voucher inmediato.
// - Link/QR SumUp: crean orden pending, NO descuentan stock y NO envían voucher hasta confirmar pago.
// - Smart POS SumUp: crea orden pending, NO descuenta stock y NO envía voucher hasta validar código TX.
// ─────────────────────────────────────────────────────────────────────────────

function createTrackingToken(orderNumber: number) {
  return `ARM-${orderNumber}`
}

function getAppUrl(req: NextRequest) {
  return (process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || 'https://armerch.com').replace(/\/$/, '')
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '').trim()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return NextResponse.json({ error: 'Faltan variables de entorno' }, { status: 500 })
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
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

    const body = await req.json()

    const items: Array<{
      product_id: string
      quantity: number
      unit_price: number
      discount_pct?: number
      size?: string | null
      fulfillment_type?: string | null
    }> = Array.isArray(body.items) ? body.items : []

    const paymentMethod: string = body.payment_method ?? null
    const discount = Number(body.discount ?? 0)
    const promoCode: string | null = body.promo_code ?? null
    const deliveryStatus: string | null = body.delivery_status ?? null
    const extraNotes: string | null = body.notes ?? null
    const requestedCampusId: string | null = body.campus_id ?? null
    const clientName: string | null = String(body.client_name ?? '').trim() || null
    const clientEmail: string | null = String(body.client_email ?? '').trim().toLowerCase() || null
    const clientPhone: string | null = String(body.client_phone ?? '').trim() || null
    const requestedPaymentType: string | null = body.payment_type ?? null
    const requestedDepositPercentage = Number(body.deposit_percentage ?? 100)
    const requestedAmountPaid = Number(body.amount_paid ?? NaN)
    const requestedBalanceDue = Number(body.balance_due ?? NaN)
    const requestedPaymentStatus: string | null = body.payment_status ?? null

    const isSmartPOS = paymentMethod === 'sumup' || String(extraNotes ?? '').includes('Smart POS')

    if (!items.length || (!clientName && !isSmartPOS) || !paymentMethod) {
      return NextResponse.json(
        { error: 'Datos incompletos: items, nombre del cliente y método de pago son requeridos' },
        { status: 400 }
      )
    }

    // ── Perfil del vendedor ──
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role, campus_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const permission = await requireApiPermission(
      adminClient,
      profile,
      'pos.sell',
      'No tienes permisos para registrar ventas'
    )

    if (permission.ok === false) {
      return permission.response
    }

    const sellingCampusId =
      profile.role === 'super_admin' || profile.role === 'adm_merch'
        ? requestedCampusId || profile.campus_id
        : profile.campus_id

    if (!sellingCampusId) {
      return NextResponse.json({ error: 'Campus inválido' }, { status: 400 })
    }

    // ── Normalizar items ──
    const normalizedItems = items.map((i) => ({
      product_id: i.product_id,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      discount_pct: Number(i.discount_pct ?? 0),
      size: i.size ?? null,
      fulfillment_type:
        i.fulfillment_type === 'production'
          ? 'production'
          : 'immediate',
    }))

    const invalidItem = normalizedItems.find(
      (i) => !i.product_id || i.quantity <= 0 || i.unit_price < 0
    )

    if (invalidItem) {
      return NextResponse.json({ error: 'Hay productos inválidos en la venta' }, { status: 400 })
    }

    // ── Verificar stock una sola vez ──
    const productIds = normalizedItems.map((i) => i.product_id)
    const { data: inventoryRows, error: inventoryError } = await adminClient
      .from('inventory')
      .select('id, product_id, stock')
      .in('product_id', productIds)
      .eq('campus_id', sellingCampusId)

    if (inventoryError) {
      return NextResponse.json({ error: inventoryError.message }, { status: 400 })
    }

    const inventoryMap = new Map(
      (inventoryRows ?? []).map((row: any) => [row.product_id, row])
    )

    for (const item of normalizedItems) {
      const inv = inventoryMap.get(item.product_id)
      if (!inv) {
        return NextResponse.json(
          { error: 'Uno de los productos no tiene inventario en este campus' },
          { status: 400 }
        )
      }

      if (Number(inv.stock ?? 0) < item.quantity) {
        return NextResponse.json(
          { error: `Stock insuficiente. Disponible: ${inv.stock ?? 0}` },
          { status: 400 }
        )
      }
    }

    // ── Calcular totales ──
    const subtotalCalculado = normalizedItems.reduce(
      (sum, i) => sum + i.unit_price * i.quantity * (1 - i.discount_pct / 100),
      0
    )
    const totalCalculado = Math.max(0, subtotalCalculado - discount)

    if (discount < 0) {
      return NextResponse.json({ error: 'El descuento no puede ser negativo' }, { status: 400 })
    }

    // ── Número de orden ──
    const { data: lastOrder, error: lastOrderError } = await adminClient
      .from('orders')
      .select('order_number')
      .order('order_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastOrderError) {
      return NextResponse.json({ error: lastOrderError.message }, { status: 400 })
    }

    const orderNumber = Number(lastOrder?.order_number ?? 1000) + 1

    // ── Notas combinadas ──
    const combinedNotes = [
      promoCode ? `Cupón: ${promoCode}` : null,
      extraNotes,
    ].filter(Boolean).join(' | ') || null

    const isDeferredPayment = paymentMethod === 'link' || paymentMethod === 'sumup'
    const initialStatus = isDeferredPayment ? 'pending' : 'paid'
    const trackingToken = createTrackingToken(orderNumber)
    const hasProductionItems = normalizedItems.some(
      (item) => item.fulfillment_type === 'production'
    )
    const isProductionOrder = deliveryStatus === 'pending' || hasProductionItems
    const productionStatus = isProductionOrder ? 'pending_production' : 'not_required'
    const pickupCampusId = body.pickup_campus_id || sellingCampusId

    const productionTotal = normalizedItems
      .filter((item) => item.fulfillment_type === 'production')
      .reduce((sum, item) => sum + item.unit_price * item.quantity * (1 - item.discount_pct / 100), 0)

    const immediateTotal = Math.max(0, totalCalculado - productionTotal)

    const defaultAmountPaid = isProductionOrder
      ? immediateTotal + Math.round(productionTotal * 0.5)
      : totalCalculado

    const amountPaid = Number.isFinite(requestedAmountPaid)
      ? Math.round(requestedAmountPaid)
      : Math.round(defaultAmountPaid)

    const balanceDue = Number.isFinite(requestedBalanceDue)
      ? Math.round(requestedBalanceDue)
      : Math.max(0, Math.round(totalCalculado - amountPaid))

    const paymentType =
      requestedPaymentType ||
      (isProductionOrder && balanceDue > 0 ? 'deposit_50' : 'full_payment')

    const depositPercentage =
      Number.isFinite(requestedDepositPercentage) && requestedDepositPercentage > 0
        ? requestedDepositPercentage
        : paymentType === 'deposit_50'
          ? 50
          : 100

    const orderPaymentStatus =
      requestedPaymentStatus ||
      (balanceDue > 0 ? 'partial' : initialStatus === 'paid' ? 'paid' : 'pending')

    // ── Crear orden ──
    const { data: createdOrder, error: orderError } = await adminClient
      .from('orders')
      .insert({
        order_number: orderNumber,
        campus_id: sellingCampusId,
        seller_id: profile.id,
        payment_method: paymentMethod,
        discount,
        total: Math.round(totalCalculado),
        amount_paid: amountPaid,
        balance_due: balanceDue,
        payment_status: orderPaymentStatus,
        payment_type: paymentType,
        deposit_percentage: depositPercentage,
        notes: combinedNotes,
        status: initialStatus,
        delivery_status: deliveryStatus,
        client_phone: clientPhone || null,
        tracking_token: trackingToken,
        production_status: productionStatus,
        pickup_campus_id: pickupCampusId,
      })
      .select('id, order_number, status, created_at, total, discount, payment_method, notes, tracking_token, production_status, pickup_campus_id, amount_paid, balance_due, payment_status, payment_type, deposit_percentage')
      .single()

    if (orderError || !createdOrder) {
      return NextResponse.json(
        { error: orderError?.message ?? 'No se pudo crear la orden' },
        { status: 400 }
      )
    }

    // ── Guardar contacto ──
    if (clientName || clientEmail || clientPhone) {
      const { error: contactError } = await adminClient
        .from('order_contacts')
        .insert({
          order_id: createdOrder.id,
          client_name: clientName || null,
          client_email: clientEmail || '',
          client_phone: clientPhone || null,
        })

      if (contactError) {
        return NextResponse.json({ error: contactError.message }, { status: 400 })
      }
    }

    // ── Insertar items ──
    const orderItemsRows = normalizedItems.map((item) => ({
      order_id: createdOrder.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      fulfillment_type: item.fulfillment_type || 'immediate',
      ...(item.size ? { size: item.size } : {}),
    }))

    const { error: orderItemsError } = await adminClient
      .from('order_items')
      .insert(orderItemsRows)

    if (orderItemsError) {
      return NextResponse.json({ error: orderItemsError.message }, { status: 400 })
    }

    // ── Historial público de seguimiento ──
    await adminClient.from('order_status_history').insert({
      order_id: createdOrder.id,
      status: 'purchase_confirmed',
      title: 'Compra confirmada',
      message: orderPaymentStatus === 'partial'
        ? `Recibimos tu abono de $${amountPaid.toLocaleString('es-CL')}. Saldo pendiente al retiro: $${balanceDue.toLocaleString('es-CL')}.`
        : initialStatus === 'paid'
          ? 'Tu compra fue confirmada correctamente.'
          : 'Recibimos tu pedido y estamos esperando confirmación del pago.',
      created_by: profile.id,
    })

    if (isProductionOrder) {
      await adminClient.from('order_status_history').insert({
        order_id: createdOrder.id,
        status: 'pending_production',
        title: 'En preparación',
        message: 'Tu pedido quedó registrado para producción.',
        created_by: profile.id,
      })
    }

    // ── Descontar stock solo en pagos confirmados inmediatos ──
    // Link/QR y Smart POS nacen pending y se descuentan después de confirmar pago.
    if (!isDeferredPayment) {
      for (const item of normalizedItems.filter(
        (i) => i.fulfillment_type !== 'production'
      )) {
        const { error: movementError } = await adminClient
          .from('inventory_movements')
          .insert({
            product_id: item.product_id,
            campus_id: sellingCampusId,
            type: 'salida',
            quantity: item.quantity,
            notes: `Venta ${createdOrder.order_number}`,
            created_by: profile.id,
          })

        if (movementError) {
          return NextResponse.json({ error: movementError.message }, { status: 400 })
        }
      }
    }

    // ── Email moderno unificado con tracking ───────────────────────────────
    // Link/QR y Smart POS NO deben enviar voucher hasta que el pago esté confirmado.
    let emailSent = false
    const shouldSendEmailImmediately = !isDeferredPayment

    if (shouldSendEmailImmediately && clientEmail) {
      try {
        const emailResult = await sendTrackingEmail({
          orderId: createdOrder.id,
          status: 'purchase_confirmed',
          appUrl: getAppUrl(req),
        })

        emailSent = Boolean(emailResult.sent)

        if (!emailResult.sent) {
          console.error('Tracking email error:', emailResult.error)
        }
      } catch (e) {
        console.error('Tracking email exception:', e)
      }
    }

    // ── WhatsApp: mensaje de agradecimiento post-compra ──
    if (clientPhone && createdOrder.status === 'paid') {
      try {
        const { sendPurchaseThanks } = await import('@/lib/whatsapp/send-purchase-thanks')
        await sendPurchaseThanks({
          phone: clientPhone,
          clientName: clientName || 'Cliente',
          orderNumber: createdOrder.order_number,
          total: Number(createdOrder.total ?? 0),
          campusName: undefined, // se resuelve por campus_id si se necesita
          paymentMethod: createdOrder.payment_method,
        })
      } catch (e) {
        // No bloquear la venta si falla WhatsApp
        console.error('[WhatsApp Thanks] Error:', e)
      }
    }

    return NextResponse.json({
      success: true,
      order_id: createdOrder.id,
      order_number: createdOrder.order_number,
      status: createdOrder.status,
      payment_status: createdOrder.payment_status,
      amount_paid: createdOrder.amount_paid,
      balance_due: createdOrder.balance_due,
      payment_type: createdOrder.payment_type,
      email_sent: emailSent,
      tracking_token: createdOrder.tracking_token,
      tracking_url: createdOrder.tracking_token ? `${getAppUrl(req)}/track/${createdOrder.tracking_token}` : null,
    })
  } catch (error: any) {
    console.error('POST /api/orders error:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
