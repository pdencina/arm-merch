import { NextRequest, NextResponse } from 'next/server'
import { withAuth, getEffectiveCampusId, verifyCampusAccess } from '@/lib/api'
import type { AuthContext } from '@/lib/api'

// ─── GET /api/transfers ───────────────────────────────────────────────────────
// Lista transferencias según el campus del usuario
export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const { adminClient, profile } = ctx
  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 20)))
  const offset = (page - 1) * limit

  let query = adminClient
    .from('inventory_transfers')
    .select(`
      *,
      product:products(id, name, sku, image_url),
      from_campus:campus!inventory_transfers_from_campus_fkey(id, name),
      to_campus:campus!inventory_transfers_to_campus_fkey(id, name),
      requester:profiles!inventory_transfers_requested_by_fkey(id, full_name),
      approver:profiles!inventory_transfers_approved_by_fkey(id, full_name),
      receiver:profiles!inventory_transfers_received_by_fkey(id, full_name)
    `, { count: 'exact' })
    .order('requested_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Campus filter for non-global roles
  if (!['super_admin', 'adm_merch'].includes(profile.role)) {
    query = query.or(`from_campus_id.eq.${profile.campus_id},to_campus_id.eq.${profile.campus_id}`)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    transfers: data ?? [],
    total: count ?? 0,
    page,
    limit,
  })
}, { permission: 'inventory.transfers.view' })

// ─── POST /api/transfers ──────────────────────────────────────────────────────
// Crear una nueva transferencia
export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const { adminClient, profile } = ctx
  const body = await req.json()

  const {
    from_campus_id,
    to_campus_id,
    product_id,
    quantity,
    notes,
  } = body

  if (!from_campus_id || !to_campus_id || !product_id || !quantity) {
    return NextResponse.json(
      { error: 'Campos requeridos: from_campus_id, to_campus_id, product_id, quantity' },
      { status: 400 }
    )
  }

  if (from_campus_id === to_campus_id) {
    return NextResponse.json(
      { error: 'El campus de origen y destino no pueden ser el mismo' },
      { status: 400 }
    )
  }

  const qty = Number(quantity)
  if (!Number.isInteger(qty) || qty <= 0) {
    return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 })
  }

  // Verificar que el usuario puede transferir desde este campus
  if (!verifyCampusAccess(profile, from_campus_id)) {
    return NextResponse.json(
      { error: 'No puedes crear transferencias desde un campus que no es el tuyo' },
      { status: 403 }
    )
  }

  // Verificar stock disponible en el campus origen
  const { data: inventory } = await adminClient
    .from('inventory')
    .select('id, stock')
    .eq('product_id', product_id)
    .eq('campus_id', from_campus_id)
    .single()

  if (!inventory) {
    return NextResponse.json(
      { error: 'No se encontró inventario para este producto en el campus de origen' },
      { status: 400 }
    )
  }

  if (inventory.stock < qty) {
    return NextResponse.json(
      { error: `Stock insuficiente. Disponible: ${inventory.stock}` },
      { status: 400 }
    )
  }

  // Crear la transferencia
  const { data: transfer, error: insertError } = await adminClient
    .from('inventory_transfers')
    .insert({
      from_campus_id,
      to_campus_id,
      product_id,
      quantity: qty,
      notes: notes || null,
      requested_by: profile.id,
      status: 'pending',
    })
    .select('*')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 })
  }

  // Audit log
  await adminClient.from('audit_log').insert({
    actor_id: profile.id,
    action: 'transfer.created',
    entity_type: 'inventory_transfer',
    entity_id: transfer.id,
    campus_id: from_campus_id,
    metadata: { from_campus_id, to_campus_id, product_id, quantity: qty },
  })

  return NextResponse.json({ success: true, transfer })
}, { permission: 'inventory.transfer' })

