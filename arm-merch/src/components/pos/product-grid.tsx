'use client'

import Image from 'next/image'
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
  loading: boolean
}

export default function ProductGrid({ products, loading }: Props) {
  const { addItem, items } = useCart()

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 overflow-y-auto flex-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-zinc-900 rounded-xl aspect-square animate-pulse" />
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
        No se encontraron productos
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 overflow-y-auto flex-1 content-start">
      {products.map(product => {
        const inCart = items.find(i => i.product.id === product.id)
        const outOfStock = (product.stock ?? 0) <= 0
        const lowStock = !outOfStock && (product.stock ?? 0) <= (product.low_stock_alert ?? 5)

        return (
          <button
            key={product.id}
            onClick={() => {
              if (outOfStock) return
              addItem({
                id: product.id,
                name: product.name,
                price: product.price,
                image_url: product.image_url,
                stock: product.stock ?? 0,
              })
            }}
            disabled={outOfStock}
            className={`
              relative flex flex-col bg-zinc-900 rounded-xl p-3 text-left transition-all
              border hover:scale-[1.02] active:scale-[0.98]
              ${outOfStock
                ? 'opacity-40 cursor-not-allowed border-zinc-800'
                : inCart
                  ? 'border-amber-500/60 bg-zinc-800'
                  : 'border-zinc-800 hover:border-amber-500/50 cursor-pointer'}
            `}
          >
            <div className="w-full aspect-square bg-zinc-800 rounded-lg mb-2.5 overflow-hidden flex items-center justify-center">
              {product.image_url ? (
                <Image src={product.image_url} alt={product.name} width={120} height={120} className="object-cover w-full h-full" />
              ) : (
                <span className="text-3xl text-zinc-700">📦</span>
              )}
            </div>
            <p className="text-xs font-medium text-zinc-200 leading-tight mb-1 line-clamp-2">{product.name}</p>
            <p className="text-sm font-bold text-amber-400">
              {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(product.price)}
            </p>
            <div className="mt-1.5 flex items-center justify-between">
              <span className={`text-[10px] font-medium ${outOfStock ? 'text-red-400' : lowStock ? 'text-orange-400' : 'text-zinc-500'}`}>
                {outOfStock ? 'Sin stock' : `Stock: ${product.stock}`}
              </span>
              {inCart && (
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
                  ×{inCart.quantity}
                </span>
              )}
            </div>
            {lowStock && <div className="absolute top-2 right-2 w-2 h-2 bg-orange-400 rounded-full" />}
          </button>
        )
      })}
    </div>
  )
}
