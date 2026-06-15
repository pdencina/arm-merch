import { NextRequest, NextResponse } from 'next/server'
import { withAuth, verifyCampusAccess } from '@/lib/api'
import type { AuthContext } from '@/lib/api'

// ─── PATCH /api/inventory ─────────────────────────────────────────────────────
// Recibe inventory_id en el body (en lugar de en la URL)
// Usado por movement-form.tsx para actualizar stock
// ─────────────────────────────────────────────────────────────────────────────
export const PATCH = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const { adminClient, profile } = ctx
  const body = await req.json()
  const inventoryId = body.inventory_id
  const newStock = Number(body.stock)

  if (!inventoryId) {
    return NextResponse.json({ error: 'inventory_id requerido' }, { status: 400 })
  }
  if (isNaN(newStock) || newStock < 0) {
    return NextResponse.json({ error: 'Stock inválido' }, { status: 400 })
  }

  // Verificar que el inventory_id pertenece al campus del Admin
  if (!['super_admin', 'adm_merch'].includes(profile.role)) {
    const { data: invRow } = await adminClient
      .from('inventory')
      .select('campus_id')
      .eq('id', inventoryId)
      .single() as { data: { campus_id: string | null } | null; error: any }

    if (!invRow) {
      return NextResponse.json({ error: 'Inventario no encontrado' }, { status: 404 })
    }

    if (!verifyCampusAccess(profile, invRow.campus_id)) {
      return NextResponse.json(
        { error: 'No autorizado: este inventario no pertenece a tu campus' },
        { status: 403 }
      )
    }
  }

  const { error: updateError } = await adminClient
    .from('inventory')
    .update({
      stock: newStock,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', inventoryId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}, { permission: 'inventory.adjust' })
