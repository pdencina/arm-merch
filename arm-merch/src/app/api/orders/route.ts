import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
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
      return NextResponse.json(
        { error: 'Faltan variables de entorno de Supabase' },
        { status: 500 }
      )
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role, campus_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'No se pudo cargar el perfil del usuario' },
        { status: 403 }
      )
    }

    const body = await req.json()

    const items = Array.isArray(body.items) ? body.items : []
    const paymentMethod = body.payment_method ?? null
    const notes = body.notes ?? null
    const discount = Number(body.discount ?? 0)
    const requestedCampusId = body.campus_id ?? null

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'La venta no tiene productos' },
        { status: 400 }
      )
    }

    const sellingCampusId =
      profile.role === 'super_admin'
        ? requestedCampusId || profile.campus_id
        : profile.campus_id

    if (!sellingCampusId) {
      return NextResponse.json(
        { error: 'No hay campus definido para la venta' },
        { status: 400 }
      )
    }

    const normalizedItems = items.map((item: any) => ({
      product_id: item.product_id,
      quantity: Number(item.quantity ?? 0),
      unit_price: Number(item.unit_price ?? 0),
    }))

    const invalidItem = normalizedItems.find(
      (item: any) =>
        !item.product_id ||
        item.quantity <= 0 ||
        item.unit_price < 0
    )

    if (invalidItem) {
      return NextResponse.json(
        { error: 'Hay productos inválidos en la venta' },
        { status: 400 }
      )
    }

    if (discount < 0) {
      return NextResponse.json(
        { error: 'El descuento no puede ser negativo' },
        { status: 400 }
      )
    }

    const productIds = normalizedItems.map((item: any) => item.product_id)

    const { data: inventoryRows, error: inventoryError } = await adminClient
      .from('inventory')
      .select('id, product_id, campus_id, stock, low_stock_alert')
      .eq('campus_id', sellingCampusId)
      .in('product_id', productIds)

    if (inventoryError) {
      return NextResponse.json(
        { error: inventoryError.message },
        { status: 400 }
      )
    }

    const inventoryMap = new Map(
      (inventoryRows ?? []).map((row: any) => [row.product_id, row])
    )

    for (const item of normalizedItems) {
      const inventory = inventoryMap.get(item.product_id)

      if (!inventory) {
        return NextResponse.json(
          { error: 'Uno de los productos no tiene inventario en este campus' },
          { status: 400 }
        )
      }

      if (Number(inventory.stock ?? 0) < item.quantity) {
        return NextResponse.json(
          {
            error: `Stock insuficiente para uno de los productos. Disponible: ${inventory.stock ?? 0}`,
          },
          { status: 400 }
        )
      }
    }

    const subtotal = normalizedItems.reduce(
      (sum: number, item: any) => sum + item.quantity * item.unit_price,
      0
    )

    const total = subtotal - discount

    if (total < 0) {
      return NextResponse.json(
        { error: 'El total no puede ser negativo' },
        { status: 400 }
      )
    }

    // IMPORTANTE:
    // order_number es integer, por eso debe ser numérico.
    const orderNumber = Date.now()

    const { data: createdOrder, error: orderError } = await adminClient
      .from('orders')
      .insert({
        order_number: orderNumber,
        campus_id: sellingCampusId,
        seller_id: profile.id,
        status: 'completed',
        payment_method: paymentMethod,
        subtotal,
        discount,
        total,
        notes,
      })
      .select('id, order_number')
      .single()

    if (orderError || !createdOrder) {
      return NextResponse.json(
        { error: orderError?.message ?? 'No se pudo crear la orden' },
        { status: 400 }
      )
    }

    const orderItemsRows = normalizedItems.map((item: any) => ({
      order_id: createdOrder.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.quantity * item.unit_price,
    }))

    const { error: orderItemsError } = await adminClient
      .from('order_items')
      .insert(orderItemsRows)

    if (orderItemsError) {
      return NextResponse.json(
        { error: orderItemsError.message },
        { status: 400 }
      )
    }

    for (const item of normalizedItems) {
      const inventory = inventoryMap.get(item.product_id)
      const newStock = Number(inventory.stock ?? 0) - item.quantity

      const { error: updateInventoryError } = await adminClient
        .from('inventory')
        .update({
          stock: newStock,
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', inventory.id)

      if (updateInventoryError) {
        return NextResponse.json(
          { error: updateInventoryError.message },
          { status: 400 }
        )
      }

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
        return NextResponse.json(
          { error: movementError.message },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      order_id: createdOrder.id,
      order_number: createdOrder.order_number,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Error interno del servidor' },
      { status: 500 }
    )
  }
}