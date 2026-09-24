import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/orders/[id]/confirm-transfer
 *
 * Confirmación manual de una transferencia pendiente (el voluntario vio el
 * pago en el banco). Hace lo mismo que la verificación automática por Gmail:
 * marca la orden como pagada, descuenta stock y deja historial.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
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
      return NextResponse.json({ error: 'Faltan variables de entorno' }, { status: 500 })
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: { user }, error: userError } = await authClient.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, role, campus_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const { data: order } = await adminClient
      .from('orders')
      .select(
        'id, order_number, status, payment_method, total, amount_paid, notes, seller_id, campus_id, order_items(product_id, quantity, fulfillment_type)',
      )
      .eq('id', params.id)
      .single()

    if (!order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    const canConfirm =
      profile.role === 'super_admin' ||
      profile.role === 'adm_merch' ||
      order.seller_id === profile.id ||
      (profile.campus_id && order.campus_id === profile.campus_id)

    if (!canConfirm) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    if (order.status !== 'pending_transfer') {
      return NextResponse.json({ success: true, skipped: true, status: order.status })
    }

    const body = await req.json().catch(() => ({}))
    const operationNumber = String(body?.operation_number ?? '').trim()

    const note = operationNumber
      ? `✅ Confirmada manualmente · Op: ${operationNumber}`
      : '✅ Confirmada manualmente'
    const updatedNotes = [order.notes, note].filter(Boolean).join(' | ')

    // El filtro por status evita doble confirmación (y doble descuento de stock)
    // si el cron de Gmail o alguien más la confirma al mismo tiempo.
    const { data: updated, error: updateError } = await adminClient
      .from('orders')
      .update({ status: 'paid', payment_status: 'paid', notes: updatedNotes })
      .eq('id', order.id)
      .eq('status', 'pending_transfer')
      .select('id')

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    if (!updated || updated.length === 0) {
      return NextResponse.json({ success: true, skipped: true })
    }

    for (const item of (order.order_items ?? []) as any[]) {
      if (item.fulfillment_type === 'production') continue

      await adminClient.from('inventory_movements').insert({
        product_id: item.product_id,
        campus_id: order.campus_id,
        type: 'salida',
        quantity: item.quantity,
        notes: `Transferencia confirmada manualmente - Orden #${order.order_number}`,
        created_by: profile.id,
      })
    }

    await adminClient.from('order_status_history').insert({
      order_id: order.id,
      status: 'payment_confirmed',
      title: 'Transferencia confirmada',
      message: 'Recibimos tu transferencia. Tu compra fue confirmada correctamente.',
      created_by: profile.id,
    })

    const paidAmount = Number(order.amount_paid ?? order.total ?? 0)
    if (paidAmount > 0) {
      await adminClient.from('order_payments').insert({
        order_id: order.id,
        amount: paidAmount,
        payment_method: 'transferencia',
        payment_type: 'full_payment',
        notes: 'Transferencia confirmada manualmente',
        created_by: profile.id,
      })
    }

    return NextResponse.json({ success: true, status: 'paid', notes: updatedNotes })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Error interno del servidor' },
      { status: 500 },
    )
  }
}
