'use server'

import { createClient } from '@/lib/supabase/server'

export async function login(email: string, password: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  if (error) {
    return {
      error: 'Credenciales incorrectas. Verifica tu email y contraseña.',
    }
  }

  return { success: true }
}

export async function logout() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    return { error: 'No se pudo cerrar sesión.' }
  }

  return { success: true }
}