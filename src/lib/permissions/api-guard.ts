import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hasPermission, mergeRolePermissions } from '@/lib/permissions/module-permissions'

export async function requireApiPermission(req: Request, permission: string) {
  const authHeader = req.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false as const, response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  }

  const token = authHeader.replace('Bearer ', '').trim()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return { ok: false as const, response: NextResponse.json({ error: 'Faltan variables de entorno' }, { status: 500 }) }
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: { user }, error: userError } = await authClient.auth.getUser()

  if (userError || !user) {
    return { ok: false as const, response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  }

  const { data: profile } = await adminClient
    .from('profiles')
    .select('id, role, campus_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return { ok: false as const, response: NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 }) }
  }

  if (profile.role === 'super_admin') {
    return { ok: true as const, user, profile, adminClient, permissions: mergeRolePermissions(profile.role) }
  }

  const { data: rows } = await adminClient
    .from('module_permissions')
    .select('module, enabled')
    .eq('role', profile.role)

  const overrides: Record<string, boolean> = {}
  ;(rows ?? []).forEach((row: any) => {
    overrides[row.module] = row.enabled
  })

  const permissions = mergeRolePermissions(profile.role, overrides)

  if (!hasPermission(profile.role, permission, permissions)) {
    return { ok: false as const, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  }

  return { ok: true as const, user, profile, adminClient, permissions }
}
