import { NextRequest, NextResponse } from 'next/server'
import { withAuth, verifyCampusAccess } from '@/lib/api'
import type { AuthContext } from '@/lib/api'

// ─── POST /api/orders/[id]/refund ─────────────────────────────────────────────
// Procesar devolución parcial o total de una orden
// Body: { items: [{ order_item_id, quantity, restock }], reason, notes }
export const POST = withAuth(async (
  req: NextRequest,
  ctx: AuthContext
) => {
  const { adminClient, profile } = ctx
  const orderId = req.nextUrl.pathname.split('/').at(-2) // extract [id] from path

  if (!orderId) {
    return NextResponse.json({ error: 'Order ID requerido' }, { status: 400 })
  }

  const body = await req.json()
  const { items, reason, notes } = body

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: 'Debes seleccionar al menos un item para devolver' },
      { status: 400 }
    )
  }

  // 1. Obtener la orden
  const { data: order, error: orderError } = await adminClient
    .from('orders')
    .select('id, order_number, status, campus_id, total, payment_method')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  }

  // Verificar acceso al campus de la orden
  if (!verifyCampusAccess(profile, order.campus_id)) {
    return NextResponse.json({ error: 'No autorizado para este campus' }, { status: 403 })
  }

  // Solo se pueden devolver órdenes pagadas
  if (order.status !== 'paid') {
    return NextResponse.json(
      { error: 'Solo se pueden devolver órdenes con estado "paid"' },
      { status: 400 }
    )
  }

  // 2. Obtener los items de la orden
  const { data: orderItems, error: itemsError } = await adminClient
    .from('order_items')
    .select('id, product_id, quantity, unit_price, refunded_qty')
    .eq('order_id', orderId)

  if (itemsError || !orderItems) {
    return NextResponse.json({ error: 'Error al cargar items de la orden' }, { status: 400 })
  }

  const orderItemsMap = new Map(orderItems.map((i: any) => [i.id, i]))

  // 3. Validar items a devolver
  let totalRefunded = 0
  const refundItemsToInsert: any[] = []
  const stockUpdates: { product_id: string; campus_id: string; quantity: number }[] = []

  for (const item of items) {
    const { order_item_id, quantity, restock = true } = item

    if (!order_item_id || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'Cada item necesita order_item_id y quantity > 0' },
        { status: 400 }
      )
    }

    const orderItem = orderItemsMap.get(order_item_id) as any
    if (!orderItem) {
      return NextResponse.json(
        { error: `Item ${order_item_id} no pertenece a esta orden` },
        { status: 400 }
      )
    }

    const availableToRefund = orderItem.quantity - (orderItem.refunded_qty ?? 0)
    if (quantity > availableToRefund) {
      return NextResponse.json(
        { error: `Solo puedes devolver ${availableToRefund} unidades del item (ya se devolvieron ${orderItem.refunded_qty ?? 0})` },
        { status: 400 }
      )
    }

    const subtotal = Math.round(quantity * orderItem.unit_price)
    totalRefunded += subtotal

    refundItemsToInsert.push({
      order_item_id,
      product_id: orderItem.product_id,
      quantity,
      unit_price: orderItem.unit_price,
      subtotal,
      restock: restock !== false,
    })

    if (restock !== false && order.campus_id) {
      stockUpdates.push({
        product_id: orderItem.product_id,
        campus_id: order.campus_id,
        quantity,
      })
    }
  }

  // 4. Determinar si es parcial o total
  const totalOrderItems = orderItems.reduce(
    (sum: number, i: any) => sum + i.quantity,
    0
  )
  const totalRefundedItems = orderItems.reduce(
    (sum: number, i: any) => sum + (i.refunded_qty ?? 0),
    0
  )
  const totalReturningNow = refundItemsToInsert.reduce(
    (sum: number, i: any) => sum + i.quantity,
    0
  )
  const isFullRefund = totalRefundedItems + totalReturningNow >= totalOrderItems

  // 5. Crear el refund
  const { data: refund, error: refundError } = await adminClient
    .from('refunds')
    .insert({
      order_id: orderId,
      type: isFullRefund ? 'full' : 'partial',
      status: 'completed',
      total_refunded: totalRefunded,
      reason: reason || null,
      notes: notes || null,
      created_by: profile.id,
      campus_id: order.campus_id,
    })
    .select('*')
    .single()

  if (refundError || !refund) {
    return NextResponse.json({ error: refundError?.message ?? 'Error creando devolución' }, { status: 400 })
  }

  // 6. Insertar refund items
  const itemsWithRefundId = refundItemsToInsert.map((i) => ({
    ...i,
    refund_id: refund.id,
  }))

  const { error: refundItemsError } = await adminClient
    .from('refund_items')
    .insert(itemsWithRefundId)

  if (refundItemsError) {
    return NextResponse.json({ error: refundItemsError.message }, { status: 400 })
  }

  // 7. Actualizar refunded_qty en order_items
  for (const item of refundItemsToInsert) {
    const orderItem = orderItemsMap.get(item.order_item_id) as any
    if (orderItem) {
      await adminClient
        .from('order_items')
        .update({ refunded_qty: (orderItem.refunded_qty ?? 0) + item.quantity })
        .eq('id', item.order_item_id)
    }
  }

  // 8. Reintegrar stock
  for (const update of stockUpdates) {
    // Obtener inventario actual
    const { data: inv } = await adminClient
      .from('inventory')
      .select('id, stock')
      .eq('product_id', update.product_id)
      .eq('campus_id', update.campus_id)
      .single()

    if (inv) {
      await adminClient
        .from('inventory')
        .update({
          stock: inv.stock + update.quantity,
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', inv.id)

      // Registrar movimiento de entrada
      await adminClient
        .from('inventory_movements')
        .insert({
          product_id: update.product_id,
          campus_id: update.campus_id,
          type: 'entrada',
          quantity: update.quantity,
          notes: `Devolución orden #${order.order_number} — Refund #${refund.refund_number}`,
          created_by: profile.id,
        })
    }
  }

  // 9. Actualizar estado de la orden si es full refund
  if (isFullRefund) {
    await adminClient
      .from('orders')
      .update({ status: 'refunded' })
      .eq('id', orderId)
  }

  // 10. Audit log
  await adminClient.from('audit_log').insert({
    actor_id: profile.id,
    action: isFullRefund ? 'order.refunded' : 'order.partial_refund',
    entity_type: 'order',
    entity_id: orderId,
    campus_id: order.campus_id,
    metadata: {
      refund_id: refund.id,
      total_refunded: totalRefunded,
      items_count: refundItemsToInsert.length,
      is_full: isFullRefund,
      reason,
    },
  })

  return NextResponse.json({
    success: true,
    refund: {
      id: refund.id,
      refund_number: refund.refund_number,
      type: isFullRefund ? 'full' : 'partial',
      total_refunded: totalRefunded,
      items_returned: totalReturningNow,
      stock_reintegrated: stockUpdates.length > 0,
      order_status: isFullRefund ? 'refunded' : 'paid',
    },
  })
}, { permission: 'orders.refund' })

// ─── GET /api/orders/[id]/refund ──────────────────────────────────────────────
// Obtener historial de devoluciones de una orden
export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const { adminClient } = ctx
  const orderId = req.nextUrl.pathname.split('/').at(-2)

  if (!orderId) {
    return NextResponse.json({ error: 'Order ID requerido' }, { status: 400 })
  }

  const { data: refunds, error } = await adminClient
    .from('refunds')
    .select(`
      *,
      refund_items(
        id, quantity, unit_price, subtotal, restock,
        product:products(id, name, sku, image_url)
      ),
      created_by_profile:profiles!refunds_created_by_fkey(full_name)
    `)
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ refunds: refunds ?? [] })
})
