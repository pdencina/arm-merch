'use client'

import { useMemo, useState } from 'react'
import { Search, MapPin, RefreshCw } from 'lucide-react'
import ProductTable from '@/components/inventory/product-table'
import MovementForm from '@/components/inventory/movement-form'
import LowStockAlert from '@/components/inventory/low-stock-alert'

interface CampusOption {
  id: string
  name: string
}

interface Props {
  initialProducts: any[]
  categories: { id: string; name: string }[]
  campuses: CampusOption[]
  userRole?: string
  userCampusId?: string | null
  userCampusName?: string | null
  onReload?: () => void
}

export default function InventoryClient({
  initialProducts,
  categories,
  campuses,
  userRole,
  userCampusId,
  userCampusName,
  onReload,
}: Props) {
  const [products, setProducts] = useState<any[]>(initialProducts)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCat] = useState('')
  const [filterStock, setFilterStock] = useState<'all' | 'low' | 'out'>('all')
  const [movementProduct, setMovProd] = useState<any | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const isSuperAdmin = userRole === 'super_admin'

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (p.campus_name ?? '').toLowerCase().includes(search.toLowerCase())

      const matchCat = !filterCategory || p.category_id === filterCategory
      const matchStock =
        filterStock === 'all'
          ? true
          : filterStock === 'out'
          ? (p.stock ?? 0) === 0
          : (p.stock ?? 0) > 0 && (p.stock ?? 0) <= (p.low_stock_alert ?? 5)

      return matchSearch && matchCat && matchStock
    })
  }, [products, search, filterCategory, filterStock])

  const lowStock = products.filter(
    (p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= (p.low_stock_alert ?? 5)
  )
  const outStock = products.filter((p) => (p.stock ?? 0) === 0)
  const totalVal = products.reduce((s, p) => s + p.price * (p.stock ?? 0), 0)

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(n)

  async function handleRefresh() {
    if (!onReload) return
    setRefreshing(true)
    await onReload()
    setRefreshing(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Inventario</h1>
          {userCampusName && !isSuperAdmin ? (
            <div className="mt-1 flex items-center gap-1.5">
              <MapPin size={11} className="text-amber-400" />
              <span className="text-xs font-medium text-amber-400">{userCampusName}</span>
              <span className="text-xs text-zinc-600">· Stock de tu campus</span>
            </div>
          ) : (
            <p className="mt-0.5 text-xs text-zinc-500">Gestión de stock global</p>
          )}
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 transition hover:bg-zinc-700 disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total productos', value: products.length.toString(), color: 'text-white' },
          { label: 'Valor inventario', value: fmt(totalVal), color: 'text-amber-400' },
          { label: 'Stock bajo', value: lowStock.length.toString(), color: 'text-orange-400' },
          { label: 'Sin stock', value: outStock.length.toString(), color: 'text-red-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-700/40 bg-zinc-800/50 p-4">
            <p className="mb-1 text-xs text-zinc-500">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {(lowStock.length > 0 || outStock.length > 0) && (
        <LowStockAlert
          lowStock={lowStock}
          outOfStock={outStock}
          onAdjust={(p) => setMovProd(p)}
        />
      )}

      <div className="flex flex-col flex-wrap gap-3 sm:flex-row">
        <div className="relative min-w-48 flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto, SKU o campus..."
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 pl-9 pr-4 text-sm text-white placeholder-zinc-600 transition focus:border-amber-500 focus:outline-none"
          />
        </div>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCat(e.target.value)}
          className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-300 transition focus:border-amber-500 focus:outline-none"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={filterStock}
          onChange={(e) => setFilterStock(e.target.value as any)}
          className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-300 transition focus:border-amber-500 focus:outline-none"
        >
          <option value="all">Todo el stock</option>
          <option value="low">Stock bajo</option>
          <option value="out">Sin stock</option>
        </select>
      </div>

      <ProductTable
        products={filtered}
        campus={campuses}
        onMovement={(p) => setMovProd(p)}
      />

      {movementProduct && (
        <MovementForm
          product={movementProduct}
          campus={campuses}
          userCampusId={userCampusId}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setMovProd(null)}
          onSuccess={(newStock?: number) => {
            if (newStock !== undefined && movementProduct) {
              setProducts((prev) =>
                prev.map((p) =>
                  p.inventory_id === movementProduct.inventory_id
                    ? {
                        ...p,
                        stock: newStock,
                        low_stock: newStock <= (p.low_stock_alert ?? 5),
                      }
                    : p
                )
              )
            }
            setMovProd(null)
          }}
        />
      )}
    </div>
  )
}