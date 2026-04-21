'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Search, Package2 } from 'lucide-react'
import { useCart } from '@/lib/hooks/use-cart'

interface Product {
  id: string
  name: string
  price: number
  image_url: string | null
  stock: number | null
  low_stock_alert: number | null
  category_id: string | null
  sku: string | null
  active: boolean
  [key: string]: any
}

interface Props {
  products: Product[]
  categories: { id: string; name: string }[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n)

export default function ProductGrid({ products, categories }: Props) {
  const { addItem, items } = useCart()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku ?? '').toLowerCase().includes(search.toLowerCase())

      const matchCat = !category || p.category_id === category
      return matchSearch && matchCat
    })
  }, [products, search, category])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-zinc-800 px-4 pb-3 pt-4 xl:px-5">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o SKU..."
            className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 pl-11 pr-4 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-amber-500"
          />
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setCategory('')}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
              !category
                ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
                : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Todos
          </button>

          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                category === c.id
                  ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 xl:px-5">
        {filtered.length === 0 ? (
          <div className="flex h-44 flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/30 text-zinc-500">
            <Package2 size={26} className="mb-3 text-zinc-600" />
            <p className="text-sm">No se encontraron productos</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((product) => {
              const inCart = items.find((i) => i.product.id === product.id)
              const outOfStock = (product.stock ?? 0) <= 0
              const lowStock =
                !outOfStock &&
                (product.stock ?? 0) <= (product.low_stock_alert ?? 5)

              return (
                <button
                  key={product.id}
                  onClick={() => {
                    if (!outOfStock) {
                      addItem({
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        image_url: product.image_url,
                        stock: product.stock ?? 0,
                      })
                    }
                  }}
                  disabled={outOfStock}
                  className={`group relative flex flex-col rounded-3xl border p-3 text-left transition-all duration-200 ${
                    outOfStock
                      ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/50 opacity-40'
                      : inCart
                      ? 'border-amber-500/60 bg-zinc-900 shadow-lg shadow-amber-500/5'
                      : 'border-zinc-800 bg-zinc-900/80 hover:-translate-y-0.5 hover:border-amber-500/40 hover:bg-zinc-900'
                  }`}
                >
                  <div className="mb-3 flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-zinc-800/80">
                    {product.image_url ? (
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        width={140}
                        height={140}
                        className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <span className="text-4xl text-zinc-700">📦</span>
                    )}
                  </div>

                  <p className="line-clamp-2 min-h-[40px] text-sm font-semibold leading-5 text-white">
                    {product.name}
                  </p>

                  <p className="mt-2 text-2xl font-black tracking-tight text-amber-400">
                    {fmt(product.price)}
                  </p>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-medium ${
                        outOfStock
                          ? 'text-red-400'
                          : lowStock
                          ? 'text-orange-400'
                          : 'text-zinc-500'
                      }`}
                    >
                      {outOfStock ? 'Sin stock' : `Stock: ${product.stock}`}
                    </span>

                    {inCart && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[11px] font-bold text-amber-400">
                        ×{inCart.quantity}
                      </span>
                    )}
                  </div>

                  {lowStock && (
                    <div className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.6)]" />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}