// ─── PATCH /api/transfers ─────────────────────────────────────────────────────
// Actualizar estado de una transferencia (approve, ship, receive, cancel)
export const PATCH = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const { adminClient, profile } = ctx
  const body = await req.json()
  const { transfer_id, action, notes } = body

  if (!transfer_id || !action) {
    return NextResponse.json(
      { error: 'transfer_id y action son requeridos' },
      { status: 400 }
    )
  }

  const validActions = ['approve', 'ship', 'receive', 'cancel']
  if (!validActions.includes(action)) {
    return NextResponse.json(
      { error: `Acción inválida. Opciones: ${validActions.join(', ')}` },
      { status: 400 }
    )
  }

  // Obtener transferencia actual
  const { data: transfer, error: fetchError } = await adminClient
    .from('inventory_transfers')
    .select('*')
    .eq('id', transfer_id)
    .single()

  if (fetchError || !transfer) {
    return NextResponse.json({ error: 'Transferencia no encontrada' }, { status: 404 })
  }

  // Validar transiciones de estado
  const transitions: Record<string, string[]> = {
    pending: ['approve', 'cancel'],
    in_transit: ['receive', 'cancel'],
  }

  const allowed = transitions[transfer.status] ?? []
  if (!allowed.includes(action)) {
    return NextResponse.json(
      { error: `No se puede ${action} una transferencia en estado "${transfer.status}"` },
      { status: 400 }
    )
  }

  let updateData: Record<string, any> = {}

  switch (action) {
    case 'approve': {
      // Descontar del campus origen y poner en tránsito
      const { data: srcInv } = await adminClient
        .from('inventory')
        .select('id, stock')
        .eq('product_id', transfer.product_id)
        .eq('campus_id', transfer.from_campus_id)
        .single()

      if (!srcInv || srcInv.stock < transfer.quantity) {
        return NextResponse.json(
          { error: 'Stock insuficiente en campus origen para aprobar' },
          { status: 400 }
        )
      }

      // Descontar stock
      await adminClient
        .from('inventory')
        .update({ stock: srcInv.stock - transfer.quantity, updated_by: profile.id })
        .eq('id', srcInv.id)

      // Registrar movimiento de salida
      await adminClient.from('inventory_movements').insert({
        product_id: transfer.product_id,
        campus_id: transfer.from_campus_id,
        type: 'salida',
        quantity: transfer.quantity,
        notes: `Transferencia #${transfer.id.slice(0, 8)} aprobada`,
        created_by: profile.id,
      })

      updateData = {
        status: 'in_transit',
        approved_by: profile.id,
        approved_at: new Date().toISOString(),
      }
      break
    }

    case 'ship': {
      updateData = {
        status: 'in_transit',
        approved_by: profile.id,
        approved_at: new Date().toISOString(),
      }
      break
    }

    case 'receive': {
      // Verificar acceso al campus destino
      if (!verifyCampusAccess(profile, transfer.to_campus_id)) {
        return NextResponse.json(
          { error: 'Solo el campus destino puede confirmar recepción' },
          { status: 403 }
        )
      }

      // Buscar o crear inventory row en destino
      const { data: destInv } = await adminClient
        .from('inventory')
        .select('id, stock')
        .eq('product_id', transfer.product_id)
        .eq('campus_id', transfer.to_campus_id)
        .single()

      if (destInv) {
        await adminClient
          .from('inventory')
          .update({ stock: destInv.stock + transfer.quantity, updated_by: profile.id })
          .eq('id', destInv.id)
      } else {
        await adminClient.from('inventory').insert({
          product_id: transfer.product_id,
          campus_id: transfer.to_campus_id,
          stock: transfer.quantity,
          updated_by: profile.id,
        })
      }

      // Registrar movimiento de entrada
      await adminClient.from('inventory_movements').insert({
        product_id: transfer.product_id,
        campus_id: transfer.to_campus_id,
        type: 'entrada',
        quantity: transfer.quantity,
        notes: `Transferencia #${transfer.id.slice(0, 8)} recibida`,
        created_by: profile.id,
      })

      updateData = {
        status: 'received',
        received_by: profile.id,
        received_at: new Date().toISOString(),
      }
      break
    }

    case 'cancel': {
      // Si ya estaba in_transit, devolver stock al origen
      if (transfer.status === 'in_transit') {
        const { data: srcInv } = await adminClient
          .from('inventory')
          .select('id, stock')
          .eq('product_id', transfer.product_id)
          .eq('campus_id', transfer.from_campus_id)
          .single()

        if (srcInv) {
          await adminClient
            .from('inventory')
            .update({ stock: srcInv.stock + transfer.quantity, updated_by: profile.id })
            .eq('id', srcInv.id)

          await adminClient.from('inventory_movements').insert({
            product_id: transfer.product_id,
            campus_id: transfer.from_campus_id,
            type: 'entrada',
            quantity: transfer.quantity,
            notes: `Transferencia #${transfer.id.slice(0, 8)} cancelada — devolución`,
            created_by: profile.id,
          })
        }
      }

      updateData = { status: 'cancelled' }
      break
    }
  }

  if (notes) {
    updateData.notes = [transfer.notes, notes].filter(Boolean).join(' | ')
  }

  const { error: updateError } = await adminClient
    .from('inventory_transfers')
    .update(updateData)
    .eq('id', transfer_id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  // Audit log
  await adminClient.from('audit_log').insert({
    actor_id: profile.id,
    action: `transfer.${action}`,
    entity_type: 'inventory_transfer',
    entity_id: transfer_id,
    campus_id: profile.campus_id,
    metadata: { action, from_status: transfer.status, to_status: updateData.status },
  })

  return NextResponse.json({ success: true, status: updateData.status ?? transfer.status })
}, { permission: 'inventory.transfer' })
