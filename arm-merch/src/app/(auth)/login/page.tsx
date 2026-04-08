'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [mounted, setMounted]   = useState(false)
  const router = useRouter()

  useEffect(() => { setMounted(true) }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('Credenciales incorrectas')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <>
      <style>{`
        .login-root {
          min-height: 100vh;
          background: #080808;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-dm-sans, sans-serif);
          overflow: hidden;
          position: relative;
        }
        .bg-grid {
          position: fixed; inset: 0;
          background-image:
            linear-gradient(rgba(245,158,11,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245,158,11,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
          pointer-events: none;
        }
        .bg-glow {
          position: fixed; width: 600px; height: 600px; border-radius: 50%;
          background: radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 70%);
          top: -150px; right: -150px; pointer-events: none;
        }
        .bg-glow-2 {
          position: fixed; width: 400px; height: 400px; border-radius: 50%;
          background: radial-gradient(circle, rgba(245,158,11,0.04) 0%, transparent 70%);
          bottom: -100px; left: -100px; pointer-events: none;
        }
        .deco-line {
          position: fixed; left: 60px; top: 0; bottom: 0; width: 1px;
          background: linear-gradient(to bottom, transparent, rgba(245,158,11,0.12) 30%, rgba(245,158,11,0.12) 70%, transparent);
        }
        .deco-line-r {
          position: fixed; right: 60px; top: 0; bottom: 0; width: 1px;
          background: linear-gradient(to bottom, transparent, rgba(245,158,11,0.06) 30%, rgba(245,158,11,0.06) 70%, transparent);
        }
        .corner { position: fixed; width: 20px; height: 20px; }
        .c-tl { top: 24px; left: 24px; border-top: 1px solid rgba(245,158,11,0.3); border-left: 1px solid rgba(245,158,11,0.3); }
        .c-tr { top: 24px; right: 24px; border-top: 1px solid rgba(245,158,11,0.3); border-right: 1px solid rgba(245,158,11,0.3); }
        .c-bl { bottom: 24px; left: 24px; border-bottom: 1px solid rgba(245,158,11,0.3); border-left: 1px solid rgba(245,158,11,0.3); }
        .c-br { bottom: 24px; right: 24px; border-bottom: 1px solid rgba(245,158,11,0.3); border-right: 1px solid rgba(245,158,11,0.3); }
        .card {
          position: relative; width: 100%; max-width: 420px; padding: 0 24px;
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .brand { margin-bottom: 52px; }
        .brand-tag { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 20px; }
        .brand-dot {
          width: 6px; height: 6px; background: #f59e0b; border-radius: 50%;
          animation: pdot 2s ease-in-out infinite;
        }
        @keyframes pdot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
        .brand-label { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(245,158,11,0.7); font-weight: 500; }
        .brand-title {
          font-family: var(--font-dm-serif, serif);
          font-size: 52px; line-height: 1; color: #fff;
          letter-spacing: -0.02em; margin: 0 0 8px 0;
        }
        .brand-title em { font-style: italic; color: #f59e0b; }
        .brand-sub { font-size: 13px; color: rgba(255,255,255,0.3); font-weight: 300; letter-spacing: 0.02em; }
        .form { display: flex; flex-direction: column; gap: 20px; }
        .field { display: flex; flex-direction: column; gap: 8px; }
        .field-label { font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.35); font-weight: 500; }
        .field-input {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 2px; padding: 14px 16px;
          color: #fff; font-size: 14px;
          font-family: var(--font-dm-sans, sans-serif);
          font-weight: 300; outline: none;
          transition: border-color 0.2s, background 0.2s;
          width: 100%; box-sizing: border-box;
        }
        .field-input::placeholder { color: rgba(255,255,255,0.15); }
        .field-input:focus { border-color: rgba(245,158,11,0.4); background: rgba(245,158,11,0.03); }
        .divider { height: 1px; background: linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent); margin: 4px 0; }
        .err { font-size: 12px; color: #f87171; background: rgba(248,113,113,0.05); border: 1px solid rgba(248,113,113,0.15); border-radius: 2px; padding: 10px 14px; }
        .btn {
          position: relative; background: #f59e0b; color: #080808;
          border: none; border-radius: 2px; padding: 16px 24px;
          font-size: 12px; font-family: var(--font-dm-sans, sans-serif);
          font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase;
          cursor: pointer; overflow: hidden;
          transition: background 0.2s, transform 0.1s; width: 100%; margin-top: 8px;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .btn:hover { background: #fbbf24; }
        .btn:active { transform: scale(0.99); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%);
          transform: translateX(-100%); transition: transform 0.4s ease;
        }
        .btn:hover::after { transform: translateX(100%); }
        .spinner {
          width: 12px; height: 12px;
          border: 1.5px solid rgba(0,0,0,0.25); border-top-color: #080808;
          border-radius: 50%; animation: spin 0.6s linear infinite; flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .footer { margin-top: 40px; display: flex; align-items: center; gap: 12px; }
        .footer-line { flex: 1; height: 1px; background: rgba(255,255,255,0.06); }
        .footer-text { font-size: 11px; color: rgba(255,255,255,0.2); letter-spacing: 0.05em; white-space: nowrap; }
        .year { position: fixed; bottom: 28px; right: 28px; font-size: 10px; color: rgba(255,255,255,0.1); letter-spacing: 0.1em; }
      `}</style>

      <div className="login-root">
        <div className="bg-grid" />
        <div className="bg-glow" />
        <div className="bg-glow-2" />
        <div className="deco-line" />
        <div className="deco-line-r" />
        <div className="corner c-tl" />
        <div className="corner c-tr" />
        <div className="corner c-bl" />
        <div className="corner c-br" />

        <div className="card" style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(16px)' }}>
          <div className="brand">
            <div className="brand-tag">
              <div className="brand-dot" />
              <span className="brand-label">Iglesia ARM · Sistema de Merch</span>
            </div>
            <h1 className="brand-title">ARM <em>Merch</em></h1>
            <p className="brand-sub">Acceso a la plataforma de merchandising</p>
          </div>

          <form onSubmit={handleSubmit} className="form">
            <div className="field">
              <label className="field-label">Correo electrónico</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@iglesia.cl" required autoComplete="email" className="field-input" />
            </div>
            <div className="field">
              <label className="field-label">Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required autoComplete="current-password" className="field-input" />
            </div>
            <div className="divider" />
            {error && <div className="err">{error}</div>}
            <button type="submit" disabled={loading} className="btn">
              {loading && <span className="spinner" />}
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>

          <div className="footer">
            <div className="footer-line" />
            <span className="footer-text">Acceso restringido al equipo autorizado</span>
            <div className="footer-line" />
          </div>
        </div>

        <div className="year">ARM © 2025</div>
      </div>
    </>
  )
}
