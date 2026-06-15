import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mergeRolePermissions, hasPermission } from '@/lib/permissions/module-permissions'

export interface AuthContext {
  user: { id: string; email?: string }
  profile: {
    id: string
    role: 'super_admin' | 'adm_merch' | 'admin' | 'voluntario'
    campus_id: string | null
    full_name: string | null
    email: string | null
    active: boolean
  }
  permissions: Record<string, boolean>
  /** Supabase client with service_role key — bypasses RLS */
  adminClient: any
  token: string
}

type AuthenticatedHandler = (
  req: NextRequest,
  ctx: AuthContext
) => Promise<NextResponse> | NextResponse

interface WithAuthOptions {
  permission?: string
}

function getEnvOrFail() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return null
  }

  return { supabaseUrl, supabaseAnonKey, serviceRoleKey }
}

export function withAuth(handler: AuthenticatedHandler, options?: WithAuthOptions) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const authHeader = req.headers.get('authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
      }

      const token = authHeader.replace('Bearer ', '').trim()
      const env = getEnvOrFail()

      if (!env) {
        return NextResponse.json({ error: 'Faltan variables de entorno' }, { status: 500 })
      }

      const { supabaseUrl, supabaseAnonKey, serviceRoleKey } = env

      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { autoRefreshToken: false, persistSession: false },
      })

      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      const { data: { user }, error: userError } = await authClient.auth.getUser()

      if (userError || !user) {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
      }

      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('id, role, campus_id, full_name, email, active')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
      }

      if (profile.active === false) {
        return NextResponse.json({ error: 'Cuenta deshabilitada' }, { status: 403 })
      }

      // Build permissions
      let permissions: Record<string, boolean>

      if (profile.role === 'super_admin') {
        permissions = mergeRolePermissions('super_admin')
      } else {
        const { data: permRows } = await adminClient
          .from('module_permissions')
          .select('module, enabled')
          .eq('role', profile.role)

        const overrides: Record<string, boolean> = {}
        ;(permRows ?? []).forEach((row: any) => {
          overrides[row.module] = row.enabled
        })

        permissions = mergeRolePermissions(profile.role, overrides)
      }

      // Check specific permission if required
      if (options?.permission) {
        if (!hasPermission(profile.role, options.permission, permissions)) {
          return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
        }
      }

      const ctx: AuthContext = {
        user: { id: user.id, email: user.email },
        profile: profile as AuthContext['profile'],
        permissions,
        adminClient,
        token,
      }

      return await handler(req, ctx)
    } catch (error: any) {
      console.error('withAuth error:', error)
      return NextResponse.json(
        { error: error?.message ?? 'Error interno del servidor' },
        { status: 500 }
      )
    }
  }
}

/**
 * Helper to get the effective campus_id for a request.
 * Super admins can specify a campus_id in the body, others use their profile's.
 */
export function getEffectiveCampusId(
  profile: AuthContext['profile'],
  requestedCampusId?: string | null
): string | null {
  if (profile.role === 'super_admin' || profile.role === 'adm_merch') {
    return requestedCampusId || profile.campus_id
  }
  return profile.campus_id
}

/**
 * Helper to verify a resource belongs to the user's campus.
 */
export function verifyCampusAccess(
  profile: AuthContext['profile'],
  resourceCampusId: string | null
): boolean {
  if (profile.role === 'super_admin' || profile.role === 'adm_merch') return true
  return resourceCampusId === profile.campus_id
}
