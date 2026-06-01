import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type ApiPermissionResult =
  | {
      ok: true
      user?: any
      profile?: any
      adminClient?: any
    }
  | {
      ok: false
      response: NextResponse
    }

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Faltan variables de entorno de Supabase')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function getApiAuthContext(
  req: NextRequest,
  adminClient = createAdminClient(),
): Promise<ApiPermissionResult> {
  const authHeader = req.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }),
    }
  }

  const token = authHeader.replace('Bearer ', '').trim()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Faltan variables de entorno de Supabase' },
        { status: 500 },
      ),
    }
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser()

  if (userError || !user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }),
    }
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, full_name, email, role, campus_id, active')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 }),
    }
  }

  if (profile.active === false) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Usuario inactivo' }, { status: 403 }),
    }
  }

  return {
    ok: true as const,
    user,
    profile,
    adminClient,
  }
}

export async function hasApiPermission(
  adminClient: any,
  role: string | null | undefined,
  permission: string,
) {
  if (!role) return false

  if (role === 'super_admin') return true

  const { data, error } = await adminClient
    .from('module_permissions')
    .select('enabled')
    .eq('role', role)
    .eq('module', permission)
    .maybeSingle()

  if (error) {
    console.error('[API Permissions] Error validando permiso:', error)
    return false
  }

  return data?.enabled === true
}

// Compatible con ambos usos:
// 1) requireApiPermission(req, 'permiso', 'mensaje')
// 2) requireApiPermission(adminClient, profile, 'permiso', 'mensaje')
export async function requireApiPermission(...args: any[]): Promise<ApiPermissionResult> {
  // Firma nueva: (req, permission, message?, adminClient?)
  if (args[0] instanceof NextRequest || typeof args[0]?.headers?.get === 'function') {
    const req = args[0] as NextRequest
    const permission = args[1] as string
    const message = (args[2] as string) || 'No autorizado'
    const adminClient = args[3] || createAdminClient()

    const context = await getApiAuthContext(req, adminClient)

    if (context.ok === false) return context

    const allowed = await hasApiPermission(
      adminClient,
      context.profile?.role,
      permission,
    )

    if (!allowed) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: message }, { status: 403 }),
      }
    }

    return context
  }

  // Firma anterior usada por /api/orders:
  // (adminClient, profile, permission, message?)
  const adminClient = args[0]
  const profile = args[1]
  const permission = args[2] as string
  const message = (args[3] as string) || 'No autorizado'

  const allowed = await hasApiPermission(
    adminClient,
    profile?.role,
    permission,
  )

  if (!allowed) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: message }, { status: 403 }),
    }
  }

  return {
    ok: true as const,
    profile,
    adminClient,
  }
}

export async function auditAction(
  adminClient: any,
  payload: {
    actor_id?: string | null
    action: string
    target_type?: string | null
    target_id?: string | null
    permission?: string | null
    metadata?: Record<string, any> | null
  },
) {
  try {
    await adminClient.from('audit_logs').insert({
      actor_id: payload.actor_id ?? null,
      action: payload.action,
      target_type: payload.target_type ?? null,
      target_id: payload.target_id ?? null,
      permission: payload.permission ?? null,
      metadata: payload.metadata ?? null,
    })
  } catch (error) {
    console.error('[Audit] Error registrando acción:', error)
  }
}
