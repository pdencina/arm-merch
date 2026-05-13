'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TrackingAutoRefresh({
  intervalMs = 8000,
}: {
  intervalMs?: number
}) {
  const router = useRouter()

  useEffect(() => {
    const refresh = () => {
      router.refresh()
    }

    const interval = window.setInterval(refresh, intervalMs)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [router, intervalMs])

  return null
}
