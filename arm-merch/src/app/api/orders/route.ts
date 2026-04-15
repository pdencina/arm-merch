import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  try {
    const cookieStore = cookies()

    // Cliente con sesión (usuario actual)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Cookie: cookieStore.toString(),
          },
        },
      }
    )

    // Cliente admin (bypass RLS)
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const body = await req.json()

    const {
      items,
      payment_method,
      subtotal,
      discount,
      total,
      notes,
      campus_id,
    } = body

    // 🔐 Obtener usuario
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // 👤 Perfil
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, role, campus_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    // 🧠 Determinar campus de venta
    const sellingCampusId =
      profile.role === 'super_admin' ? campus_id : profile.campus_id

    if (!sellingCampusId) {
      return NextResponse.json({ error: 'Campus inválido' }, { status: 400 })
    }

    // 🧾 Generar número de orden (STRING, no número)
    const orderNumber = `ORD-${Date.now()}`

    // 🧾 Crear orden (SIN status manual → usa default 'pending')
    const { data: createdOrder, error: orderError } = await adminClient
      .from('orders')
      .insert({
        order_number: orderNumber,
        campus_id: sellingCampusId,
        seller_id: profile.id,
        payment_method,
        subtotal,
        discount,
        total,
        notes,
      })
      .select('id, order_number')
      .single()

    if (orderError) {
      console.error('Error creando orden:', orderError)
      return NextResponse.json({ error: orderError.message }, { status: 400 })
    }

    const orderId = createdOrder.id

    // 📦 Insertar items + descontar stock + registrar movimiento
    for (const item of items) {
      // 1. Guardar item
      const { error: itemError } = await adminClient
        .from('order_items')
        .insert({
          order_id: orderId,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          total: item.quantity * item.price,
        })

      if (itemError) {
        console.error('Error creando item:', itemError)
        return NextResponse.json({ error: itemError.message }, { status: 400 })
      }

      // 2. Obtener stock actual
      const { data: inventory } = await adminClient
        .from('inventory')
        .select('stock')
        .eq('product_id', item.product_id)
        .eq('campus_id', sellingCampusId)
        .single()

      if (!inventory) {
        return NextResponse.json(
          { error: 'Inventario no encontrado' },
          { status: 400 }
        )
      }

      if (inventory.stock < item.quantity) {
        return NextResponse.json(
          { error: `Stock insuficiente para producto ${item.product_id}` },
          { status: 400 }
        )
      }

      // 3. Descontar stock
      const newStock = inventory.stock - item.quantity

      const { error: stockError } = await adminClient
        .from('inventory')
        .update({ stock: newStock })
        .eq('product_id', item.product_id)
        .eq('campus_id', sellingCampusId)

      if (stockError) {
        console.error('Error actualizando stock:', stockError)
        return NextResponse.json({ error: stockError.message }, { status: 400 })
      }

      // 4. Registrar movimiento
      const { error: movementError } = await adminClient
        .from('inventory_movements')
        .insert({
          product_id: item.product_id,
          campus_id: sellingCampusId,
          type: 'out',
          quantity: item.quantity,
          reason: 'sale',
          reference_id: orderId,
        })

      if (movementError) {
        console.error('Error movimiento inventario:', movementError)
        return NextResponse.json({ error: movementError.message }, { status: 400 })
      }
    }

    return NextResponse.json({
      success: true,
      order_id: orderId,
      order_number: orderNumber,
    })
  } catch (error: any) {
    console.error('Error general:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    )
  }
}