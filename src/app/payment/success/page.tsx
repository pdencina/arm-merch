'use client'

import { useEffect, useMemo, useState } from 'react'

type VerifyState = 'checking' | 'paid' | 'pending' | 'cancelled' | 'error'

export default function PaymentSuccessPage() {
  const [visible, setVisible] = useState(false)
  const [state, setState] = useState<VerifyState>('checking')
  const [message, setMessage] = useState('Estamos confirmando tu pago con SumUp...')
  const [orderNumber, setOrderNumber] = useState<string | number | null>(null)

  const checkoutReference = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('checkout_reference') ?? ''
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!checkoutReference) {
      setState('error')
      setMessage('No encontramos la referencia del pago. Si el cobro fue realizado, avisa al equipo ARM Merch.')
      return
    }

    let cancelled = false
    let attempts = 0
    const maxAttempts = 12

    async function verifyPayment() {
      attempts += 1

      try {
        const res = await fetch('/api/sumup/confirm-by-reference', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            checkout_reference: checkoutReference,
          }),
        })

        const data = await res.json().catch(() => null)

        if (cancelled) return

        if (data?.order_number) {
          setOrderNumber(data.order_number)
        }

        if (res.ok && data?.order_status === 'paid') {
          setState('paid')
          setMessage('Tu pago fue confirmado correctamente. Enviaremos el comprobante a tu correo.')
          return
        }

        if (res.ok && data?.order_status === 'cancelled') {
          setState('cancelled')
          setMessage('El pago fue cancelado o rechazado por SumUp.')
          return
        }

        if (attempts >= maxAttempts) {
          setState('pending')
          setMessage('Tu pago está siendo validado. Si el cobro aparece en tu billetera, el equipo ARM Merch podrá regularizarlo.')
          return
        }

        setState('checking')
        setMessage('Seguimos esperando la confirmación final de SumUp...')
        setTimeout(verifyPayment, 2500)
      } catch {
        if (cancelled) return

        if (attempts >= maxAttempts) {
          setState('error')
          setMessage('No pudimos confirmar el pago automáticamente. Si el cobro fue realizado, avisa al equipo ARM Merch.')
          return
        }

        setTimeout(verifyPayment, 2500)
      }
    }

    verifyPayment()

    return () => {
      cancelled = true
    }
  }, [checkoutReference])

  const isSuccess = state === 'paid'
  const isPending = state === 'checking' || state === 'pending'
  const isError = state === 'error' || state === 'cancelled'

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Georgia', serif",
      padding: '24px',
    }}>
      <div style={{
        position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none',
      }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: i % 2 === 0 ? '300px' : '200px',
            height: i % 2 === 0 ? '300px' : '200px',
            borderRadius: '50%',
            background: i % 3 === 0
              ? 'radial-gradient(circle, rgba(34,197,94,0.06) 0%, transparent 70%)'
              : i % 3 === 1
              ? 'radial-gradient(circle, rgba(245,158,11,0.04) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(139,92,246,0.04) 0%, transparent 70%)',
            left: `${[10, 70, 30, 85, 15, 60][i]}%`,
            top: `${[20, 10, 60, 50, 80, 30][i]}%`,
            transform: 'translate(-50%, -50%)',
          }} />
        ))}
      </div>

      <div style={{
        position: 'relative',
        maxWidth: '440px',
        width: '100%',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '28px',
          padding: '48px 40px',
          textAlign: 'center',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 40px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}>
          <div style={{
            width: '88px',
            height: '88px',
            borderRadius: '50%',
            background: isSuccess
              ? 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.05))'
              : isError
                ? 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))'
                : 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))',
            border: isSuccess
              ? '2px solid rgba(34,197,94,0.3)'
              : isError
                ? '2px solid rgba(239,68,68,0.3)'
                : '2px solid rgba(245,158,11,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 32px',
            boxShadow: isSuccess
              ? '0 0 40px rgba(34,197,94,0.15)'
              : isError
                ? '0 0 40px rgba(239,68,68,0.15)'
                : '0 0 40px rgba(245,158,11,0.15)',
            animation: isPending ? 'pulse 1.8s ease-in-out infinite' : 'none',
          }}>
            {isSuccess ? (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : isError ? (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <path d="M12 6v6l4 2" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="9" stroke="#f59e0b" strokeWidth="2.5" />
              </svg>
            )}
          </div>

          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#ffffff',
            margin: '0 0 12px',
            letterSpacing: '-0.5px',
            lineHeight: 1.2,
          }}>
            {isSuccess ? '¡Pago confirmado!' : isError ? 'No pudimos confirmar' : 'Verificando pago'}
          </h1>

          <p style={{
            fontSize: '15px',
            color: 'rgba(255,255,255,0.45)',
            margin: '0 0 36px',
            lineHeight: 1.6,
            fontFamily: 'sans-serif',
          }}>
            {message}
          </p>

          <div style={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
            margin: '0 0 32px',
          }} />

          <div style={{
            background: isSuccess
              ? 'rgba(34,197,94,0.05)'
              : isError
                ? 'rgba(239,68,68,0.05)'
                : 'rgba(245,158,11,0.05)',
            border: isSuccess
              ? '1px solid rgba(34,197,94,0.12)'
              : isError
                ? '1px solid rgba(239,68,68,0.12)'
                : '1px solid rgba(245,158,11,0.12)',
            borderRadius: '16px',
            padding: '20px 24px',
            marginBottom: '32px',
            textAlign: 'left',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: isSuccess ? '#22c55e' : isError ? '#ef4444' : '#f59e0b',
                boxShadow: isSuccess
                  ? '0 0 8px rgba(34,197,94,0.6)'
                  : isError
                    ? '0 0 8px rgba(239,68,68,0.6)'
                    : '0 0 8px rgba(245,158,11,0.6)',
              }} />
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
                {isSuccess ? 'PAGO CONFIRMADO' : isError ? 'VALIDACIÓN PENDIENTE' : 'CONSULTANDO SUMUP'}
              </span>
            </div>
            <p style={{
              fontSize: '13px',
              color: 'rgba(255,255,255,0.4)',
              margin: 0,
              lineHeight: 1.6,
              fontFamily: 'sans-serif',
            }}>
              {orderNumber ? `Orden #${orderNumber}` : `Referencia: ${checkoutReference || 'No disponible'}`}
            </p>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: '900',
              color: '#000',
              fontFamily: 'sans-serif',
            }}>A</div>
            <span style={{
              fontSize: '15px',
              fontWeight: '600',
              color: 'rgba(255,255,255,0.6)',
              fontFamily: 'sans-serif',
              letterSpacing: '-0.3px',
            }}>ARM Merch</span>
          </div>
        </div>

        <p style={{
          textAlign: 'center',
          marginTop: '20px',
          fontSize: '12px',
          color: 'rgba(255,255,255,0.2)',
          fontFamily: 'sans-serif',
        }}>
          {isSuccess ? 'Puedes cerrar esta ventana' : 'No cierres esta ventana mientras confirmamos el pago'}
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.04); opacity: .82; }
        }
      `}</style>
    </div>
  )
}
