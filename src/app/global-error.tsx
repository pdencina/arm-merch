'use client'

import { useEffect } from 'react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] p-6">
      <div className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        <div className="mb-4 text-5xl">⚠️</div>
        <h2 className="mb-2 text-xl font-bold text-white">
          Algo salió mal
        </h2>
        <p className="mb-6 text-sm text-zinc-400">
          {error.message || 'Error inesperado. Intenta recargar la página.'}
        </p>
        <button
          onClick={reset}
          className="w-full rounded-2xl bg-amber-500 py-3 text-sm font-bold text-black transition hover:bg-amber-400"
        >
          Reintentar
        </button>
        <button
          onClick={() => window.location.href = '/pos'}
          className="mt-3 w-full rounded-2xl border border-zinc-700 py-3 text-sm text-zinc-400 transition hover:text-white"
        >
          Volver al POS
        </button>
      </div>
    </div>
  )
}
