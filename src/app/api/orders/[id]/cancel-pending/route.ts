import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error('Faltan variables de entorno de Supabase')
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

    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, role, campus_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, status, payment_status, payment_method, created_by, campus_id')
      .eq('id', params.id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    const canCancel =
      profile.role === 'super_admin' ||
      profile.role === 'adm_merch' ||
      order.created_by === profile.id ||
      order.campus_id === profile.campus_id

    if (!canCancel) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const isPending =
      ['pending', 'pending_payment', null].includes(order.payment_status as any) ||
      ['pending', 'pending_payment'].includes(order.status as any)

    if (!isPending) {
      return NextResponse.json({ success: true, skipped: true })
    }

    const { error: updateError } = await adminClient
      .from('orders')
      .update({
        status: 'cancelled',
        payment_status: 'cancelled',
        notes: 'Orden pendiente cancelada desde flujo de link de pago.',
      })
      .eq('id', order.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, status: 'cancelled' })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Error interno del servidor' },
      { status: 500 },
    )
  }
}
