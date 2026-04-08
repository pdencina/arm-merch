'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-zinc-400 text-sm mb-4">Ocurrió un error inesperado</p>
        <button
          onClick={reset}
          className="bg-amber-500 text-zinc-950 font-bold rounded-xl px-4 py-2 text-sm"
        >
          Reintentar
        </button>
      </div>
    </main>
  )
}
