'use client'

import { useMemo, useState } from 'react'
import { DollarSign, Package, TrendingUp, AlertTriangle, Save } from 'lucide-react'

type Product = {
  id: number
  name: string
  purchase_price: number
  sale_price: number
  stock: number
}

const initialProducts: Product[] = [
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
]

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n)

export default function PricingPage() {
  const [products, setProducts] = useState(initialProducts)

  const totals = useMemo(() => {
    const sales = products.reduce((a, b) => a + b.sale_price, 0)
    const cost = products.reduce((a, b) => a + b.purchase_price, 0)
    const margin = sales > 0 ? (((sales - cost) / sales) * 100).toFixed(1) : '0'

    return {
      sales,
      cost,
      margin,
    }
  }, [products])

  const updateProduct = (
    id: number,
    field: 'purchase_price' | 'sale_price',
    value: number
  ) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              [field]: value,
            }
          : p
      )
    )
  }

  return (
    <div className="space-y-6 text-white">
      <section className="rounded-[32px] border border-zinc-800 bg-zinc-900 p-7">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
          Pricing Center
        </div>

        <h1 className="text-4xl font-black">
          Gestión de precios
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-500">
          Controla costos, precios venta y rentabilidad global.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card
          title="Venta total"
          value={fmt(totals.sales)}
          icon={<DollarSign size={20} />}
          color="emerald"
        />

        <Card
          title="Costo inventario"
          value={fmt(totals.cost)}
          icon={<Package size={20} />}
          color="blue"
        />

        <Card
          title="Margen promedio"
          value={`${totals.margin}%`}
          icon={<TrendingUp size={20} />}
          color="amber"
        />

        <Card
          title="Alertas"
          value="1"
          icon={<AlertTriangle size={20} />}
          color="red"
        />
      </section>

      <section className="rounded-[32px] border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black">
              Productos & márgenes
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Edita precios y costos en tiempo real.
            </p>
          </div>

          <button className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-black transition hover:opacity-90">
            <Save size={16} />
            Guardar cambios
          </button>
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
                <th className="pb-4">Estado</th>
              </tr>
            </thead>

            <tbody>
              {products.map((product) => {
                const profit =
                  product.sale_price - product.purchase_price

                const margin = (
                  (profit / product.sale_price) *
                  100
                ).toFixed(1)

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

                    <td className="py-5">
                      <input
                        type="number"
                        value={product.purchase_price}
                        onChange={(e) =>
                          updateProduct(
                            product.id,
                            'purchase_price',
                            Number(e.target.value)
                          )
                        }
                        className="w-32 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-emerald-500"
                      />
                    </td>

                    <td className="py-5">
                      <input
                        type="number"
                        value={product.sale_price}
                        onChange={(e) =>
                          updateProduct(
                            product.id,
                            'sale_price',
                            Number(e.target.value)
                          )
                        }
                        className="w-32 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-emerald-500"
                      />
                    </td>

                    <td className="py-5 font-black text-emerald-300">
                      {fmt(profit)}
                    </td>

                    <td className="py-5">
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
                        {margin}%
                      </span>
                    </td>

                    <td className="py-5">
                      {Number(margin) < 20 ? (
                        <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-black text-red-300">
                          Riesgo
                        </span>
                      ) : (
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
                          Saludable
                        </span>
                      )}
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

function Card({
  title,
  value,
  icon,
  color,
}: {
  title: string
  value: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className="rounded-[28px] border border-zinc-800 bg-zinc-900 p-5">
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-${color}-500/10 text-${color}-300`}>
        {icon}
      </div>

      <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
        {title}
      </p>

      <p className="mt-3 text-3xl font-black">
        {value}
      </p>
    </div>
  )
}
