'use client'

import { useMemo, useState } from 'react'
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Package,
  Search,
  Sparkles,
} from 'lucide-react'

const mockProducts = [
  {
    id: 1,
    name: 'Polerón ARM Black',
    purchase_price: 18000,
    sale_price: 29990,
    stock: 12,
  },
  {
    id: 2,
    name: 'Oversized Tee',
    purchase_price: 9500,
    sale_price: 19990,
    stock: 25,
  },
  {
    id: 3,
    name: 'Jockey Conference',
    purchase_price: 5500,
    sale_price: 14990,
    stock: 8,
  },
]

const fmt = (value: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value)

export default function PricingCenterPage() {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    return mockProducts.filter((product) =>
      product.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [search])

  return (
    <div className="space-y-6 text-white">
      <section className="relative overflow-hidden rounded-[32px] border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-7">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
            <Sparkles size={14} />
            Pricing Center
          </div>

          <h1 className="text-4xl font-black tracking-tight">
            Gestión de precios
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
            Controla costos, precios de venta, márgenes y rentabilidad global de ARM Merch.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[28px] border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
            <DollarSign size={22} />
          </div>

          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
            Venta total
          </p>

          <p className="mt-3 text-3xl font-black">
            $64.970
          </p>

          <p className="mt-2 text-sm text-zinc-500">
            Ventas configuradas actualmente.
          </p>
        </div>

        <div className="rounded-[28px] border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
            <Package size={22} />
          </div>

          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
            Costo inventario
          </p>

          <p className="mt-3 text-3xl font-black">
            $33.000
          </p>

          <p className="mt-2 text-sm text-zinc-500">
            Basado en precio compra.
          </p>
        </div>

        <div className="rounded-[28px] border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
            <TrendingUp size={22} />
          </div>

          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
            Margen promedio
          </p>

          <p className="mt-3 text-3xl font-black">
            42%
          </p>

          <p className="mt-2 text-sm text-zinc-500">
            Ganancia promedio productos.
          </p>
        </div>

        <div className="rounded-[28px] border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
            <AlertTriangle size={22} />
          </div>

          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
            Riesgo margen
          </p>

          <p className="mt-3 text-3xl font-black">
            1
          </p>

          <p className="mt-2 text-sm text-zinc-500">
            Producto bajo margen mínimo.
          </p>
        </div>
      </section>

      <section className="rounded-[32px] border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-black">Productos & márgenes</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Administra precios, utilidad y rentabilidad.
            </p>
          </div>

          <div className="relative w-full max-w-sm">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-widest text-zinc-500">
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
              {filtered.map((product) => {
                const profit = product.sale_price - product.purchase_price
                const margin = ((profit / product.sale_price) * 100).toFixed(1)

                return (
                  <tr
                    key={product.id}
                    className="border-b border-zinc-800/60"
                  >
                    <td className="py-5">
                      <div>
                        <p className="font-bold text-zinc-100">
                          {product.name}
                        </p>

                        <p className="mt-1 text-xs text-zinc-500">
                          ID #{product.id}
                        </p>
                      </div>
                    </td>

                    <td className="py-5 text-zinc-300">
                      {fmt(product.purchase_price)}
                    </td>

                    <td className="py-5 text-zinc-300">
                      {fmt(product.sale_price)}
                    </td>

                    <td className="py-5 font-black text-emerald-300">
                      {fmt(profit)}
                    </td>

                    <td className="py-5">
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
                        {margin}%
                      </span>
                    </td>

                    <td className="py-5 text-zinc-300">
                      {product.stock}
                    </td>

                    <td className="py-5">
                      <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-black text-blue-300">
                        Saludable
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
