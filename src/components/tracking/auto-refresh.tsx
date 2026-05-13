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
    const timer = window.setInterval(() => {
      router.refresh()
    }, intervalMs)

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        router.refresh()
      }
    }

    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [router, intervalMs])

  return null
}
