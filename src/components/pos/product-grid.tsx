'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Search } from 'lucide-react'
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
        p.name.toLowerCase().includes(search.toLowerCase())

      const matchCat = !category || p.category_id === category
      return matchSearch && matchCat
    })
  }, [products, search, category])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      
      {/* SEARCH */}
      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 pl-9 pr-3 text-sm text-white"
          />
        </div>
      </div>

      {/* GRID */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          
          {filtered.map((product) => {
            const inCart = items.find((i) => i.product.id === product.id)

            return (
              <button
                key={product.id}
                onClick={() => addItem(product)}
                className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-2 hover:border-slate-400 transition"
              >
                <div className="aspect-square rounded-lg bg-zinc-800 flex items-center justify-center mb-2">
                  {product.image_url ? (
                    <Image src={product.image_url} alt="" width={80} height={80} />
                  ) : (
                    <span className="text-xl">📦</span>
                  )}
                </div>

                <p className="text-xs font-semibold text-white line-clamp-2">
                  {product.name}
                </p>

                <p className="text-sm font-bold text-slate-300">
                  {fmt(product.price)}
                </p>

                <span className="text-[10px] text-zinc-500">
                  Stock: {product.stock}
                </span>

                {inCart && (
                  <span className="text-[10px] text-slate-300">
                    x{inCart.quantity}
                  </span>
                )}
              </button>
            )
          })}

        </div>
      </div>
    </div>
  )
}