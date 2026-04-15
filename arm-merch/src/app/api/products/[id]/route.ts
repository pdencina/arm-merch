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
        { error: 'No autorizado para editar productos' },
        { status: 403 }
      )
    }

    const productId = params.id
    if (!productId) {
      return NextResponse.json(
        { error: 'Producto inválido' },
        { status: 400 }
      )
    }

    if (profile.role === 'admin') {
      const { data: allowedInventory, error: allowedError } = await adminClient
        .from('inventory')
        .select('id')
        .eq('product_id', productId)
        .eq('campus_id', profile.campus_id)
        .maybeSingle()

      if (allowedError) {
        return NextResponse.json(
          { error: allowedError.message },
          { status: 400 }
        )
      }

      if (!allowedInventory) {
        return NextResponse.json(
          { error: 'No tienes permiso para editar este producto' },
          { status: 403 }
        )
      }
    }

    const body = await req.json()

    if (!body?.name?.trim()) {
      return NextResponse.json(
        { error: 'El nombre es obligatorio' },
        { status: 400 }
      )
    }

    if (Number(body.price) < 0) {
      return NextResponse.json(
        { error: 'El precio no puede ser negativo' },
        { status: 400 }
      )
    }

    const { error: updateError } = await adminClient
      .from('products')
      .update({
        name: body.name.trim(),
        description: body.description ?? null,
        price: Number(body.price),
        sku: body.sku ?? null,
        category_id: body.category_id ?? null,
        image_url: body.image_url ?? null,
        active: Boolean(body.active),
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Error interno del servidor' },
      { status: 500 }
    )
  }
}