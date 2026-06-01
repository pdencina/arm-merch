import { NextResponse } from 'next/server'

export async function hasApiPermission(
  adminClient: any,
  role: string | null | undefined,
  permission: string,
) {
  if (!role) return false

  // Super Admin mantiene acceso total.
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

export async function requireApiPermission(
  adminClient: any,
  profile: { role?: string | null } | null | undefined,
  permission: string,
  message = 'No autorizado',
) {
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
  }
}
