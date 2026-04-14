import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // No necesario para este endpoint
        },
      },
    }
  )

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
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

  const { data: profile, error: profileError } = await supabase
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

  if (profile.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'Solo el super admin puede asignar productos a otros campus' },
      { status: 403 }
    )
  }

  const { data: existingInventory, error: existingError } = await supabase
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

  const { error: inventoryError } = await supabase.from('inventory').insert({
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
    const { error: movementError } = await supabase
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
}