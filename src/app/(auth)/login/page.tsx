'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import './login.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      if (!data.session) {
        setError('No se pudo iniciar sesión')
        setLoading(false)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, active, role')
        .eq('id', data.session.user.id)
        .maybeSingle()

      if (profileError || !profile) {
        await supabase.auth.signOut()
        setError('No se pudo validar tu perfil. Contacta a un administrador.')
        setLoading(false)
        return
      }

      if (profile.active === false) {
        await supabase.auth.signOut()
        setError('Tu acceso fue deshabilitado. Contacta a un administrador.')
        setLoading(false)
        return
      }

      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 100)
    } catch (err: any) {
      setError(err?.message ?? 'Error inesperado al iniciar sesión')
      setLoading(false)
    }
  }

  return (
    <main className="login-root">
      <div className="login-gradient" />

      <div className="login-container">
        <div className="login-card">
          <div className="login-badge">
            <ShieldCheck size={14} />
            ARM Global · Sistema de Merch
          </div>

          <div className="login-logo-wrap">
            <div className="login-logo-box">
              <svg viewBox="0 0 100 50" style={{width: '36px', height: '36px'}} fill="none" xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="50" cy="26" rx="45" ry="17" stroke="#000000" strokeWidth="2" transform="rotate(-5 50 26)"/>
                <text x="18" y="36" fontFamily="Georgia, serif" fontSize="36" fontWeight="bold" fill="#000000">M</text>
                <text x="33" y="14" fontFamily="Georgia, serif" fontSize="14" fontStyle="italic" fill="#000000">ar</text>
                <text x="48" y="36" fontFamily="Georgia, serif" fontSize="28" fontWeight="bold" fill="#000000">erch</text>
                <path d="M82,8 L83.5,12 L88,13 L83.5,14 L82,18 L80.5,14 L76,13 L80.5,12 Z" fill="#000000"/>
              </svg>
            </div>

            <div>
              <h1 className="login-title">
                ar<span>Merch</span>
              </h1>

              <p className="login-subtitle">
                Plataforma de merchandising y operaciones
              </p>
            </div>
          </div>

          <div className="login-form">
            <div className="login-field">
              <label>Correo electrónico</label>

              <div className="login-input-wrap">
                <Mail size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@armglobal.org"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="login-field">
              <label>Contraseña</label>

              <div className="login-input-wrap">
                <LockKeyhole size={18} />

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleLogin()
                    }
                  }}
                />
              </div>
            </div>

            {error && <div className="login-error">{error}</div>}

            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="login-button"
            >
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
          </div>

          <div className="login-footer">
            Acceso restringido al equipo autorizado
          </div>
        </div>
      </div>
    </main>
  )
}
