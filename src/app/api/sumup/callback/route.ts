import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://armerch.com'

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  console.log('[SumUp callback] Recibido, code presente:', Boolean(code))

  if (error || !code) {
    console.error('[SumUp callback] Error:', error)
    return NextResponse.redirect(`${APP_URL}/pos?sumup=error&reason=${error ?? 'no_code'}`)
  }

  const clientId     = process.env.SUMUP_CLIENT_ID
  const clientSecret = process.env.SUMUP_CLIENT_SECRET
  const redirectUri  = `${APP_URL}/api/sumup/callback`

  if (!clientId || !clientSecret) {
    console.error('[SumUp callback] Faltan variables de entorno')
    return NextResponse.redirect(`${APP_URL}/pos?sumup=error&reason=missing_env`)
  }

  // Intercambiar code por access_token
  const tokenRes = await fetch('https://api.sumup.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  redirectUri,
    }),
  })

  const tokenText = await tokenRes.text()

  let token: any
  try { token = JSON.parse(tokenText) } catch { token = {} }

  if (!token.access_token) {
    console.error('[SumUp callback] Token exchange failed, status:', tokenRes.status)
    return NextResponse.redirect(`${APP_URL}/pos?sumup=error&reason=token_failed`)
  }

  // Guardar token en Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error: dbError } = await supabase.from('app_settings').upsert({
    key:        'sumup_access_token',
    value:      JSON.stringify({
      access_token:  token.access_token,
      refresh_token: token.refresh_token ?? null,
      expires_at:    Date.now() + (token.expires_in ?? 3600) * 1000,
    }),
    updated_at: new Date().toISOString(),
  })

  if (dbError) {
    console.error('[SumUp callback] Error guardando token')
    return NextResponse.redirect(`${APP_URL}/pos?sumup=error&reason=db_error`)
  }

  return NextResponse.redirect(`${APP_URL}/pos?sumup=connected`)
}
