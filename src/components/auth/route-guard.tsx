'use client'

import { ReactNode, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/lib/hooks/use-permissions'

export default function RouteGuard({
  permission,
  children,
}: {
  permission: string
  children: ReactNode
}) {
  const router = useRouter()
  const { loading, can } = usePermissions()

  useEffect(() => {
    if (!loading && !can(permission)) {
      router.replace('/dashboard')
    }
  }, [loading, can, permission, router])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (!can(permission)) return null

  return <>{children}</>
}
