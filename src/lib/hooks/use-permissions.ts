'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hasPermission, mergeRolePermissions } from '@/lib/permissions/module-permissions'

export function usePermissions() {
  const [role, setRole] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          if (mounted) {
            setError('No autenticado')
            setLoading(false)
          }
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()

        if (profileError || !profile) {
          if (mounted) {
            setError('Perfil no encontrado')
            setLoading(false)
          }
          return
        }

        const currentRole = profile.role

        if (currentRole === 'super_admin') {
          if (mounted) {
            setRole(currentRole)
            setPermissions(mergeRolePermissions(currentRole))
            setLoading(false)
          }
          return
        }

        const { data: rows } = await supabase
          .from('module_permissions')
          .select('module, enabled')
          .eq('role', currentRole)

        const overrides: Record<string, boolean> = {}
        ;(rows ?? []).forEach((row: any) => {
          overrides[row.module] = row.enabled
        })

        if (mounted) {
          setRole(currentRole)
          setPermissions(mergeRolePermissions(currentRole, overrides))
          setLoading(false)
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message ?? 'Error cargando permisos')
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [])

  const can = useMemo(
    () => (permission: string) => hasPermission(role, permission, permissions),
    [role, permissions],
  )

  return { role, permissions, loading, error, can }
}
