'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, UserRole } from '@/types'

interface UseUserReturn {
  profile: Profile | null
  role: UserRole | null
  loading: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  isAdmMerch: boolean
  isVoluntario: boolean
  isGlobalRole: boolean
  campusId: string | null
}

export function useUser(): UseUserReturn {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(data as Profile | null)
      setLoading(false)
    }

    getProfile()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      getProfile()
    })

    return () => subscription.unsubscribe()
  }, [])

  const role = profile?.role ?? null

  return {
    profile,
    role,
    loading,
    isSuperAdmin: role === 'super_admin',
    isAdmMerch: role === 'adm_merch',
    isAdmin: role === 'admin' || role === 'adm_merch' || role === 'super_admin',
    isVoluntario: role === 'voluntario',
    isGlobalRole: role === 'super_admin' || role === 'adm_merch',
    campusId: profile?.campus_id ?? null,
  }
}
