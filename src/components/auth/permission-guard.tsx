'use client'

import { ReactNode } from 'react'
import { usePermissions } from '@/lib/hooks/use-permissions'

export default function PermissionGuard({
  permission,
  children,
  fallback = null,
}: {
  permission: string
  children: ReactNode
  fallback?: ReactNode
}) {
  const { loading, can } = usePermissions()

  if (loading) return null
  if (!can(permission)) return <>{fallback}</>

  return <>{children}</>
}
