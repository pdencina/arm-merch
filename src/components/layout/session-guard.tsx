'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const INACTIVITY_TIMEOUT = 15 * 60 * 1000  // 15 minutos sin uso
const COUNTDOWN_SECONDS  = 20               // 20 segundos para responder

const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']

export default function SessionGuard() {
  const router                            = useRouter()
  const [showWarning, setShowWarning]     = useState(false)
  const [countdown, setCountdown]         = useState(COUNTDOWN_SECONDS)
  const inactivityTimer                   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownTimer                    = useRef<ReturnType<typeof setInterval> | null>(null)
  const warningShown                      = useRef(false)

  const logout = useCallback(async () => {
    clearTimeout(inactivityTimer.current!)
    clearInterval(countdownTimer.current!)
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }, [])

  const resetTimer = useCallback(() => {
    if (warningShown.current) return

    clearTimeout(inactivityTimer.current!)
    inactivityTimer.current = setTimeout(() => {
      warningShown.current = true
      setCountdown(COUNTDOWN_SECONDS)
      setShowWarning(true)

      let remaining = COUNTDOWN_SECONDS
      countdownTimer.current = setInterval(() => {
        remaining -= 1
        setCountdown(remaining)
        if (remaining <= 0) {
          clearInterval(countdownTimer.current!)
          logout()
        }
      }, 1000)
    }, INACTIVITY_TIMEOUT)
  }, [logout])

  const keepSession = useCallback(() => {
    clearInterval(countdownTimer.current!)
    warningShown.current = false
    setShowWarning(false)
    setCountdown(COUNTDOWN_SECONDS)
    resetTimer()
  }, [resetTimer])

  useEffect(() => {
    resetTimer()
    EVENTS.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    return () => {
      clearTimeout(inactivityTimer.current!)
      clearInterval(countdownTimer.current!)
      EVENTS.forEach(e => window.removeEventListener(e, resetTimer))
    }
  }, [resetTimer])

  if (!showWarning) return null

  const pct = (countdown / COUNTDOWN_SECONDS) * 100
  const r   = 20
  const circ = 2 * Math.PI * r

  return (
    <div
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          9999,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        background:      'rgba(0,0,0,0.55)',
        backdropFilter:  'blur(4px)',
      }}
    >
      <div
        style={{
          background:    '#111318',
          border:        '1px solid #2a2e38',
          borderRadius:  '20px',
          padding:       '32px 28px 24px',
          maxWidth:      '340px',
          width:         '90%',
          textAlign:     'center',
          boxShadow:     '0 24px 60px rgba(0,0,0,0.5)',
          animation:     'slideUp 0.25s ease',
        }}
      >
        {/* Countdown ring */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <svg width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r={r} fill="none" stroke="#1f2430" strokeWidth="4" />
            <circle
              cx="28" cy="28" r={r}
              fill="none"
              stroke={countdown <= 5 ? '#ef4444' : '#f59e0b'}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ - (pct / 100) * circ}
              transform="rotate(-90 28 28)"
              style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }}
            />
            <text
              x="28" y="33"
              textAnchor="middle"
              fontSize="16"
              fontWeight="700"
              fontFamily="monospace"
              fill={countdown <= 5 ? '#ef4444' : '#f59e0b'}
            >
              {countdown}
            </text>
          </svg>
        </div>

        <p style={{ fontSize: '15px', fontWeight: 600, color: '#f3f5f7', marginBottom: '8px' }}>
          ¿Sigues ahí?
        </p>
        <p style={{ fontSize: '12px', color: '#66707f', marginBottom: '24px', lineHeight: 1.5 }}>
          La sesión se cerrará por inactividad en <strong style={{ color: countdown <= 5 ? '#ef4444' : '#f59e0b' }}>{countdown}s</strong>
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={logout}
            style={{
              flex:          1,
              background:    'transparent',
              border:        '1px solid #2a2e38',
              borderRadius:  '10px',
              padding:       '10px',
              fontSize:      '13px',
              color:         '#66707f',
              cursor:        'pointer',
              fontFamily:    'inherit',
            }}
          >
            Cerrar sesión
          </button>
          <button
            onClick={keepSession}
            style={{
              flex:          2,
              background:    '#f59e0b',
              border:        'none',
              borderRadius:  '10px',
              padding:       '10px',
              fontSize:      '13px',
              fontWeight:    600,
              color:         '#000',
              cursor:        'pointer',
              fontFamily:    'inherit',
            }}
          >
            Continuar sesión
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}