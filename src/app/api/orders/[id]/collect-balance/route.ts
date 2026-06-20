import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error('Faltan variables de entorno')
  }

  return { supabaseUrl, supabaseAnonKey, serviceRoleKey }
}

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
    const { supabaseUrl, supabaseAnonKey, serviceRoleKey } = getEnv()

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role, campus_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const amountReceived = Number(body.amount_received ?? 0)
    const paymentMethod = String(body.payment_method ?? 'efectivo')

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, order_number, total, amount_paid, balance_due, payment_status, campus_id, pickup_campus_id, production_status')
      .eq('id', params.id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    const pickupCampusId = order.pickup_campus_id || order.campus_id

    const canCollect =
      profile.role === 'super_admin' ||
      profile.role === 'adm_merch' ||
      profile.role === 'admin' ||
      profile.campus_id === pickupCampusId

    if (!canCollect) {
      return NextResponse.json(
        { error: 'No tienes permisos para cobrar el saldo de esta orden' },
        { status: 403 },
      )
    }

    const balanceDue = Number(order.balance_due ?? 0)

    if (balanceDue <= 0) {
      return NextResponse.json({ error: 'Esta orden no tiene saldo pendiente' }, { status: 400 })
    }

    const isCash = paymentMethod === 'efectivo'

    if (isCash && amountReceived < balanceDue) {
      return NextResponse.json(
        { error: `El monto recibido debe ser igual o mayor al saldo pendiente` },
        { status: 400 },
      )
    }

    const effectiveAmountReceived = isCash ? amountReceived : balanceDue
    const newAmountPaid = Number(order.total ?? 0)
    const change = Math.max(0, effectiveAmountReceived - balanceDue)

    const { error: updateError } = await adminClient
      .from('orders')
      .update({
        amount_paid: newAmountPaid,
        balance_due: 0,
        payment_status: 'paid',
        payment_type: 'full_payment',
        status: 'paid',
      })
      .eq('id', order.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    await adminClient.from('order_status_history').insert({
      order_id: order.id,
      status: 'balance_paid',
      title: 'Saldo pagado',
      message: `Saldo pendiente pagado por ${paymentMethod}. Vuelto: $${change.toLocaleString('es-CL')}.`,
      created_by: profile.id,
    })

    return NextResponse.json({
      success: true,
      order_id: order.id,
      order_number: order.order_number,
      amount_paid: newAmountPaid,
      balance_due: 0,
      payment_status: 'paid',
      change,
    })
  } catch (error: any) {
    console.error('POST /api/orders/[id]/collect-balance error:', error)

    return NextResponse.json(
      { error: error?.message ?? 'Error interno del servidor' },
      { status: 500 },
    )
  }
}
