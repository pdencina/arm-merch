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

    // Cliente público para validar token
    const authClient = createClient(supabaseUrl, supabaseAnonKey)

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Cliente admin para operar en DB
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'No se pudo cargar el perfil del usuario' },
        { status: 403 }
      )
    }

    if (profile.role !== 'super_admin' && profile.role !== 'adm_merch') {
      return NextResponse.json(
        { error: 'No autorizado para asignar productos a campus' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { product_id, campus_id, stock, low_stock_alert } = body

    if (!product_id || !campus_id) {
      return NextResponse.json(
        { error: 'Producto o campus inválido' },
        { status: 400 }
      )
    }

    const numericStock = Number(stock ?? 0)
    const numericLowStock = Number(low_stock_alert ?? 5)

    if (numericStock < 0) {
      return NextResponse.json(
        { error: 'El stock no puede ser negativo' },
        { status: 400 }
      )
    }

    const { data: existingInventory, error: existingError } = await adminClient
      .from('inventory')
      .select('id')
      .eq('product_id', product_id)
      .eq('campus_id', campus_id)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 400 })
    }

    if (existingInventory) {
      return NextResponse.json(
        { error: 'Este producto ya existe en el campus seleccionado' },
        { status: 400 }
      )
    }

    const { error: inventoryError } = await adminClient.from('inventory').insert({
      product_id,
      campus_id,
      stock: numericStock,
      low_stock_alert: numericLowStock,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    })

    if (inventoryError) {
      return NextResponse.json({ error: inventoryError.message }, { status: 400 })
    }

    if (numericStock > 0) {
      const { error: movementError } = await adminClient
        .from('inventory_movements')
        .insert({
          product_id,
          campus_id,
          type: 'entrada',
          quantity: numericStock,
          notes: 'Asignación inicial de producto a campus',
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