'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Home,
  ReceiptText,
  Search,
  Sparkles,
} from 'lucide-react'

export default function TrackLookupPage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  function goToTracking() {
    const clean = code.trim()

    if (!clean) {
      setError('Ingresa tu código de seguimiento.')
      return
    }

    setError('')

    // Navegación directa para evitar problemas con router.push en esta página pública.
    window.location.href = `/track/${encodeURIComponent(clean)}`
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    goToTracking()
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#090b10] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.18),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_35%)]" />

      <section className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-8 sm:px-6">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-lg font-black text-black">
              A
            </div>

            <div>
              <p className="text-sm font-black text-white">ARM Merch</p>
              <p className="text-xs text-zinc-500">Seguimiento de pedidos</p>
            </div>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
          >
            <Home size={15} />
            Inicio
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center py-16">
          <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 shadow-2xl backdrop-blur sm:p-8">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-amber-500 text-black shadow-[0_0_40px_rgba(245,158,11,0.25)]">
              <ReceiptText size={40} />
            </div>

            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-400">
                Seguimiento
              </p>

              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
                Revisa tu pedido
              </h1>

              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
                Ingresa el código de seguimiento que recibiste por correo para ver
                el estado actual de tu pedido.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-zinc-500">
                  Código de seguimiento
                </label>

                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
                  />

                  <input
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value)
                      setError('')
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        goToTracking()
                      }
                    }}
                    placeholder="Ej: 1900d68993d74ba4..."
                    className="w-full rounded-2xl border border-white/10 bg-black/25 py-4 pl-12 pr-4 font-mono text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-500"
                    autoFocus
                    autoComplete="off"
                  />
                </div>

                {error && (
                  <p className="mt-2 text-sm font-semibold text-red-300">
                    {error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                onClick={(e) => {
                  e.preventDefault()
                  goToTracking()
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-4 font-black text-black transition hover:scale-[1.01]"
              >
                Ver seguimiento
                <ArrowRight size={18} />
              </button>
            </form>

            <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
              <div className="flex gap-3">
                <Sparkles size={18} className="mt-0.5 shrink-0 text-amber-300" />
                <p className="text-sm leading-6 text-amber-100/80">
                  El seguimiento aplica especialmente a productos en producción,
                  como poleras, polerones o pedidos personalizados.
                </p>
              </div>
            </div>
          </div>
        </div>

        <footer className="text-center text-xs text-zinc-600">
          ARM Merch · Plataforma oficial
        </footer>
      </section>
    </main>
  )
}
