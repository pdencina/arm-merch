'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type Role = 'super_admin' | 'admin' | 'voluntario'

export async function updateUserRole(userId: string, role: Role) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: callerRaw } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  const caller = callerRaw as { role: string } | null
  if (caller?.role !== 'super_admin') return { error: 'Sin permisos' }

  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
  if (error) return { error: error.message }

  revalidatePath('/settings/users')
  return { success: true }
}

export async function toggleUserActive(userId: string, active: boolean) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: callerRaw } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  const caller = callerRaw as { role: string } | null
  if (caller?.role !== 'super_admin') return { error: 'Sin permisos' }

  const { error } = await supabase.from('profiles').update({ active }).eq('id', userId)
  if (error) return { error: error.message }

  revalidatePath('/settings/users')
  return { success: true }
}
