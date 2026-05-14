'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Printer,
  Minus,
  Plus,
  Search,
  Tag,
  CheckSquare,
  Square,
  Barcode,
  ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import JsBarcode from 'jsbarcode'

// ─── Types ────────────────────────────────────────────────────────────────────
type Product = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  price: number
  category_name: string | null
}

type LabelItem = {
  product: Product
  quantity: number
}

const LABEL_SIZES = {
  small: {
    label: 'Pequeña (50×25mm)',
    w: 189,
    h: 94,
    fontSize: 8,
    priceSize: 13,
    barcodeHeight: 34,
    barcodeWidth: 1.35,
    barcodeMargin: 8,
  },
  medium: {
    label: 'Mediana (70×40mm)',
    w: 264,
    h: 151,
    fontSize: 10,
    priceSize: 16,
    barcodeHeight: 56,
    barcodeWidth: 1.6,
    barcodeMargin: 12,
  },
  large: {
    label: 'Grande (100×60mm)',
    w: 378,
    h: 227,
    fontSize: 12,
    priceSize: 22,
    barcodeHeight: 82,
    barcodeWidth: 2,
    barcodeMargin: 20,
  },
}

type SizeKey = keyof typeof LABEL_SIZES

function cleanSku(value: string) {
  return String(value ?? '')
    .replace(/[^A-Z0-9-]/gi, '')
    .toUpperCase()
    .trim()
}

function cleanBarcode(value: string | null | undefined) {
  return String(value ?? '').replace(/\D/g, '').trim()
}

function isEan13(value: string) {
  return /^\d{13}$/.test(value)
}

function getPrintCode(product: Product) {
  const barcode = cleanBarcode(product.barcode)

  if (isEan13(barcode)) {
    return {
      value: barcode,
      format: 'EAN13' as const,
      label: barcode,
    }
  }

  const sku = cleanSku(product.sku ?? product.id.slice(0, 8))

  return {
    value: sku,
    format: 'CODE128' as const,
    label: sku,
  }
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n)
}

function generateBarcodePng(
  value: string,
  format: 'EAN13' | 'CODE128',
  cfg: (typeof LABEL_SIZES)[SizeKey],
  size: SizeKey
) {
  if (typeof document === 'undefined') return ''

  const canvas = document.createElement('canvas')

  try {
    JsBarcode(canvas, value, {
      format,
      width: cfg.barcodeWidth,
      height: cfg.barcodeHeight,
      displayValue: false,
      margin: cfg.barcodeMargin,
      background: '#ffffff',
      lineColor: '#000000',
    })

    return canvas.toDataURL('image/png')
  } catch (err) {
    console.error('Barcode PNG error:', err)
    return ''
  }
}

