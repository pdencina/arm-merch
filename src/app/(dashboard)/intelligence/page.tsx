import Link from 'next/link'
import { BrainCircuit, LineChart, Sparkles, Telescope, ArrowRight, ShieldCheck } from 'lucide-react'

const cards = [
  { title: 'Executive Dashboard', description: 'Vista ejecutiva global con ventas, campus, productos y operación.', href: '/dashboard', icon: BrainCircuit, tag: 'Global' },
  { title: 'Analytics', description: 'Reportes operacionales, filtros por fecha, vendedores y exportación CSV.', href: '/intelligence/analytics', icon: LineChart, tag: 'Reportes' },
  { title: 'IA Insights', description: 'Lectura ejecutiva con IA para decisiones comerciales y operativas.', href: '/intelligence/ai-insights', icon: Sparkles, tag: 'IA' },
  { title: 'Forecast', description: 'Proyección ejecutiva de demanda, stock y comportamiento comercial.', href: '/intelligence/forecast', icon: Telescope, tag: 'Predictivo' },
]

export default function IntelligencePage() {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-7 text-white shadow-2xl">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-amber-300">
          <ShieldCheck size={14} />
          Solo Super Admin
        </div>
        <h1 className="text-4xl font-black tracking-tight md:text-5xl">Intelligence Center</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
          Centro ejecutivo de ARM Merch para leer la operación, analizar indicadores y tomar decisiones estratégicas sin buscar links módulo por módulo.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.title} href={card.href} className="group rounded-[28px] border border-zinc-800 bg-zinc-900 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-amber-500/30 hover:bg-zinc-900/80 hover:shadow-[0_24px_70px_rgba(0,0,0,0.25)]">
              <div className="mb-5 flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-amber-400 ring-1 ring-zinc-800">
                  <Icon size={22} />
                </div>
                <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">{card.tag}</span>
              </div>
              <h2 className="text-lg font-black text-white">{card.title}</h2>
              <p className="mt-2 min-h-[72px] text-sm leading-6 text-zinc-500">{card.description}</p>
              <div className="mt-5 flex items-center gap-2 text-sm font-black text-amber-400">
                Abrir módulo <ArrowRight size={16} className="transition group-hover:translate-x-1" />
              </div>
            </Link>
          )
        })}
      </section>
    </div>
  )
}
