import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const sumupApiKey = process.env.SUMUP_API_KEY
  const sumupMerchantCode = process.env.SUMUP_MERCHANT_CODE
  const sumupApiBase = process.env.SUMUP_API_BASE || 'https://api.sumup.com'

  return {
    supabaseUrl,
    supabaseAnonKey,
    serviceRoleKey,
    sumupApiKey,
    sumupMerchantCode,
    sumupApiBase,
  }
}

async function requireSuperAdmin(req: Request) {
  const authHeader = req.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      errorResponse: NextResponse.json({ error: 'No autenticado' }, { status: 401 }),
    }
  }

  const token = authHeader.replace('Bearer ', '').trim()
  const { supabaseUrl, supabaseAnonKey, serviceRoleKey } = getEnv()

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Faltan variables de entorno de Supabase' },
        { status: 500 }
      ),
    }
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey)
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(token)

  if (userError || !user) {
    return {
      errorResponse: NextResponse.json({ error: 'No autenticado' }, { status: 401 }),
    }
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return {
      errorResponse: NextResponse.json(
        { error: 'No se pudo cargar el perfil del usuario' },
        { status: 403 }
      ),
    }
  }

  if (profile.role !== 'super_admin') {
    return {
      errorResponse: NextResponse.json(
        { error: 'Solo el super admin puede administrar lectores SumUp' },
        { status: 403 }
      ),
    }
  }

  return { adminClient, user, profile }
}

export async function POST(req: Request) {
  try {
    const auth = await requireSuperAdmin(req)

    if (auth.errorResponse) return auth.errorResponse

    const { adminClient } = auth
    const { sumupApiKey, sumupMerchantCode, sumupApiBase } = getEnv()

    if (!sumupApiKey || !sumupMerchantCode) {
      return NextResponse.json(
        { error: 'Faltan variables SUMUP_API_KEY o SUMUP_MERCHANT_CODE' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const pairingCode = String(body?.pairing_code ?? '').trim().toUpperCase()
    const name = String(body?.name ?? '').trim()
    const campusId = body?.campus_id ? String(body.campus_id) : null

    if (!pairingCode) {
      return NextResponse.json({ error: 'El código de pairing es obligatorio' }, { status: 400 })
    }

    if (!name) {
      return NextResponse.json({ error: 'El nombre del lector es obligatorio' }, { status: 400 })
    }

    if (!campusId) {
      return NextResponse.json({ error: 'El campus es obligatorio' }, { status: 400 })
    }

    const sumupRes = await fetch(
      `${sumupApiBase}/v0.1/merchants/${encodeURIComponent(sumupMerchantCode)}/readers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sumupApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pairing_code: pairingCode,
          name,
          metadata: {
            campus_id: campusId,
            source: 'arm_merch',
          },
        }),
      }
    )

    const rawText = await sumupRes.text()
    let sumupReader: any = {}

    try {
      sumupReader = JSON.parse(rawText)
    } catch {
      sumupReader = { raw: rawText }
    }

    if (!sumupRes.ok) {
      return NextResponse.json(
        {
          error: sumupReader?.message ?? sumupReader?.error ?? 'SumUp rechazó el pairing',
          detail: sumupReader,
        },
        { status: 400 }
      )
    }

    const readerId = sumupReader?.id

    if (!readerId) {
      return NextResponse.json(
        { error: 'SumUp no devolvió reader_id', detail: sumupReader },
        { status: 400 }
      )
    }

    const device = sumupReader?.device ?? {}

    const { data: savedReader, error: saveError } = await adminClient
      .from('sumup_readers')
      .upsert(
        {
          campus_id: campusId,
          name,
          reader_id: readerId,
          reader_name: sumupReader?.name ?? name,
          device_model: device?.model ?? null,
          serial_number: device?.identifier ?? null,
          status: sumupReader?.status ?? 'unknown',
          active: true,
          metadata: sumupReader ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'reader_id' }
      )
      .select('*')
      .single()

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      reader: savedReader,
      sumup: sumupReader,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireSuperAdmin(req)

    if (auth.errorResponse) return auth.errorResponse

    const { adminClient } = auth
    const body = await req.json()
    const id = body?.id
    const active = body?.active

    if (!id || typeof active !== 'boolean') {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const { error } = await adminClient
      .from('sumup_readers')
      .update({
        active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
