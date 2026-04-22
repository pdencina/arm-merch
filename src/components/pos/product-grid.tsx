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

function playAddSound() {
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext

    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(740, now)
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.07)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.04, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.12)
  } catch {}
}

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
      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o SKU..."
            className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 pl-10 pr-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-slate-400"
          />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setCategory('')}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              !category
                ? 'border-slate-400/40 bg-slate-300/10 text-slate-300'
                : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Todos
          </button>

          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                category === c.id
                  ? 'border-slate-400/40 bg-slate-300/10 text-slate-300'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 text-zinc-500">
            <Package2 size={24} className="mb-2 text-zinc-600" />
            <p className="text-sm">No se encontraron productos</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((product) => {
              const inCart = items.find((i) => i.product.id === product.id)
              const outOfStock = (product.stock ?? 0) <= 0

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
                      playAddSound()
                    }
                  }}
                  disabled={outOfStock}
                  className={`group relative flex flex-col rounded-2xl border p-2 text-left transition-all ${
                    outOfStock
                      ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/50 opacity-40'
                      : inCart
                      ? 'border-slate-400/40 bg-zinc-900 shadow-sm'
                      : 'border-zinc-800 bg-zinc-900/80 hover:-translate-y-0.5 hover:border-slate-400/30'
                  }`}
                >
                  <div className="mb-2 flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-zinc-800">
                    {product.image_url ? (
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        width={100}
                        height={100}
                        className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <span className="text-2xl text-zinc-700">📦</span>
                    )}
                  </div>

                  <p className="line-clamp-2 min-h-[34px] text-xs font-semibold leading-4 text-white">
                    {product.name}
                  </p>

                  <p className="mt-1 text-lg font-black tracking-tight text-slate-300">
                    {fmt(product.price)}
                  </p>

                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-zinc-500">
                      Stock: {product.stock}
                    </span>

                    {inCart && (
                      <span className="rounded-full bg-slate-300/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                        ×{inCart.quantity}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}