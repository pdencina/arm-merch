'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Search, ScanLine, XCircle } from 'lucide-react'
import { useCart } from '@/lib/hooks/use-cart'
import { useBarcode } from '@/lib/hooks/use-barcode'
import ProductVariantModal, { type ProductVariantOption } from './product-variant-modal'

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

function normalizeBarcode(value: string) {
  return String(value ?? '').replace(/\D/g, '').trim()
}


  function sortProductsByName(list: Product[]) {
    return [...list].sort((a, b) =>
      (a.name ?? '').localeCompare(b.name ?? '', 'es', {
        sensitivity: 'base',
        numeric: true,
      })
    )
  }

export default function ProductGrid({ products, categories }: Props) {
  const { addItem } = useCart()

  const [liveProducts, setLiveProducts] = useState(products)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [variantOpen, setVariantOpen] = useState(false)
  const [selectedVariantProduct, setSelectedVariantProduct] = useState<{
    product: Product
    variantType: 'talla' | 'tamaño'
    title: string
    subtitle: string
    options: ProductVariantOption[]
  } | null>(null)
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


  function getProductVariantConfig(product: Product) {
    const name = normalizeCode(product.name)
    const sku = normalizeCode(product.sku ?? '')

    const isClothing =
      name.includes('polera') ||
      name.includes('poleron') ||
      name.includes('polerón') ||
      name.includes('hoodie') ||
      name.includes('chaqueta') ||
      name.includes('camiseta') ||
      sku.includes('polera') ||
      sku.includes('poleron') ||
      sku.includes('hoodie')

    if (isClothing) {
      return {
        variantType: 'talla' as const,
        title: 'Selecciona la talla',
        subtitle: 'La talla quedará visible en el carrito y en la orden para producción.',
        options: [
          { label: 'XS', value: 'XS' },
          { label: 'S', value: 'S' },
          { label: 'M', value: 'M' },
          { label: 'L', value: 'L' },
          { label: 'XL', value: 'XL' },
          { label: 'XXL', value: 'XXL' },
        ],
      }
    }

    return null
  }

  function openVariantSelector(product: Product) {
    const config = getProductVariantConfig(product)

    if (!config) return false

    setSelectedVariantProduct({
      product,
      ...config,
    })
    setVariantOpen(true)

    return true
  }

  function addProduct(product: Product) {
    if ((product.stock ?? 0) <= 0) {
      setScanError(`Sin stock: ${product.name}`)
      setTimeout(() => setScanError(null), 2500)
      return
    }

    if (openVariantSelector(product)) {
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
    })

    playAddSound()
  }

  const findProductByCode = useCallback(
    (code: string) => {
      const normalized = normalizeCode(code)
      const numeric = normalizeBarcode(code)

      if (!normalized) return null

      return (
        liveProducts.find((p) => {
          const sku = normalizeCode(p.sku ?? '')
          const barcode = normalizeBarcode(p.barcode ?? '')
          const id = normalizeCode(p.id ?? '')

          return (
            sku === normalized ||
            id === normalized ||
            (!!numeric && barcode === numeric)
          )
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

  useEffect(() => {
    const focusHandler = () => {
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select?.()
      }, 80)
    }

    window.addEventListener('arm-merch-focus-search', focusHandler)

    return () => {
      window.removeEventListener('arm-merch-focus-search', focusHandler)
    }
  }, [])

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-zinc-800 px-5 py-4">
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
              className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 pl-10 pr-4 text-sm text-white outline-none transition focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/5"
            />
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="hidden h-12 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-xs font-semibold text-white outline-none transition focus:border-amber-500/50 md:block"
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

      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filtered.map((product) => (
            <button
              key={product.id}
              onClick={() => addProduct(product)}
              disabled={(product.stock ?? 0) <= 0}
              className="group relative rounded-3xl border border-white/5 bg-zinc-900/80 p-3 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-amber-500/20 hover:bg-zinc-900 hover:shadow-[0_18px_50px_rgba(0,0,0,0.35)] disabled:cursor-not-allowed disabled:opacity-40"
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

              <div className="mb-3 flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-zinc-800 transition group-hover:bg-zinc-800/80">
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

              <p className="mb-1 line-clamp-2 text-sm font-bold leading-tight text-white">
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

              <p className="text-base font-black text-amber-400">
                {fmt(product.price)}
              </p>
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <Search size={34} className="mb-3 text-zinc-700" />
            <p className="text-sm font-semibold text-zinc-400">
              No encontramos productos
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Prueba con otro nombre, SKU o código de barra.
            </p>
          </div>
        )}
      </div>

      <div className="hidden border-t border-zinc-800 px-5 py-3 text-center text-[11px] text-zinc-600 md:block">
        Escanea un código de barras para agregar rápido al carrito
      </div>
      </div>
      <ProductVariantModal
        open={variantOpen}
        title={selectedVariantProduct?.title ?? 'Selecciona una opción'}
        subtitle={selectedVariantProduct?.subtitle}
        options={selectedVariantProduct?.options ?? []}
        onClose={() => {
          setVariantOpen(false)
          setSelectedVariantProduct(null)
        }}
        onSelect={(option) => {
          if (!selectedVariantProduct) return

          const product = selectedVariantProduct.product

          addItem(
            {
              id: product.id,
              name: product.name,
              price: product.price,
              image_url: product.image_url,
              stock: product.stock ?? 0,
              sku: product.sku,
              category_id: product.category_id,
            },
            selectedVariantProduct.variantType === 'talla' ? option.value : null,
            selectedVariantProduct.variantType,
            option.value,
            option.price ?? product.price
          )

          playAddSound()
          setVariantOpen(false)
          setSelectedVariantProduct(null)
        }}
      />
    </>
  )
}
