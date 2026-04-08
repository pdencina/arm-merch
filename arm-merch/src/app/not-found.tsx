import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-6xl font-black text-amber-500 mb-4">404</p>
        <p className="text-zinc-400 text-sm mb-6">Página no encontrada</p>
        <Link
          href="/dashboard"
          className="bg-amber-500 text-zinc-950 font-bold rounded-xl px-4 py-2 text-sm"
        >
          Ir al inicio
        </Link>
      </div>
    </main>
  )
}
