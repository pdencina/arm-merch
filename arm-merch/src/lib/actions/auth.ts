'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(email: string, password: string) {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { error: 'Credenciales incorrectas. Verifica tu email y contraseña.' }
  }
  redirect('/dashboard')
}

export async function logout() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function getCurrentUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (data ?? null) as {
    id: string
    full_name: string
    email: string
    role: 'super_admin' | 'admin' | 'voluntario'
    avatar_url: string | null
    active: boolean
    created_at: string
    updated_at: string
  } | null
}
