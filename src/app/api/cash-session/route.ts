import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function isCashPaymentMethod(method: unknown) {
  const value = String(method ?? '').trim().toLowerCase()
  return ['efectivo', 'cash'].includes(value)
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '').trim()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    const authClient = createClient(supabaseUrl!, supabaseAnonKey!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const adminClient = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, role, campus_id')
      .eq('id', user.id)
      .single()

    if (!profile?.campus_id) {
      return NextResponse.json({ error: 'Campus no encontrado' }, { status: 400 })
    }

    const campusId = profile.campus_id

    const { data: openSession, error: openError } = await adminClient
      .from('cash_sessions')
      .select('*')
      .eq('campus_id', campusId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (openError) {
      return NextResponse.json({ error: openError.message }, { status: 400 })
    }

    const { data: history, error: historyError } = await adminClient
      .from('cash_sessions')
      .select('*')
      .eq('campus_id', campusId)
      .order('opened_at', { ascending: false })
      .limit(20)

    if (historyError) {
      return NextResponse.json({ error: historyError.message }, { status: 400 })
    }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: todayOrders, error: todayOrdersError } = await adminClient
      .from('orders')
      .select('id, total, created_at, payment_method, status')
      .eq('campus_id', campusId)
      .eq('status', 'paid')
      .gte('created_at', todayStart.toISOString())

    if (todayOrdersError) {
      return NextResponse.json({ error: todayOrdersError.message }, { status: 400 })
    }

    const todaySalesTotal = (todayOrders ?? []).reduce(
      (sum: number, order: any) => sum + Number(order.total ?? 0),
      0
    )

    const todayCashSalesTotal = (todayOrders ?? [])
      .filter((order: any) => isCashPaymentMethod(order.payment_method))
      .reduce((sum: number, order: any) => sum + Number(order.total ?? 0), 0)

    const todayOrdersCount = (todayOrders ?? []).length

    const paymentSummaryMap = new Map<string, number>()
    for (const order of todayOrders ?? []) {
      const method = order.payment_method || 'Sin definir'
      paymentSummaryMap.set(method, (paymentSummaryMap.get(method) || 0) + Number(order.total ?? 0))
    }

    const paymentSummary = Array.from(paymentSummaryMap.entries()).map(([method, total]) => ({
      method,
      total,
    }))

    return NextResponse.json({
      session: openSession ?? null,
      history: history ?? [],
      daily_summary: {
        sales_total: todaySalesTotal,
        cash_sales_total: todayCashSalesTotal,
        orders_count: todayOrdersCount,
        payment_summary: paymentSummary,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Error interno' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '').trim()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    const authClient = createClient(supabaseUrl!, supabaseAnonKey!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const adminClient = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, role, campus_id')
      .eq('id', user.id)
      .single()

    if (!profile?.campus_id) {
      return NextResponse.json({ error: 'Campus no encontrado' }, { status: 400 })
    }

    const body = await req.json()
    const action = body.action

    if (action === 'open') {
      const openingAmount = Number(body.opening_amount ?? 0)
      const notes = body.notes ?? null

      const { data: existing } = await adminClient
        .from('cash_sessions')
        .select('id')
        .eq('campus_id', profile.campus_id)
        .eq('status', 'open')
        .limit(1)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          { error: 'Ya existe una caja abierta en este campus' },
          { status: 400 }
        )
      }

      const { data, error } = await adminClient
        .from('cash_sessions')
        .insert({
          campus_id: profile.campus_id,
          opened_by: profile.id,
          opening_amount: openingAmount,
          notes,
          status: 'open',
        })
        .select('*')
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ success: true, session: data })
    }

    if (action === 'close') {
      const closingAmountDeclared = Number(body.closing_amount_declared ?? 0)
      const notes = body.notes ?? null

      const { data: openSession } = await adminClient
        .from('cash_sessions')
        .select('*')
        .eq('campus_id', profile.campus_id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!openSession) {
        return NextResponse.json(
          { error: 'No hay una caja abierta para cerrar' },
          { status: 400 }
        )
      }

      const { data: orders, error: ordersError } = await adminClient
        .from('orders')
        .select('id, total, created_at, campus_id, payment_method, status')
        .eq('campus_id', profile.campus_id)
        .eq('status', 'paid')
        .gte('created_at', openSession.opened_at)

      if (ordersError) {
        return NextResponse.json({ error: ordersError.message }, { status: 400 })
      }

      // Caja física = monto inicial + ventas pagadas en efectivo.
      // SumUp, Link de Pago y Transferencia NO deben sumarse al arqueo físico.
      const cashOrders = (orders ?? []).filter(
        (order: any) => isCashPaymentMethod(order.payment_method)
      )

      const salesTotal = cashOrders.reduce(
        (sum: number, order: any) => sum + Number(order.total ?? 0),
        0
      )

      const ordersCount = cashOrders.length
      const expectedCash = Number(openSession.opening_amount ?? 0) + salesTotal
      const difference = closingAmountDeclared - expectedCash

      const { data, error } = await adminClient
        .from('cash_sessions')
        .update({
          closed_by: profile.id,
          closed_at: new Date().toISOString(),
          closing_amount_declared: closingAmountDeclared,
          sales_total: salesTotal,
          orders_count: ordersCount,
          difference,
          notes,
          status: 'closed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', openSession.id)
        .select('*')
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        session: data,
        summary: {
          expected_cash: expectedCash,
          sales_total: salesTotal,
          orders_count: ordersCount,
          difference,
        },
      })
    }

    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Error interno' },
      { status: 500 }
    )
  }
}