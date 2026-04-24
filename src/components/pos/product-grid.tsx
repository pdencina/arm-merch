'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Package2, X, Zap } from 'lucide-react'
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
  has_sizes?: boolean | null
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
  audio.volume = 0.3
  audio.play().catch(() => {})
}

// Badge de stock
function StockBadge({ stock, lowAlert }: { stock: number; lowAlert: number | null }) {
  if (stock === 0)
    return (
      <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-400">
        Sin stock
      </span>
    )
  if (lowAlert && stock <= lowAlert)
    return (
      <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
        {stock} uds
      </span>
    )
  return (
    <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
      {stock} uds
    </span>
  )
}


// ─── SizePicker modal ────────────────────────────────────────────────────────
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

function SizePicker({
  product,
  onSelect,
  onClose,
}: {
  product: Product
  onSelect: (size: string) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-500 hover:text-white"
        >
          <X size={16} />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 text-2xl">
            {product.image_url
              ? <img src={product.image_url} alt={product.name} className="h-12 w-12 rounded-2xl object-cover" />
              : '👕'}
          </div>
          <div>
            <p className="font-semibold text-white">{product.name}</p>
            <p className="text-xs text-zinc-500">Selecciona una talla</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {SIZES.map(size => (
            <button
              key={size}
              onClick={() => onSelect(size)}
              className="flex h-12 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800 text-sm font-bold text-zinc-300 transition hover:border-amber-500/50 hover:bg-amber-500/15 hover:text-amber-300 active:scale-95"
            >
              {size}
            </button>
          ))}
        </div>

        <p className="mt-4 text-center text-[10px] text-zinc-600">
          Si no ves la talla correcta, el vendedor puede anotarla en las notas de la venta.
        </p>
      </div>
    </div>
  )
}

export default function ProductGrid({ products, categories }: Props) {
  const { addItem, items } = useCart()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [lastAdded, setLastAdded] = useState<string | null>(null)
  const [barcodeFlash, setBarcodeFlash] = useState<string | null>(null)
  const [sizePickerProduct, setSizePickerProduct] = useState<Product | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // mapa de cantidad en carrito por producto
  const cartQtyMap = useMemo(() => {
    const m: Record<string, number> = {}
    items.forEach((i) => { m[i.product.id] = i.quantity })
    return m
  }, [items])

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

  function addProduct(product: Product, size?: string) {
    if ((product.stock ?? 0) <= 0) return
    const inCart = cartQtyMap[product.id] ?? 0
    if (inCart >= (product.stock ?? 0)) return

    // If product has sizes and no size selected, show picker
    if (product.has_sizes && !size) {
      setSizePickerProduct(product)
      return
    }

    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      stock: product.stock ?? 0,
      sku: product.sku,
      category_id: product.category_id,
    }, size ?? null)

    playAddSound()
    setLastAdded(product.id)
    setTimeout(() => setLastAdded(null), 600)
  }

  function handleSizeSelect(size: string) {
    if (!sizePickerProduct) return
    addProduct(sizePickerProduct, size)
    setSizePickerProduct(null)
  }

  // Scanner de código de barras
  useBarcode((code) => {
    const product = products.find(
      (p) =>
        p.sku?.toLowerCase() === code.toLowerCase() || p.id === code
    )
    if (product) {
      addProduct(product)
      setBarcodeFlash(product.id)
      setTimeout(() => setBarcodeFlash(null), 1000)
    }
  })

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-zinc-950">

      {/* BUSCADOR + FILTROS */}
      <div className="border-b border-zinc-800/60 px-4 pb-3 pt-4">
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o escanear código..."
            className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900/80 pl-10 pr-10 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-slate-600 focus:ring-1 focus:ring-slate-600/30 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* CATEGORÍAS */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setCategory('')}
              className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                !category
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-600'
              }`}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id === category ? '' : cat.id)}
                className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  category === cat.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-600'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* STATS BAR */}
      <div className="flex items-center justify-between border-b border-zinc-800/40 px-4 py-2">
        <span className="text-xs text-zinc-600">
          {filtered.length} productos
          {search && <span className="ml-1 text-zinc-500">· "{search}"</span>}
        </span>
        {barcodeFlash && (
          <motion.span
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1 text-xs text-amber-400"
          >
            <Zap size={11} /> Código escaneado
          </motion.span>
        )}
      </div>

      {/* GRID DE PRODUCTOS */}
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
            <Package2 size={40} className="text-zinc-800" />
            <p className="mt-3 text-sm text-zinc-600">
              {search ? `Sin resultados para "${search}"` : 'No hay productos disponibles'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence>
              {filtered.map((product) => {
                const stock = product.stock ?? 0
                const inCart = cartQtyMap[product.id] ?? 0
                const outOfStock = stock === 0
                const cartFull = inCart >= stock && !outOfStock
                const isFlash = barcodeFlash === product.id
                const isAdded = lastAdded === product.id

                return (
                  <motion.button
                    key={product.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{
                      opacity: outOfStock ? 0.4 : 1,
                      scale: isAdded ? [1, 1.04, 1] : 1,
                      borderColor: isFlash ? 'rgba(245,158,11,0.6)' : undefined,
                    }}
                    transition={{ duration: 0.2 }}
                    onClick={() => addProduct(product)}
                    disabled={outOfStock}
                    className={`group relative flex flex-col rounded-2xl border p-2.5 text-left transition-all duration-150 ${
                      outOfStock
                        ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/50'
                        : isFlash
                        ? 'border-amber-500/50 bg-amber-500/8 shadow-[0_0_14px_rgba(245,158,11,0.12)]'
                        : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800 active:scale-[0.97]'
                    }`}
                  >
                    {/* Imagen */}
                    <div className="relative mb-2 aspect-square overflow-hidden rounded-xl bg-zinc-800">
                      {product.image_url ? (
                        <Image
                          src={product.image_url}
                          alt={product.name}
                          fill
                          className="object-cover transition group-hover:scale-105"
                          sizes="150px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-3xl">
                          📦
                        </div>
                      )}

                      {/* Badge cantidad en carrito */}
                      <AnimatePresence>
                        {inCart > 0 && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-black shadow-md"
                          >
                            {inCart}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Info */}
                    <p className="mb-1 line-clamp-2 text-xs font-semibold leading-tight text-white">
                      {product.name}
                    </p>

                    <div className="mt-auto flex items-end justify-between gap-1">
                      <span className="text-sm font-black text-slate-200">
                        {fmt(product.price)}
                      </span>
                      <StockBadge
                        stock={stock}
                        lowAlert={product.low_stock_alert}
                      />
                    </div>

                    {/* SKU */}
                    {product.sku && (
                      <p className="mt-1 text-[9px] text-zinc-600">{product.sku}</p>
                    )}

                    {/* Overlay sin stock */}
                    {outOfStock && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40">
                        <span className="rounded-full bg-black/60 px-2 py-1 text-[11px] font-bold text-red-400">
                          Sin stock
                        </span>
                      </div>
                    )}
                  </motion.button>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Size Picker Modal */}
      {sizePickerProduct && (
        <SizePicker
          product={sizePickerProduct}
          onSelect={handleSizeSelect}
          onClose={() => setSizePickerProduct(null)}
        />
      )}
    </div>
  )
}