// ─── Single Label Component ───────────────────────────────────────────────────
function Label({
  item,
  size,
  showPrice,
  showSku,
  brandName,
}: {
  item: LabelItem
  size: SizeKey
  showPrice: boolean
  showSku: boolean
  brandName: string
}) {
  const cfg = LABEL_SIZES[size]
  const code = getPrintCode(item.product)

  const barcodeSrc = useMemo(() => {
    return generateBarcodePng(code.value, code.format, cfg, size)
  }, [code.value, code.format, cfg, size])

  return (
    <div
      className="label-item flex flex-col items-center justify-between overflow-hidden border border-zinc-300 bg-white"
      style={{
        width: cfg.w,
        height: cfg.h,
        padding: size === 'large' ? '8px 12px' : '5px 8px',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="flex w-full items-center justify-between gap-2"
        style={{ fontSize: cfg.fontSize - 1 }}
      >
        <span className="truncate font-bold text-zinc-800">{brandName}</span>

        {showSku && (
          <span className="shrink-0 font-mono text-zinc-500">
            {item.product.sku ?? code.label}
          </span>
        )}
      </div>

      <div
        className="w-full text-center font-semibold leading-tight text-zinc-900"
        style={{
          fontSize: cfg.fontSize,
          maxHeight: cfg.h * 0.18,
          overflow: 'hidden',
        }}
      >
        {item.product.name}
      </div>

      <div className="flex w-full flex-col items-center justify-center bg-white">
        {barcodeSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={barcodeSrc}
            alt={code.label}
            className="barcode-img"
            style={{
              width: cfg.w - 36,
              height: cfg.barcodeHeight + cfg.barcodeMargin * 2,
              objectFit: 'contain',
              display: 'block',
            }}
          />
        ) : (
          <div
            className="flex items-center justify-center text-xs text-red-500"
            style={{
              width: cfg.w - 36,
              height: cfg.barcodeHeight + cfg.barcodeMargin * 2,
            }}
          >
            Error barcode
          </div>
        )}

        <div
          className="w-full text-center font-mono font-bold text-black"
          style={{ fontSize: cfg.fontSize }}
        >
          {code.label}
        </div>
      </div>

      {showPrice && (
        <div
          className="w-full text-center font-black text-zinc-900"
          style={{ fontSize: cfg.priceSize }}
        >
          {formatCurrency(item.product.price)}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LabelsPage() {
  const supabase = createClient()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<LabelItem[]>([])

  const [size, setSize] = useState<SizeKey>('large')
  const [showPrice, setShowPrice] = useState(true)
  const [showSku, setShowSku] = useState(true)
  const [brandName, setBrandName] = useState('ARM Merch')
  const [cols, setCols] = useState(2)

  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)

    const { data } = await supabase
      .from('products')
      .select('id, name, sku, barcode, price, category:categories(name)')
      .eq('active', true)
      .order('name')

    setProducts(
      (data ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        price: p.price,
        category_name: Array.isArray(p.category)
          ? p.category[0]?.name
          : p.category?.name,
      }))
    )

    setLoading(false)
  }

  function toggleProduct(product: Product) {
    const exists = selected.find((s) => s.product.id === product.id)

    if (exists) {
      setSelected((prev) => prev.filter((s) => s.product.id !== product.id))
    } else {
      setSelected((prev) => [...prev, { product, quantity: 1 }])
    }
  }

  function updateQty(id: string, delta: number) {
    setSelected((prev) =>
      prev.map((s) =>
        s.product.id === id
          ? {
              ...s,
              quantity: Math.max(1, Math.min(50, s.quantity + delta)),
            }
          : s
      )
    )
  }

  function handlePrint() {
    const printWin = window.open('', '_blank', 'width=1000,height=800')

    if (!printWin || !printRef.current) return

    const html = printRef.current.innerHTML

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiquetas ARM Merch</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            body {
              background: white;
              font-family: Arial, sans-serif;
            }

            .print-grid {
              display: grid;
              grid-template-columns: repeat(${cols}, max-content);
              gap: 8px;
              padding: 8px;
              align-items: start;
              justify-content: start;
            }

            .label-item {
              border: 1px dashed #bbb;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              overflow: hidden;
              page-break-inside: avoid;
              break-inside: avoid;
              background: #fff;
            }

            .barcode-img {
              image-rendering: crisp-edges;
              image-rendering: pixelated;
            }

            @page {
              margin: 6mm;
            }

            @media print {
              body {
                margin: 0;
              }

              .label-item {
                border: 1px dashed #ccc;
              }
            }
          </style>
        </head>

        <body>
          <div class="print-grid">${html}</div>

          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 700);
          <\/script>
        </body>
      </html>
    `)

    printWin.document.close()
  }

  const filtered = products.filter((p) => {
    const text = search.toLowerCase().trim()
    const code = getPrintCode(p).label.toLowerCase()

    return (
      !text ||
      p.name.toLowerCase().includes(text) ||
      (p.sku ?? '').toLowerCase().includes(text) ||
      (p.barcode ?? '').toLowerCase().includes(text) ||
      code.includes(text)
    )
  })

  const expandedLabels = selected.flatMap((s) =>
    Array.from({ length: s.quantity }, () => s)
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/products"
            className="rounded-xl border border-zinc-700 p-2 text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft size={16} />
          </Link>

          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
              <Tag size={18} className="text-amber-400" />
              Generador de etiquetas
            </h1>

            <p className="mt-0.5 text-xs text-zinc-500">
              {selected.length} productos · {expandedLabels.length} etiquetas
            </p>
          </div>
        </div>

        {selected.length > 0 && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-400"
          >
            <Printer size={16} />
            Imprimir {expandedLabels.length} etiquetas
          </button>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto, SKU o barcode..."
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 pl-9 pr-4 text-sm text-white placeholder-zinc-600 transition focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <div className="flex items-center justify-between bg-zinc-800/60 px-4 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Productos ({filtered.length})
              </p>

              {selected.length > 0 && (
                <button
                  onClick={() => setSelected([])}
                  className="text-[10px] text-zinc-600 transition hover:text-red-400"
                >
                  Limpiar selección
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              </div>
            ) : (
              <div className="max-h-[480px] divide-y divide-zinc-800/60 overflow-y-auto">
                {filtered.map((product) => {
                  const isSelected = selected.some(
                    (s) => s.product.id === product.id
                  )

                  const item = selected.find(
                    (s) => s.product.id === product.id
                  )

                  const code = getPrintCode(product)

                  return (
                    <div
                      key={product.id}
                      className={`flex items-center gap-3 px-4 py-3 transition ${
                        isSelected
                          ? 'bg-amber-500/5'
                          : 'hover:bg-zinc-800/30'
                      }`}
                    >
                      <button
                        onClick={() => toggleProduct(product)}
                        className="shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare size={18} className="text-amber-400" />
                        ) : (
                          <Square size={18} className="text-zinc-600" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-zinc-200">
                          {product.name}
                        </p>

                        <div className="flex flex-wrap gap-2 text-[10px] text-zinc-600">
                          {product.sku && <span>SKU: {product.sku}</span>}
                          <span>Barcode: {code.label}</span>
                          {product.category_name && (
                            <span>· {product.category_name}</span>
                          )}
                        </div>
                      </div>

                      <span className="shrink-0 text-sm font-bold text-white">
                        {formatCurrency(product.price)}
                      </span>

                      {isSelected && item && (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => updateQty(product.id, -1)}
                            className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-700 text-white transition hover:bg-zinc-600"
                          >
                            <Minus size={10} />
                          </button>

                          <span className="w-7 text-center text-sm font-bold text-white">
                            {item.quantity}
                          </span>

                          <button
                            onClick={() => updateQty(product.id, 1)}
                            className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-700 text-white transition hover:bg-zinc-600"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Configuración
            </p>

            <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-xs leading-5 text-green-300">
              Ahora el barcode se genera como imagen PNG. Debe verse con barras
              negras y número abajo. Recomendado: productos con barcode EAN13.
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-zinc-500">
                Nombre de marca
              </label>

              <input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white transition focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-zinc-500">
                Tamaño de etiqueta
              </label>

              <div className="grid grid-cols-3 gap-1.5">
                {(
                  Object.entries(LABEL_SIZES) as [
                    SizeKey,
                    (typeof LABEL_SIZES)[SizeKey],
                  ][]
                ).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => setSize(k)}
                    className={`rounded-xl border py-2 text-xs font-semibold transition ${
                      size === k
                        ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                    }`}
                  >
                    {k.charAt(0).toUpperCase() + k.slice(1)}

                    <div className="text-[9px] font-normal opacity-70">
                      {v.label.split('(')[1]?.replace(')', '')}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-zinc-500">
                Columnas por fila: {cols}
              </label>

              <input
                type="range"
                min={1}
                max={3}
                value={cols}
                onChange={(e) => setCols(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>

            <div className="space-y-2">
              {[
                { label: 'Mostrar precio', value: showPrice, set: setShowPrice },
                { label: 'Mostrar SKU', value: showSku, set: setShowSku },
              ].map(({ label, value, set }) => (
                <button
                  key={label}
                  onClick={() => set(!value)}
                  className="flex w-full items-center justify-between rounded-xl bg-zinc-800 px-3 py-2.5 transition hover:bg-zinc-700"
                >
                  <span className="text-sm text-zinc-300">{label}</span>

                  <div
                    className={`relative flex h-5 w-9 items-center rounded-full transition ${
                      value ? 'bg-amber-500' : 'bg-zinc-600'
                    }`}
                  >
                    <span
                      className={`absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-all ${
                        value ? 'left-[18px]' : 'left-[3px]'
                      }`}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selected.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
                Vista previa / impresión
              </p>

              <div
                ref={printRef}
                className="print-grid grid max-h-[420px] gap-2 overflow-auto rounded-lg bg-white p-2"
                style={{
                  gridTemplateColumns: `repeat(${cols}, max-content)`,
                }}
              >
                {expandedLabels.map((item, i) => (
                  <Label
                    key={i}
                    item={item}
                    size={size}
                    showPrice={showPrice}
                    showSku={showSku}
                    brandName={brandName}
                  />
                ))}
              </div>

              <p className="mt-2 text-center text-[10px] text-zinc-600">
                {expandedLabels.length} etiquetas · {cols} columnas por fila
              </p>
            </div>
          )}

          {selected.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 py-12 text-center">
              <Barcode size={36} className="text-zinc-700" />

              <p className="mt-3 text-sm text-zinc-600">
                Selecciona productos de la lista para generar etiquetas
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
