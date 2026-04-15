import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
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

    if (!['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'No autorizado para editar inventario' },
        { status: 403 }
      )
    }

    const inventoryId = params.id
    if (!inventoryId) {
      return NextResponse.json(
        { error: 'Inventario inválido' },
        { status: 400 }
      )
    }

    const body = await req.json()

    const newStock = Number(body.stock)
    const newLowStock = Number(body.low_stock_alert)
    const previousStock = Number(body.previous_stock ?? 0)
    const productId = body.product_id
    const campusId = body.campus_id

    if (newStock < 0) {
      return NextResponse.json(
        { error: 'El stock no puede ser negativo' },
        { status: 400 }
      )
    }

    if (newLowStock < 0) {
      return NextResponse.json(
        { error: 'La alerta no puede ser negativa' },
        { status: 400 }
      )
    }

    if (profile.role === 'admin') {
      if (!profile.campus_id || profile.campus_id !== campusId) {
        return NextResponse.json(
          { error: 'No tienes permiso para editar inventario de otro campus' },
          { status: 403 }
        )
      }
    }

    const { error: updateError } = await adminClient
      .from('inventory')
      .update({
        stock: newStock,
        low_stock_alert: newLowStock,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inventoryId)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    let movementType = 'ajuste'
    let movementQty = Math.abs(newStock - previousStock)
    let notes = 'Ajuste manual de inventario desde detalle de producto'

    if (newStock > previousStock) {
      movementType = 'entrada'
      movementQty = newStock - previousStock
      notes = 'Entrada de inventario desde detalle de producto'
    } else if (newStock < previousStock) {
      movementType = 'salida'
      movementQty = previousStock - newStock
      notes = 'Salida de inventario desde detalle de producto'
    }

    if (movementQty > 0) {
      const { error: movementError } = await adminClient
        .from('inventory_movements')
        .insert({
          product_id: productId,
          campus_id: campusId,
          type: movementType,
          quantity: movementQty,
          notes,
          created_by: profile.id,
        })

      if (movementError) {
        return NextResponse.json(
          { error: movementError.message },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Error interno del servidor' },
      { status: 500 }
    )
  }
}