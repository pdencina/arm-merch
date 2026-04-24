import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── PATCH /api/inventory ─────────────────────────────────────────────────────
// Recibe inventory_id en el body (en lugar de en la URL)
// Usado por movement-form.tsx para actualizar stock
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '').trim()

    const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return NextResponse.json({ error: 'Faltan variables de entorno' }, { status: 500 })
    }

    const authClient  = createClient(supabaseUrl, supabaseAnonKey)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: { user }, error: userError } = await authClient.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, role, campus_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body         = await req.json()
    const inventoryId  = body.inventory_id
    const newStock     = Number(body.stock)

    if (!inventoryId) {
      return NextResponse.json({ error: 'inventory_id requerido' }, { status: 400 })
    }
    if (isNaN(newStock) || newStock < 0) {
      return NextResponse.json({ error: 'Stock inválido' }, { status: 400 })
    }

    const { error: updateError } = await adminClient
      .from('inventory')
      .update({
        stock:      newStock,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inventoryId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Error interno' },
      { status: 500 }
    )
  }
}
