'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  AlertTriangle,
  DollarSign,
  Loader2,
  Package,
  Save,
  Search,
  TrendingUp,
} from 'lucide-react'

type PricingProduct = {
  id: string
  name: string
  sku?: string | null
  price: number
  purchase_price: number
  stock: number
  category_name?: string | null
  campus_name?: string | null
}

type EditableProduct = PricingProduct & {
  dirty?: boolean
}

const fmt = (value: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const safeNumber = (value: any) => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function marginPercent(price: number, purchasePrice: number) {
  if (!price || price <= 0) return 0
  return ((price - purchasePrice) / price) * 100
}

function marginStatus(margin: number) {
  if (margin < 20) {
    return {
      label: 'Riesgo',
      className: 'border-red-500/20 bg-red-500/10 text-red-300',
    }
  }

  if (margin < 35) {
    return {
      label: 'Medio',
      className: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    }
  }

  return {
    label: 'Saludable',
    className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  }
}

export default function PricingPage() {
  const [products, setProducts] = useState<EditableProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'risk' | 'dirty'>('all')

  async function loadProducts() {
    setLoading(true)

    try {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('products_with_stock')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error

      const mapped: EditableProduct[] = (data ?? []).map((row: any) => ({
        id: String(row.id ?? row.product_id),
        name: row.name ?? row.product_name ?? 'Producto sin nombre',
        sku: row.sku ?? row.code ?? null,
        price: safeNumber(row.price ?? row.sale_price ?? row.unit_price),
        purchase_price: safeNumber(row.purchase_price ?? row.cost_price ?? row.cost),
        stock: safeNumber(row.stock ?? row.available_stock ?? row.current_stock),
        category_name: row.category_name ?? row.category ?? null,
        campus_name: row.campus_name ?? row.campus ?? null,
        dirty: false,
      }))

      setProducts(mapped)
    } catch (error: any) {
      console.error('[Pricing] load error:', error)
      toast.error(error?.message || 'No se pudieron cargar los productos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()

    return products.filter((product) => {
      const productMargin = marginPercent(product.price, product.purchase_price)

      const matchesSearch =
        !query ||
        (product.name ?? '').toLowerCase().includes(query) ||
        (product.sku ?? '').toLowerCase().includes(query) ||
        (product.category_name ?? '').toLowerCase().includes(query) ||
        (product.campus_name ?? '').toLowerCase().includes(query)

      const matchesFilter =
        filter === 'all'
          ? true
          : filter === 'risk'
          ? productMargin < 20
          : Boolean(product.dirty)

      return matchesSearch && matchesFilter
    })
  }, [products, search, filter])

  const totals = useMemo(() => {
    const saleValue = products.reduce((sum, product) => {
      return sum + product.price * Math.max(product.stock, 0)
    }, 0)

    const costValue = products.reduce((sum, product) => {
      return sum + product.purchase_price * Math.max(product.stock, 0)
    }, 0)

    const profit = saleValue - costValue
    const margin = saleValue > 0 ? (profit / saleValue) * 100 : 0
    const riskCount = products.filter((product) => {
      return marginPercent(product.price, product.purchase_price) < 20
    }).length

    return {
      saleValue,
      costValue,
      profit,
      margin,
      riskCount,
      dirtyCount: products.filter((product) => product.dirty).length,
    }
  }, [products])

  function updateProduct(
    id: string,
    field: 'purchase_price' | 'price',
    value: number
  ) {
    setProducts((current) =>
      current.map((product) =>
        product.id === id
          ? {
              ...product,
              [field]: safeNumber(value),
              dirty: true,
            }
          : product
      )
    )
  }

  async function saveChanges() {
    const dirtyProducts = products.filter((product) => product.dirty)

    if (dirtyProducts.length === 0) {
      toast.message('No hay cambios pendientes')
      return
    }

    setSaving(true)

    try {
      const supabase = createClient()

      for (const product of dirtyProducts) {
        const { error } = await supabase
          .from('products')
          .update({
            price: product.price,
            purchase_price: product.purchase_price,
            updated_at: new Date().toISOString(),
          })
          .eq('id', product.id)

        if (error) throw error
      }

      setProducts((current) =>
        current.map((product) => ({
          ...product,
          dirty: false,
        }))
      )

      toast.success('Precios actualizados correctamente')
      await loadProducts()
    } catch (error: any) {
      console.error('[Pricing] save error:', error)
      toast.error(
        error?.message ||
          'No se pudieron guardar los precios. Revisa columnas o permisos.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 text-white">
      <section className="relative overflow-hidden rounded-[32px] border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-7">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
              Pricing Center
            </div>

            <h1 className="text-4xl font-black tracking-tight">
              Gestión de precios
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-500">
              Administra precio compra, precio venta, ganancia y margen real de todos los productos.
            </p>
          </div>

          <button
            onClick={saveChanges}
            disabled={saving || totals.dirtyCount === 0}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Guardando...' : `Guardar cambios${totals.dirtyCount ? ` (${totals.dirtyCount})` : ''}`}
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Valor venta inventario"
          value={fmt(totals.saleValue)}
          detail="Precio venta por stock disponible."
          icon={<DollarSign size={20} />}
          tone="emerald"
        />

        <KpiCard
          title="Costo inventario"
          value={fmt(totals.costValue)}
          detail="Precio compra por stock disponible."
          icon={<Package size={20} />}
          tone="blue"
        />

        <KpiCard
          title="Margen promedio"
          value={`${totals.margin.toFixed(1)}%`}
          detail={`Ganancia estimada ${fmt(totals.profit)}.`}
          icon={<TrendingUp size={20} />}
          tone="amber"
        />

        <KpiCard
          title="Riesgo margen"
          value={String(totals.riskCount)}
          detail="Productos bajo 20% de margen."
          icon={<AlertTriangle size={20} />}
          tone="red"
        />
      </section>

      <section className="rounded-[32px] border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-2xl font-black">Productos & márgenes</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {filteredProducts.length} productos visibles de {products.length} cargados.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative w-full md:w-[360px]">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar producto, SKU, categoría o campus..."
                className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-950 pl-11 pr-4 text-sm text-white outline-none transition focus:border-emerald-500"
              />
            </div>

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as any)}
              className="h-12 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-sm font-bold text-zinc-300 outline-none transition focus:border-emerald-500"
            >
              <option value="all">Todos</option>
              <option value="risk">Bajo margen</option>
              <option value="dirty">Cambios pendientes</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center text-zinc-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Cargando productos...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px]">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-widest text-zinc-500">
                  <th className="pb-4">Producto</th>
                  <th className="pb-4">Campus</th>
                  <th className="pb-4">Stock</th>
                  <th className="pb-4">Precio compra</th>
                  <th className="pb-4">Precio venta</th>
                  <th className="pb-4">Ganancia</th>
                  <th className="pb-4">Margen</th>
                  <th className="pb-4">Estado</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => {
                  const profit = product.price - product.purchase_price
                  const margin = marginPercent(product.price, product.purchase_price)
                  const status = marginStatus(margin)

                  return (
                    <tr
                      key={product.id}
                      className="border-b border-zinc-800/60"
                    >
                      <td className="py-5">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-zinc-100">
                              {product.name}
                            </p>

                            {product.dirty && (
                              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-300">
                                Editado
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-xs text-zinc-500">
                            {product.sku ? `SKU ${product.sku}` : `ID ${product.id}`}
                          </p>
                        </div>
                      </td>

                      <td className="py-5 text-sm text-zinc-400">
                        {product.campus_name || 'Global'}
                      </td>

                      <td className="py-5 text-zinc-300">
                        {product.stock}
                      </td>

                      <td className="py-5">
                        <input
                          type="number"
                          min={0}
                          value={product.purchase_price}
                          onChange={(event) =>
                            updateProduct(
                              product.id,
                              'purchase_price',
                              Number(event.target.value)
                            )
                          }
                          className="w-36 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
                        />
                      </td>

                      <td className="py-5">
                        <input
                          type="number"
                          min={0}
                          value={product.price}
                          onChange={(event) =>
                            updateProduct(
                              product.id,
                              'price',
                              Number(event.target.value)
                            )
                          }
                          className="w-36 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
                        />
                      </td>

                      <td className={profit < 0 ? 'py-5 font-black text-red-300' : 'py-5 font-black text-emerald-300'}>
                        {fmt(profit)}
                      </td>

                      <td className="py-5">
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${status.className}`}>
                          {margin.toFixed(1)}%
                        </span>
                      </td>

                      <td className="py-5">
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-sm text-zinc-500">
                      No hay productos para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function KpiCard({
  title,
  value,
  detail,
  icon,
  tone,
}: {
  title: string
  value: string
  detail: string
  icon: React.ReactNode
  tone: 'emerald' | 'blue' | 'amber' | 'red'
}) {
  const styles = {
    emerald: 'bg-emerald-500/10 text-emerald-300',
    blue: 'bg-blue-500/10 text-blue-300',
    amber: 'bg-amber-500/10 text-amber-300',
    red: 'bg-red-500/10 text-red-300',
  }

  return (
    <div className="rounded-[28px] border border-zinc-800 bg-zinc-900 p-5">
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${styles[tone]}`}>
        {icon}
      </div>

      <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
        {title}
      </p>

      <p className="mt-3 text-3xl font-black">
        {value}
      </p>

      <p className="mt-2 text-sm text-zinc-500">
        {detail}
      </p>
    </div>
  )
}
