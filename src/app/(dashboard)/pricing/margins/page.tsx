'use client'

import {
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Trophy,
} from 'lucide-react'

const products = [
  {
    id: 1,
    name: 'Polerón ARM Black',
    cost: 18000,
    sale: 29990,
    margin: 40,
    stock: 12,
    status: 'Excelente',
  },
  {
    id: 2,
    name: 'Biblia Historias niños',
    cost: 8900,
    sale: 11990,
    margin: 15,
    stock: 2,
    status: 'Riesgo',
  },
  {
    id: 3,
    name: 'Lanyard ARM',
    cost: 900,
    sale: 2500,
    margin: 64,
    stock: 18,
    status: 'Excelente',
  },
]

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n)

export default function PricingMarginsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-[#111111] p-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
          Márgenes
        </div>

        <h1 className="text-4xl font-black text-white">
          Márgenes & rentabilidad
        </h1>

        <p className="mt-2 text-white/50">
          Analiza productos con bajo margen y oportunidades de pricing.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-[#111111] p-6">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
            <TrendingUp />
          </div>

          <p className="text-sm text-white/50">Margen promedio</p>

          <h3 className="mt-2 text-4xl font-black text-white">42%</h3>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#111111] p-6">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-400">
            <DollarSign />
          </div>

          <p className="text-sm text-white/50">Ganancia mensual</p>

          <h3 className="mt-2 text-4xl font-black text-white">$1.2M</h3>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#111111] p-6">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">
            <Trophy />
          </div>

          <p className="text-sm text-white/50">Producto top</p>

          <h3 className="mt-2 text-xl font-black text-white">
            Lanyard ARM
          </h3>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#111111] p-6">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
            <AlertTriangle />
          </div>

          <p className="text-sm text-white/50">Productos riesgo</p>

          <h3 className="mt-2 text-4xl font-black text-white">1</h3>
        </div>
      </div>

      <div className="rounded-3xl border border-orange-500/20 bg-orange-500/5 p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-orange-300">
          IA Recommendation
        </p>

        <h3 className="mt-3 text-lg font-bold text-white">
          Sugerencia inteligente
        </h3>

        <p className="mt-2 text-white/70">
          Se recomienda aumentar un 8% el precio de Lanyard ARM debido
          al aumento de demanda y excelente rotación.
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-[#111111] p-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
                <th className="pb-4">Producto</th>
                <th className="pb-4">Costo</th>
                <th className="pb-4">Venta</th>
                <th className="pb-4">Ganancia</th>
                <th className="pb-4">Margen</th>
                <th className="pb-4">Stock</th>
                <th className="pb-4">Estado</th>
              </tr>
            </thead>

            <tbody>
              {products.map((item) => {
                const profit = item.sale - item.cost

                return (
                  <tr
                    key={item.id}
                    className="border-b border-white/5 text-sm text-white"
                  >
                    <td className="py-5 font-semibold">{item.name}</td>

                    <td>{fmt(item.cost)}</td>

                    <td>{fmt(item.sale)}</td>

                    <td className="font-bold text-emerald-400">
                      {fmt(profit)}
                    </td>

                    <td>
                      <div className="inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                        {item.margin}%
                      </div>
                    </td>

                    <td>{item.stock}</td>

                    <td>
                      <div
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          item.status === 'Excelente'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {item.status}
                      </div>
                    </td>
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