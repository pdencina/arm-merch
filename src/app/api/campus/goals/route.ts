import { NextRequest, NextResponse } from 'next/server'
import { withAuth, getEffectiveCampusId } from '@/lib/api'
import type { AuthContext } from '@/lib/api'

// ─── GET /api/campus/goals ────────────────────────────────────────────────────
// Obtener metas de venta. Params: ?month=6&year=2026&campus_id=xxx
export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const { adminClient, profile } = ctx
  const url = new URL(req.url)
  const now = new Date()
  const month = Number(url.searchParams.get('month') ?? now.getMonth() + 1)
  const year = Number(url.searchParams.get('year') ?? now.getFullYear())
  const requestedCampusId = url.searchParams.get('campus_id')

  let query = adminClient
    .from('campus_goals')
    .select(`
      *,
      campus:campus(id, name)
    `)
    .eq('month', month)
    .eq('year', year)
    .order('target_amount', { ascending: false })

  // Filtro por campus si se especifica o si no es global
  const campusId = getEffectiveCampusId(profile, requestedCampusId)
  if (campusId && !['super_admin', 'adm_merch'].includes(profile.role)) {
    query = query.eq('campus_id', campusId)
  } else if (requestedCampusId) {
    query = query.eq('campus_id', requestedCampusId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Obtener ventas reales del período para calcular progreso
  const startDate = new Date(year, month - 1, 1).toISOString()
  const endDate = new Date(year, month, 0, 23, 59, 59).toISOString()

  const { data: salesData } = await adminClient
    .from('orders')
    .select('campus_id, total')
    .eq('status', 'paid')
    .gte('created_at', startDate)
    .lte('created_at', endDate)

  // Agrupar ventas por campus
  const salesByCampus: Record<string, { total: number; count: number }> = {}
  ;(salesData ?? []).forEach((order: any) => {
    const cid = order.campus_id ?? 'none'
    if (!salesByCampus[cid]) salesByCampus[cid] = { total: 0, count: 0 }
    salesByCampus[cid].total += Number(order.total ?? 0)
    salesByCampus[cid].count += 1
  })

  // Enriquecer goals con progreso
  const goals = (data ?? []).map((goal: any) => {
    const sales = salesByCampus[goal.campus_id] ?? { total: 0, count: 0 }
    const progress = goal.target_amount > 0
      ? Math.min(100, (sales.total / goal.target_amount) * 100)
      : 0

    return {
      ...goal,
      current_amount: sales.total,
      current_orders: sales.count,
      progress: Math.round(progress * 10) / 10,
      remaining: Math.max(0, goal.target_amount - sales.total),
    }
  })

  return NextResponse.json({ goals, month, year })
})

// ─── POST /api/campus/goals ───────────────────────────────────────────────────
// Crear o actualizar meta de venta para un campus
export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const { adminClient, profile } = ctx

  if (!['super_admin', 'adm_merch'].includes(profile.role)) {
    return NextResponse.json({ error: 'Solo admins globales pueden definir metas' }, { status: 403 })
  }

  const body = await req.json()
  const { campus_id, month, year, target_amount, target_orders, notes } = body

  if (!campus_id || !month || !year || !target_amount) {
    return NextResponse.json(
      { error: 'Campos requeridos: campus_id, month, year, target_amount' },
      { status: 400 }
    )
  }

  if (target_amount <= 0) {
    return NextResponse.json({ error: 'La meta debe ser mayor a 0' }, { status: 400 })
  }

  const { data, error } = await adminClient
    .from('campus_goals')
    .upsert(
      {
        campus_id,
        month: Number(month),
        year: Number(year),
        target_amount: Number(target_amount),
        target_orders: target_orders ? Number(target_orders) : null,
        notes: notes || null,
        created_by: profile.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'campus_id,month,year' }
    )
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, goal: data })
}, { permission: 'executive.view' })

// ─── DELETE /api/campus/goals ─────────────────────────────────────────────────
export const DELETE = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const { adminClient, profile } = ctx

  if (!['super_admin', 'adm_merch'].includes(profile.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const url = new URL(req.url)
  const goalId = url.searchParams.get('id')

  if (!goalId) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  }

  const { error } = await adminClient
    .from('campus_goals')
    .delete()
    .eq('id', goalId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}, { permission: 'executive.view' })
