'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hasPermission } from '@/lib/permissions'

export function usePermission(permission: string) {

  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {

    const load = async () => {

      try {

        const supabase = createClient()

        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          setAllowed(false)
          setLoading(false)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()

        const can = await hasPermission(
          profile?.role ?? 'voluntario',
          permission
        )

        setAllowed(can)

      } catch (err) {

        console.error('[usePermission]', err)
        setAllowed(false)

      } finally {

        setLoading(false)

      }
    }

    load()

  }, [permission])

  return {
    allowed,
    loading,
  }
}