'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Search, ScanLine, XCircle } from 'lucide-react'
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

function normalizeCode(value: string) {
  return String(value ?? '').trim().toLowerCase()
}

export default function ProductGrid({ products, categories }: Props) {
  const { addItem } = useCart()

  const [liveProducts, setLiveProducts] = useState(products)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLiveProducts(products)
  }, [products])

  useEffect(() => {
    const handler = (event: any) => {
      const items = event.detail?.items || []

      setLiveProducts((prev) =>
        prev.map((product) => {
          const sold = items.find((i: any) => i.product_id === product.id)
          if (!sold) return product

          return {
            ...product,
            stock: Math.max(0, (product.stock ?? 0) - sold.quantity),
          }
        })
      )
    }

    window.addEventListener('arm-merch-stock-update', handler)

    return () => {
      window.removeEventListener('arm-merch-stock-update', handler)
    }
  }, [])

  const filtered = useMemo(() => {
    const text = normalizeCode(search)

    return liveProducts.filter((p) => {
      const matchSearch =
        !text ||
        p.name.toLowerCase().includes(text) ||
        (p.sku ?? '').toLowerCase().includes(text) ||
        (p.barcode ?? '').toLowerCase().includes(text)

      const matchCat = !category || p.category_id === category

      return matchSearch && matchCat
    })
  }, [liveProducts, search, category])

  function addProduct(product: Product) {
    if ((product.stock ?? 0) <= 0) {
      setScanError(`Sin stock: ${product.name}`)
      setTimeout(() => setScanError(null), 2500)
      return
    }

    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      stock: product.stock ?? 0,
    })

    playAddSound()
  }

  const findProductByCode = useCallback(
    (code: string) => {
      const normalized = normalizeCode(code)

      if (!normalized) return null

      return (
        liveProducts.find((p) => {
          const sku = normalizeCode(p.sku ?? '')
          const barcode = normalizeCode(p.barcode ?? '')
          const id = normalizeCode(p.id ?? '')

          return sku === normalized || barcode === normalized || id === normalized
        }) ?? null
      )
    },
    [liveProducts]
  )

  const handleScan = useCallback(
    (code: string) => {
      const cleanCode = code.trim()
      if (!cleanCode) return

      const product = findProductByCode(cleanCode)

      if (!product) {
        setScanMessage(null)
        setScanError(`No encontrado: ${cleanCode}`)
        setTimeout(() => setScanError(null), 2500)
        setSearch('')
        inputRef.current?.focus()
        return
      }

      addProduct(product)
      setScanError(null)
      setScanMessage(`Agregado: ${product.name}`)
      setSearch('')

      setTimeout(() => setScanMessage(null), 1800)
      setTimeout(() => inputRef.current?.focus(), 50)
    },
    [findProductByCode]
  )

  useBarcode(handleScan, {
    minLength: 3,
    timeout: 90,
  })

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return

    event.preventDefault()

    const value = search.trim()
    if (!value) return

    const product = findProductByCode(value)

    if (product) {
      handleScan(value)
      return
    }

    if (filtered.length === 1) {
      addProduct(filtered[0])
      setScanError(null)
      setScanMessage(`Agregado: ${filtered[0].name}`)
      setSearch('')
      setTimeout(() => setScanMessage(null), 1800)
      setTimeout(() => inputRef.current?.focus(), 50)
      return
    }

    setScanError(`No encontrado: ${value}`)
    setTimeout(() => setScanError(null), 2500)
  }

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />

            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Buscar o escanear SKU / código de barra..."
              className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 pl-10 pr-3 text-sm text-white outline-none focus:border-slate-400"
            />
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="hidden h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-white outline-none focus:border-slate-400 md:block"
          >
            <option value="">Categorías</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {(scanMessage || scanError) && (
          <div
            className={`mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
              scanError
                ? 'border border-red-500/20 bg-red-500/10 text-red-300'
                : 'border border-green-500/20 bg-green-500/10 text-green-300'
            }`}
          >
            {scanError ? <XCircle size={14} /> : <ScanLine size={14} />}
            {scanError || scanMessage}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => (
            <button
              key={product.id}
              onClick={() => addProduct(product)}
              disabled={(product.stock ?? 0) <= 0}
              className="relative rounded-xl bg-zinc-900 p-2 text-left transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {product.stock !== null && (
                <span
                  className={`absolute right-2 top-2 z-10 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    (product.stock ?? 0) <= 0
                      ? 'bg-red-500/20 text-red-400'
                      : (product.stock ?? 0) <= (product.low_stock_alert ?? 5)
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-green-500/20 text-green-400'
                  }`}
                >
                  {product.stock} uds
                </span>
              )}

              <div className="mb-2 flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-zinc-800">
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    width={120}
                    height={120}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-3xl">📦</span>
                )}
              </div>

              <p className="mb-0.5 line-clamp-2 text-xs font-medium leading-tight text-white">
                {product.name}
              </p>

              {product.sku && (
                <p className="mb-1 text-[10px] text-zinc-600">{product.sku}</p>
              )}

              {product.barcode && (
                <p className="mb-1 text-[10px] text-zinc-700">
                  Código: {product.barcode}
                </p>
              )}

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
