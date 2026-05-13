'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Search, Package2 } from 'lucide-react'
import { useCart } from '@/lib/hooks/use-cart'
import { useBarcode } from '@/lib/hooks/use-barcode'

interface Product {
  id: string
  name: string
  price: number
  image_url: string | null
  stock: number | null
  low_stock_alert: number | null
  category_id: string | null
  sku: string | null
  barcode?: string | null
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
  const audio = new Audio('/sounds/beep.mp3')
  audio.volume = 0.4
  audio.play().catch(() => {})
}

export default function ProductGrid({ products, categories }: Props) {
  const { addItem, items } = useCart()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode ?? '').toLowerCase().includes(search.toLowerCase())

      const matchCat = !category || p.category_id === category
      return matchSearch && matchCat
    })
  }, [products, search, category])

  // Auto-add product when exact barcode match (scanner sends fast + Enter)
  useEffect(() => {
    if (!search) return
    const exactMatch = filtered.find(p =>
      p.barcode === search || p.sku === search
    )
    if (exactMatch && filtered.length === 1) {
      addProduct(exactMatch)
      setSearch('')
    }
  }, [filtered, search])

  function addProduct(product: Product) {
    if ((product.stock ?? 0) <= 0) return

    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      stock: product.stock ?? 0,
    })

    playAddSound()
  }

  // 🔥 SCANNER DE CÓDIGO DE BARRAS
  useBarcode((code) => {
    const product = products.find(
      (p) =>
        p.sku?.toLowerCase() === code.toLowerCase() ||
        p.id === code
    )

    if (product) {
      addProduct(product)
    }
  })

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* BUSCADOR */}
      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar o escanear..."
            className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 pl-10 pr-3 text-sm text-white outline-none focus:border-slate-400"
          />
        </div>
      </div>

      {/* GRID */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => (
            <button
              key={product.id}
              onClick={() => addProduct(product)}
              disabled={(product.stock ?? 0) <= 0}
              className={`relative rounded-xl bg-zinc-900 p-2 text-left transition hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {/* Stock badge */}
              {product.stock !== null && (
                <span className={`absolute top-2 right-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold z-10 ${
                  (product.stock ?? 0) <= 0
                    ? 'bg-red-500/20 text-red-400'
                    : (product.stock ?? 0) <= (product.low_stock_alert ?? 5)
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-green-500/20 text-green-400'
                }`}>
                  {product.stock} uds
                </span>
              )}

              {/* Image */}
              <div className="aspect-square bg-zinc-800 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    width={120}
                    height={120}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <span className="text-3xl">📦</span>
                )}
              </div>

              {/* Name */}
              <p className="text-xs font-medium text-white leading-tight mb-0.5 line-clamp-2">
                {product.name}
              </p>

              {/* SKU */}
              {product.sku && (
                <p className="text-[10px] text-zinc-600 mb-1">{product.sku}</p>
              )}

              {/* Price */}
              <p className="text-sm font-bold text-amber-400">
                {fmt(product.price)}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}