'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import './login.css'

export default function LoginPage() {
  const router = useRouter()
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

      router.refresh()
    router.push('/pos')
    } catch (err: any) {
      setError(err?.message ?? 'Error inesperado al iniciar sesión')
      setLoading(false)
    }
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
          <h1 className="lh1">
            ARM <em>Merch</em>
          </h1>
          <p className="lhs">Acceso a la plataforma de merchandising</p>
        </div>

        <div className="lform">
          <div className="lfi">
            <label className="lfl">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@iglesia.cl"
              required
              autoComplete="email"
              className="lfx"
            />
          </div>

          <div className="lfi">
            <label className="lfl">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="lfx"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleLogin()
                }
              }}
            />
          </div>

          <div className="ldv" />

          {error && <div className="ler">{error}</div>}

          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="lbtn"
          >
            {loading && <span className="lsp" />}
            {loading ? 'Verificando...' : 'Ingresar'}
          </button>
        </div>

        <div className="lfooter">
          <div className="lfline" />
          <span className="lftxt">Acceso restringido al equipo autorizado</span>
          <div className="lfline" />
        </div>
      </div>

      <div className="lr-yr">ARM © {new Date().getFullYear()}</div>
    </div>
  )
}