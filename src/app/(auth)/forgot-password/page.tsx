'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent]   = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!email.trim()) { setError('Ingresa tu email'); return }
    setLoading(true)
    setError('')

    const supabase = createClient()

    // Verificar via API route (usa service role para bypassear RLS)
    const checkRes = await fetch('/api/auth/check-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
    const { exists } = await checkRes.json().catch(() => ({ exists: false }))

    if (!exists) {
      setLoading(false)
      setError('No existe una cuenta con ese email en el sistema.')
      return
    }

    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/reset-password` }
    )

    setLoading(false)
    if (err) { setError(err.message); return }
    setSent(true)
  }

  return (
    <div className="lr">
      <div className="lr-grid" />
      <div className="lr-g1" />
      <div className="lr-g2" />
      <div className="lr-vl" />
      <div className="lr-vr" />
      <div className="lr-ctL" />
      <div className="lr-ctR" />
      <div className="lr-cbL" />
      <div className="lr-cbR" />

      <div className="lc">
        <div className="lb">
          <div className="lbt">
            <div className="lbd" />
            <span className="lbla">ARM Global · Sistema de Merch</span>
          </div>

          <div className="lh">
            <h1 className="lt">Recuperar contraseña</h1>
            <p className="ls">
              {sent
                ? 'Revisa tu email para continuar'
                : 'Te enviaremos un link para restablecer tu contraseña'}
            </p>
          </div>

          {!sent ? (
            <div className="lf">
              <div className="lg">
                <label className="ll">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="lfx"
                  onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                />
              </div>

              <div className="ldv" />

              {error && <div className="ler">{error}</div>}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="lbtn"
              >
                {loading && <span className="lsp" />}
                {loading ? 'Enviando...' : 'Enviar link de recuperación'}
              </button>
            </div>
          ) : (
            <div className="lf">
              <div style={{
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: '16px',
                padding: '20px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📧</div>
                <p style={{ color: '#86efac', fontWeight: 600, marginBottom: '8px' }}>
                  Link enviado a {email}
                </p>
                <p style={{ color: '#71717a', fontSize: '13px' }}>
                  Revisa tu bandeja de entrada y haz clic en el link para crear una nueva contraseña.
                  El link expira en 1 hora.
                </p>
              </div>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <Link href="/login" style={{ fontSize: '13px', color: '#71717a', textDecoration: 'none' }}>
              ← Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
