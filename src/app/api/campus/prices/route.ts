import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api'
import type { AuthContext } from '@/lib/api'

// ─── GET /api/campus/prices ───────────────────────────────────────────────────
// Obtener precios diferenciados. Params: ?campus_id=xxx o ?product_id=xxx
export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const { adminClient } = ctx
  const url = new URL(req.url)
  const campusId = url.searchParams.get('campus_id')
  const productId = url.searchParams.get('product_id')

  let query = adminClient
    .from('campus_prices')
    .select(`
      *,
      product:products(id, name, price, sku, image_url),
      campus:campus(id, name)
    `)
    .eq('active', true)
    .order('created_at', { ascending: false })

  if (campusId) query = query.eq('campus_id', campusId)
  if (productId) query = query.eq('product_id', productId)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ prices: data ?? [] })
})

// ─── POST /api/campus/prices ──────────────────────────────────────────────────
// Crear o actualizar precio de un producto para un campus específico
export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const { adminClient, profile } = ctx

  if (!['super_admin', 'adm_merch'].includes(profile.role)) {
    return NextResponse.json({ error: 'Solo admins globales pueden gestionar precios por campus' }, { status: 403 })
  }

  const body = await req.json()
  const { product_id, campus_id, price, notes } = body

  if (!product_id || !campus_id || price === undefined || price === null) {
    return NextResponse.json(
      { error: 'Campos requeridos: product_id, campus_id, price' },
      { status: 400 }
    )
  }

  const numPrice = Number(price)
  if (isNaN(numPrice) || numPrice < 0) {
    return NextResponse.json({ error: 'Precio inválido' }, { status: 400 })
  }

  const { data, error } = await adminClient
    .from('campus_prices')
    .upsert(
      {
        product_id,
        campus_id,
        price: numPrice,
        notes: notes || null,
        created_by: profile.id,
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'product_id,campus_id' }
    )
    .select(`
      *,
      product:products(id, name, price, sku),
      campus:campus(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, campus_price: data })
}, { permission: 'pricing.edit' })

// ─── DELETE /api/campus/prices ────────────────────────────────────────────────
// Eliminar un precio por campus (vuelve al precio base global)
export const DELETE = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const { adminClient, profile } = ctx

  if (!['super_admin', 'adm_merch'].includes(profile.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const url = new URL(req.url)
  const id = url.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  }

  const { error } = await adminClient
    .from('campus_prices')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}, { permission: 'pricing.edit' })
