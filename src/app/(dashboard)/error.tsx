'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 text-5xl">⚠️</div>
      <h2 className="mb-2 text-lg font-bold text-white">
        Error al cargar
      </h2>
      <p className="mb-6 text-sm text-zinc-400 max-w-sm">
        {error.message || 'No se pudo cargar este módulo. Verifica tu conexión e intenta de nuevo.'}
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-amber-400"
        >
          Reintentar
        </button>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm text-zinc-400 transition hover:text-white"
        >
          Recargar página
        </button>
      </div>
    </div>
  )
}
