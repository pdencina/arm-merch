import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function normalizeName(value: string) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '').trim()
    const q = String(req.nextUrl.searchParams.get('q') ?? '').trim()

    if (q.length < 2) {
      return NextResponse.json({ customers: [] })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Faltan variables de entorno' },
        { status: 500 }
      )
    }

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
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const query = q.replace(/[%_]/g, '')

    const { data, error } = await adminClient
      .from('order_contacts')
      .select('client_name, client_email, client_phone, created_at, order:orders(campus_id)')
      .or(`client_name.ilike.%${query}%,client_email.ilike.%${query}%,client_phone.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const rows = (data ?? []).filter((row: any) => {
      if (profile.role === 'super_admin' || profile.role === 'adm_merch') return true

      const orderCampusId = Array.isArray(row.order)
        ? row.order[0]?.campus_id
        : row.order?.campus_id

      return !profile.campus_id || orderCampusId === profile.campus_id
    })

    const unique = new Map<string, {
      name: string
      email: string | null
      phone: string | null
    }>()

    for (const row of rows as any[]) {
      const name = normalizeName(row.client_name ?? '')
      const email = row.client_email ? String(row.client_email).toLowerCase() : null
      const phone = row.client_phone ? String(row.client_phone) : null

      if (!name && !email && !phone) continue

      const key = `${name}|${email ?? ''}|${phone ?? ''}`

      if (!unique.has(key)) {
        unique.set(key, {
          name,
          email,
          phone,
        })
      }

      if (unique.size >= 8) break
    }

    return NextResponse.json({
      customers: Array.from(unique.values()),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Error interno' },
      { status: 500 }
    )
  }
}
