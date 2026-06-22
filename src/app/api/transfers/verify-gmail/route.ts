import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkGmailTransfers } from '@/lib/gmail/check-transfers'

/**
 * POST /api/transfers/verify-gmail
 *
 * Verifica transferencias pendientes consultando Gmail.
 * Puede ser llamado manualmente desde el POS o por un cron.
 */
export async function POST(req: NextRequest) {
  try {
    // Autenticar
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '').trim()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const authClient = createClient(supabaseUrl, supabaseAnonKey)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: { user } } = await authClient.auth.getUser(token)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Solo roles con acceso a ventas
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['super_admin', 'adm_merch', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Ejecutar verificación
    const result = await checkGmailTransfers()

    return NextResponse.json({
      success: true,
      checked: result.checked,
      matched: result.matched,
      errors: result.errors,
    })
  } catch (error: any) {
    console.error('[Verify Gmail Transfers] Error:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Error verificando transferencias' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/transfers/verify-gmail
 * 
 * Endpoint para cron jobs (Vercel Cron o externo).
 * Verifica sin autenticación pero requiere secret header.
 */
export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  const expectedSecret = process.env.CRON_SECRET

  // Si no hay CRON_SECRET configurado, deshabilitar cron público
  if (!expectedSecret) {
    return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 })
  }

  if (cronSecret !== expectedSecret) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const result = await checkGmailTransfers()

  return NextResponse.json({
    success: true,
    checked: result.checked,
    matched: result.matched,
    errors: result.errors,
    timestamp: new Date().toISOString(),
  })
}
