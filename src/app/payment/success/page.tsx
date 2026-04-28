'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

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
      {/* Fondo con partículas sutiles */}
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

        {/* Card principal */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '28px',
          padding: '48px 40px',
          textAlign: 'center',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 40px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}>

          {/* Ícono animado */}
          <div style={{
            width: '88px',
            height: '88px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.05))',
            border: '2px solid rgba(34,197,94,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 32px',
            boxShadow: '0 0 40px rgba(34,197,94,0.15)',
            animation: visible ? 'pulse 2s ease-in-out infinite' : 'none',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 13l4 4L19 7"
                stroke="#22c55e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 30,
                  strokeDashoffset: visible ? 0 : 30,
                  transition: 'stroke-dashoffset 0.8s ease 0.3s',
                }}
              />
            </svg>
          </div>

          {/* Título */}
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#ffffff',
            margin: '0 0 12px',
            letterSpacing: '-0.5px',
            lineHeight: 1.2,
          }}>
            ¡Pago recibido!
          </h1>

          <p style={{
            fontSize: '15px',
            color: 'rgba(255,255,255,0.45)',
            margin: '0 0 36px',
            lineHeight: 1.6,
          }}>
            Tu compra fue procesada correctamente.<br />
            Pronto recibirás la confirmación.
          </p>

          {/* Separador decorativo */}
          <div style={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
            margin: '0 0 32px',
          }} />

          {/* Detalle */}
          <div style={{
            background: 'rgba(34,197,94,0.05)',
            border: '1px solid rgba(34,197,94,0.12)',
            borderRadius: '16px',
            padding: '20px 24px',
            marginBottom: '32px',
            textAlign: 'left',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 8px rgba(34,197,94,0.6)',
              }} />
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
                TRANSACCIÓN CONFIRMADA
              </span>
            </div>
            <p style={{
              fontSize: '13px',
              color: 'rgba(255,255,255,0.4)',
              margin: 0,
              lineHeight: 1.6,
              fontFamily: 'sans-serif',
            }}>
              El vendedor fue notificado automáticamente y preparará tu pedido a la brevedad.
            </p>
          </div>

          {/* Marca */}
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

        {/* Texto pequeño al pie */}
        <p style={{
          textAlign: 'center',
          marginTop: '20px',
          fontSize: '12px',
          color: 'rgba(255,255,255,0.2)',
          fontFamily: 'sans-serif',
        }}>
          Puedes cerrar esta ventana
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 40px rgba(34,197,94,0.15); }
          50% { box-shadow: 0 0 60px rgba(34,197,94,0.3); }
        }
      `}</style>
    </div>
  )
}
