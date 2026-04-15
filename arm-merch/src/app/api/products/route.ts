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

    if (!['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'No autorizado para crear productos' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { product, campusStocks } = body

    if (!product?.name?.trim()) {
      return NextResponse.json(
        { error: 'El nombre es obligatorio' },
        { status: 400 }
      )
    }

    if (Number(product.price) < 0) {
      return NextResponse.json(
        { error: 'El precio no puede ser negativo' },
        { status: 400 }
      )
    }

    if (!Array.isArray(campusStocks) || campusStocks.length === 0) {
      return NextResponse.json(
        { error: 'Debes seleccionar al menos un campus' },
        { status: 400 }
      )
    }

    let normalizedCampusStocks = campusStocks.map((item: any) => ({
      campus_id: item.campus_id,
      stock: Number(item.stock ?? 0),
      low_stock_alert: Number(item.low_stock_alert ?? 5),
    }))

    if (profile.role === 'admin') {
      if (!profile.campus_id) {
        return NextResponse.json(
          { error: 'El admin no tiene campus asignado' },
          { status: 403 }
        )
      }

      normalizedCampusStocks = normalizedCampusStocks.filter(
        (item: any) => item.campus_id === profile.campus_id
      )

      if (normalizedCampusStocks.length === 0) {
        return NextResponse.json(
          { error: 'Como admin solo puedes crear productos en tu campus' },
          { status: 403 }
        )
      }
    }

    const { data: createdProduct, error: productError } = await adminClient
      .from('products')
      .insert({
        name: product.name.trim(),
        description: product.description ?? null,
        price: Number(product.price),
        sku: product.sku ?? null,
        category_id: product.category_id ?? null,
        image_url: product.image_url ?? null,
        active: product.active ?? true,
      })
      .select('id')
      .single()

    if (productError || !createdProduct) {
      return NextResponse.json(
        { error: productError?.message ?? 'No se pudo crear el producto' },
        { status: 400 }
      )
    }

    const inventoryRows = normalizedCampusStocks.map((item: any) => ({
      product_id: createdProduct.id,
      campus_id: item.campus_id,
      stock: item.stock,
      low_stock_alert: item.low_stock_alert,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    }))

    const { error: inventoryError } = await adminClient
      .from('inventory')
      .insert(inventoryRows)

    if (inventoryError) {
      return NextResponse.json(
        { error: inventoryError.message },
        { status: 400 }
      )
    }

    const movementRows = normalizedCampusStocks
      .filter((item: any) => item.stock > 0)
      .map((item: any) => ({
        product_id: createdProduct.id,
        campus_id: item.campus_id,
        type: 'entrada',
        quantity: item.stock,
        notes: 'Stock inicial al crear producto',
        created_by: profile.id,
      }))

    if (movementRows.length > 0) {
      const { error: movementsError } = await adminClient
        .from('inventory_movements')
        .insert(movementRows)

      if (movementsError) {
        return NextResponse.json(
          { error: movementsError.message },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({ success: true, productId: createdProduct.id })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Error interno del servidor' },
      { status: 500 }
    )
  }
}