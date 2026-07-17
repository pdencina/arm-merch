import { hasModulePermission } from '@/lib/permissions/api-products-helper'
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

    const allowed = await hasModulePermission(token, 'products.edit')
    if (!allowed) {
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

        // NUEVO: variantes dinámicas
        has_variants: Boolean(body.has_variants),
        variant_type: body.variant_type ?? null,
        variants: Array.isArray(body.variants)
          ? body.variants
          : null,

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


export async function DELETE(
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

    // Solo super_admin y adm_merch pueden eliminar productos
    const allowed = await hasModulePermission(token, 'products.delete')
    if (!allowed) {
      return NextResponse.json(
        { error: 'No autorizado para eliminar productos' },
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

    // Obtener datos del producto antes de eliminar (para auditoría)
    const { data: product, error: fetchError } = await adminClient
      .from('products')
      .select('id, name, sku')
      .eq('id', productId)
      .maybeSingle()

    if (fetchError || !product) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    // Verificar si el producto tiene órdenes asociadas
    const { count: orderCount } = await adminClient
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId)

    if (orderCount && orderCount > 0) {
      // Soft delete: desactivar producto y marcar como eliminado
      const { error: softDeleteError } = await adminClient
        .from('products')
        .update({
          active: false,
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId)

      if (softDeleteError) {
        return NextResponse.json(
          { error: softDeleteError.message },
          { status: 400 }
        )
      }

      // Registrar auditoría
      await adminClient.from('audit_log').insert({
        actor_id: user.id,
        action: 'product.deleted',
        entity_type: 'product',
        entity_id: productId,
        campus_id: profile.campus_id ?? null,
        metadata: { product_name: product.name, sku: product.sku, soft_delete: true, reason: 'Producto tiene órdenes asociadas' },
      })

      return NextResponse.json({ success: true, soft_delete: true })
    }

    // Hard delete: eliminar inventario y producto
    await adminClient
      .from('inventory')
      .delete()
      .eq('product_id', productId)

    const { error: deleteError } = await adminClient
      .from('products')
      .delete()
      .eq('id', productId)

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 400 }
      )
    }

    // Registrar auditoría
    await adminClient.from('audit_log').insert({
      actor_id: user.id,
      action: 'product.deleted',
      entity_type: 'product',
      entity_id: productId,
      campus_id: profile.campus_id ?? null,
      metadata: { product_name: product.name, sku: product.sku, hard_delete: true },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
