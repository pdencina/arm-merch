import Link from 'next/link'
import { BarChart3, ArrowRight } from 'lucide-react'

export default function IntelligenceAnalyticsPage() {
  return (
    <div className="rounded-[32px] border border-zinc-800 bg-zinc-900 p-7 text-white">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
        <BarChart3 size={26} />
      </div>

      <h1 className="text-3xl font-black">Analytics</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
        Este módulo reutiliza el reporte operacional actual para análisis por fecha,
        vendedores, productos y exportación.
      </p>

      <Link
        href="/reports"
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-black transition hover:bg-amber-400"
      >
        Abrir reportes
        <ArrowRight size={16} />
      </Link>
    </div>
  )
}
