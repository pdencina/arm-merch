import { createClient } from '@/lib/supabase/client'

export async function hasPermission(
  role: string,
  permission: string
): Promise<boolean> {

  // SUPER ADMIN = acceso total
  if (role === 'super_admin') {
    return true
  }

  const supabase = createClient()

  const { data, error } = await supabase
    .from('module_permissions')
    .select('enabled')
    .eq('role', role)
    .eq('module', permission)
    .single()

  if (error) {
    console.error('[Permissions] Error:', error)
    return false
  }

  return data?.enabled === true
}