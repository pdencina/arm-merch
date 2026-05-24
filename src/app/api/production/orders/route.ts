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

export async function GET(req: NextRequest) {
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

    let query = adminClient
      .from('orders')
      .select(`
        id,
        order_number,
        campus_id,
        pickup_campus_id,
        total,
        amount_paid,
        balance_due,
        payment_status,
        payment_type,
        created_at,
        production_status,
        tracking_token,
        order_contacts(client_name, client_email, client_phone),
        order_items(
          id,
          quantity,
          unit_price,
          size,
          fulfillment_type,
          production_started_at,
          ready_pickup_at,
          delivered_at,
          products(name, sku)
        )
      `)
      .in('production_status', [
        'pending_production',
        'in_production',
        'ready_pickup',
        'delivered',
      ])
      .order('created_at', { ascending: false })

    if (profile.role !== 'super_admin' && profile.campus_id) {
      query = query.or(
        `campus_id.eq.${profile.campus_id},pickup_campus_id.eq.${profile.campus_id}`
      )
    }

    const [{ data: orders, error: ordersError }, { data: campuses }] =
      await Promise.all([
        query,
        adminClient.from('campus').select('id, name').order('name'),
      ])

    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 400 })
    }

    return NextResponse.json({
      profile: {
        role: profile.role,
        campus_id: profile.campus_id,
      },
      orders: orders ?? [],
      campuses: campuses ?? [],
    })
  } catch (error: any) {
    console.error('GET /api/production/orders error:', error)

    return NextResponse.json(
      { error: error?.message ?? 'Error interno del servidor' },
      { status: 500 },
    )
  }
}
