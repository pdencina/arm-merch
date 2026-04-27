import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ exists: false })

    // Service role bypasses RLS — can read profiles freely
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Check profiles table (case-insensitive)
    const { data } = await adminClient
      .from('profiles')
      .select('id')
      .ilike('email', email.trim())
      .maybeSingle()

    return NextResponse.json({ exists: !!data })
  } catch {
    return NextResponse.json({ exists: false })
  }
}
