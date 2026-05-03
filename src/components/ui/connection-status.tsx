'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export default function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const handleOnline  = () => { setIsOnline(true);  setShowBanner(false) }
    const handleOffline = () => { setIsOnline(false); setShowBanner(true) }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    // Check initial state
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Show reconnected banner briefly
  useEffect(() => {
    if (isOnline && showBanner) {
      const t = setTimeout(() => setShowBanner(false), 3000)
      return () => clearTimeout(t)
    }
  }, [isOnline, showBanner])

  if (!showBanner) return null

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-lg transition-all ${
      isOnline
        ? 'bg-green-500 text-white'
        : 'bg-red-500 text-white'
    }`}>
      {isOnline ? (
        <>✅ Conexión restaurada</>
      ) : (
        <><WifiOff size={15} /> Sin conexión — las ventas pueden fallar</>
      )}
    </div>
  )
}
