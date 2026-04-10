import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({
        error: 'Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno de Vercel'
      }, { status: 500 })
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { email, password, full_name, role, campus_id } = await req.json()

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Email, contraseña y nombre son obligatorios' }, { status: 400 })
    }

    // Crear usuario en auth con email ya confirmado
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Crear perfil con rol y campus
    const { error: profileError } = await adminClient.from('profiles').upsert({
      id:        authData.user.id,
      full_name,
      email,
      role:      role ?? 'voluntario',
      campus_id: campus_id || null,
      active:    true,
    })

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, user_id: authData.user.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
