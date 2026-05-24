'use client'

import {
  CalendarDays,
  Download,
  Search,
  TrendingDown,
  TrendingUp,
  User,
} from 'lucide-react'

const history = [
  {
    id: 1,
    product: 'Polerón ARM Black',
    before: 24990,
    after: 29990,
    reason: 'Nuevo margen temporada invierno',
    user: 'Pablo Encina',
    type: 'up',
    date: '24 Mayo 2026 · 01:22',
  },
  {
    id: 2,
    product: 'Biblia Historias niños',
    before: 12990,
    after: 11990,
    reason: 'Promoción domingo kids',
    user: 'Felipe Burgos',
    type: 'down',
    date: '23 Mayo 2026 · 22:10',
  },
  {
    id: 3,
    product: 'Lanyard ARM',
    before: 1990,
    after: 2500,
    reason: 'Ajuste proveedor',
    user: 'Pencina',
    type: 'up',
    date: '23 Mayo 2026 · 18:40',
  },
]

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n)

export default function PricingHistoryPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-[#111111] p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-300">
              Historial
            </div>

            <h1 className="text-4xl font-black text-white">
              Historial de precios
            </h1>

            <p className="mt-2 text-white/50">
              Visualiza cambios, responsables y variaciones históricas.
            </p>
          </div>

          <button className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white transition hover:border-orange-500/40">
            <Download size={16} />
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-[#111111] p-6">
          <p className="text-sm text-white/50">Cambios hoy</p>
          <h3 className="mt-2 text-4xl font-black text-white">12</h3>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#111111] p-6">
          <p className="text-sm text-white/50">Subidas precio</p>
          <h3 className="mt-2 text-4xl font-black text-emerald-400">8</h3>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#111111] p-6">
          <p className="text-sm text-white/50">Bajadas precio</p>
          <h3 className="mt-2 text-4xl font-black text-red-400">4</h3>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#111111] p-6">
          <p className="text-sm text-white/50">Usuarios activos</p>
          <h3 className="mt-2 text-4xl font-black text-orange-400">3</h3>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-[#111111] p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40"
            />

            <input
              placeholder="Buscar producto..."
              className="h-12 w-full rounded-2xl border border-white/10 bg-black pl-11 pr-4 text-sm text-white outline-none transition focus:border-orange-500/40"
            />
          </div>

          <button className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white">
            <CalendarDays size={16} />
            Últimos 30 días
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
                <th className="pb-4">Producto</th>
                <th className="pb-4">Antes</th>
                <th className="pb-4">Después</th>
                <th className="pb-4">Variación</th>
                <th className="pb-4">Motivo</th>
                <th className="pb-4">Usuario</th>
                <th className="pb-4">Fecha</th>
              </tr>
            </thead>

            <tbody>
              {history.map((item) => {
                const diff = item.after - item.before

                return (
                  <tr
                    key={item.id}
                    className="border-b border-white/5 text-sm text-white"
                  >
                    <td className="py-5 font-semibold">{item.product}</td>

                    <td>{fmt(item.before)}</td>

                    <td>{fmt(item.after)}</td>

                    <td>
                      <div
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                          item.type === 'up'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {item.type === 'up' ? (
                          <TrendingUp size={14} />
                        ) : (
                          <TrendingDown size={14} />
                        )}

                        {fmt(Math.abs(diff))}
                      </div>
                    </td>

                    <td className="text-white/60">{item.reason}</td>

                    <td>
                      <div className="flex items-center gap-2 text-white/70">
                        <User size={14} />
                        {item.user}
                      </div>
                    </td>

                    <td className="text-white/50">{item.date}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}