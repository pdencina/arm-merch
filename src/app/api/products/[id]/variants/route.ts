import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

async function getAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.replace('Bearer ', '').trim()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const authClient = createClient(supabaseUrl, supabaseAnonKey)
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: { user } } = await authClient.auth.getUser(token)
  if (!user) return null

  const { data: profile } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return null
  if (!['super_admin', 'adm_merch'].includes(profile.role)) return null

  return { user, profile, adminClient }
}

// GET — Obtener variantes de un producto
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuth(req)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await auth.adminClient
    .from('product_variants')
    .select('*')
    .eq('product_id', params.id)
    .eq('active', true)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ variants: data ?? [] })
}

// POST — Crear/actualizar variantes de un producto
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuth(req)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const variants: Array<{
    variant_type: string
    variant_value: string
    price: number
    sku?: string | null
    sort_order?: number
  }> = Array.isArray(body.variants) ? body.variants : []

  if (variants.length === 0) {
    return NextResponse.json({ error: 'Debes incluir al menos una variante' }, { status: 400 })
  }

  // Validar
  for (const v of variants) {
    if (!v.variant_value?.trim()) {
      return NextResponse.json({ error: 'Cada variante debe tener un valor' }, { status: 400 })
    }
    if (typeof v.price !== 'number' || v.price < 0) {
      return NextResponse.json({ error: 'Cada variante debe tener un precio válido' }, { status: 400 })
    }
  }

  // Desactivar variantes anteriores
  await auth.adminClient
    .from('product_variants')
    .update({ active: false })
    .eq('product_id', params.id)

  // Insertar nuevas variantes
  const rows = variants.map((v, i) => ({
    product_id: params.id,
    variant_type: v.variant_type || 'tamaño',
    variant_value: v.variant_value.trim(),
    price: v.price,
    sku: v.sku?.trim() || null,
    sort_order: v.sort_order ?? i,
    active: true,
  }))

  const { data, error } = await auth.adminClient
    .from('product_variants')
    .upsert(rows, { onConflict: 'product_id,variant_type,variant_value' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Marcar producto como has_variants
  await auth.adminClient
    .from('products')
    .update({ has_variants: true })
    .eq('id', params.id)

  return NextResponse.json({ success: true, variants: data })
}

// DELETE — Quitar todas las variantes de un producto
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuth(req)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  await auth.adminClient
    .from('product_variants')
    .update({ active: false })
    .eq('product_id', params.id)

  await auth.adminClient
    .from('products')
    .update({ has_variants: false })
    .eq('id', params.id)

  return NextResponse.json({ success: true })
}
