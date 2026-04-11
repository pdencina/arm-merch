import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, active, campus_id, created_at')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: campus } = await supabase
      .from('campus')
      .select('id, name')
      .eq('active', true)
      .order('name')

    return NextResponse.json({ profiles: profiles ?? [], campus: campus ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
