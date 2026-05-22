'use server'

import { createClient } from '@/lib/supabase/server'

export type CurrentProfile = {
  id: string
  role: 'super_admin' | 'adm_merch' | 'admin' | 'voluntario'
  campus_id: string | null
  full_name: string | null
  email: string | null
  active?: boolean | null
}

export async function getCurrentProfile(): Promise<
  { data: CurrentProfile } | { error: string }
> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'No autenticado' }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, campus_id, full_name, email, active')
    .eq('id', user.id)
    .single()

  if (error || !data) {
    return { error: 'Perfil no encontrado' }
  }

  return {
    data: {
      id: data.id,
      role: data.role,
      campus_id: data.campus_id,
      full_name: data.full_name,
      email: data.email,
      active: data.active,
    },
  }
}