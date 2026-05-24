'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, MapPin, RefreshCw, Barcode, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import ProductTable from '@/components/inventory/product-table'
import MovementForm from '@/components/inventory/movement-form'
import LowStockAlert from '@/components/inventory/low-stock-alert'
import { createClient } from '@/lib/supabase/client'

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
  const [stockZeroProduct, setStockZeroProduct] = useState<any | null>(null)
  const [stockZeroLoading, setStockZeroLoading] = useState(false)
  const [stockZeroMessage, setStockZeroMessage] = useState<{
    type: 'success' | 'error'
    title: string
    description: string
  } | null>(null)

  const isSuperAdmin = userRole === 'super_admin'

  const filtered = useMemo(() => {
    const query = (search || '').toLowerCase()

    return products.filter((p) => {
      const matchSearch =
        !query ||
        (p.name ?? '').toLowerCase().includes(query) ||
        (p.sku ?? '').toLowerCase().includes(query) ||
        (p.campus_name ?? '').toLowerCase().includes(query)

      const matchCat =
        !filterCategory || p.category_id === filterCategory

      const matchStock =
        filterStock === 'all'
          ? true
          : filterStock === 'out'
          ? (p.stock ?? 0) === 0
          : (p.stock ?? 0) > 0 &&
            (p.stock ?? 0) <= (p.low_stock_alert ?? 5)

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

  async function handleSetStockZero() {
    if (!stockZeroProduct) return

    setStockZeroLoading(true)

    try {
      const supabase = createClient()

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        setStockZeroMessage({
          type: 'error',
          title: 'No autenticado',
          description: 'Tu sesión no está disponible. Cierra sesión e ingresa nuevamente.',
        })
        setStockZeroLoading(false)
        return
      }

      const res = await fetch('/api/inventory', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          inventory_id: stockZeroProduct.inventory_id,
          stock: 0,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setStockZeroMessage({
          type: 'error',
          title: 'No se pudo actualizar',
          description: data.error ?? 'Intenta nuevamente en unos segundos.',
        })
        setStockZeroLoading(false)
        return
      }

      setProducts((prev) =>
        prev.map((p) =>
          p.inventory_id === stockZeroProduct.inventory_id
            ? {
                ...p,
                stock: 0,
                low_stock: true,
              }
            : p
        )
      )

      setStockZeroProduct(null)
      setStockZeroMessage({
        type: 'success',
        title: 'Stock actualizado',
        description: `${stockZeroProduct.name} quedó con stock 0.`,
      })
    } catch {
      setStockZeroMessage({
        type: 'error',
        title: 'Error inesperado',
        description: 'No se pudo dejar el producto en stock 0.',
      })
    } finally {
      setStockZeroLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Inventario</h1>
          <Link
            href="/inventory/scan"
            className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-400 transition hover:bg-amber-500/20"
          >
            <Barcode size={15} />
            Escaneo
          </Link>

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
        onSetZero={(p) => setStockZeroProduct(p)}
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

      {stockZeroProduct && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#0F1216] shadow-2xl">
            <div className="border-b border-white/10 px-6 py-5">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
                <AlertTriangle size={22} />
              </div>

              <h2 className="text-2xl font-black tracking-tight text-white">
                Dejar stock en 0
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-400">
                ¿Deseas dejar{' '}
                <span className="font-bold text-white">“{stockZeroProduct.name}”</span>{' '}
                con stock 0?
              </p>

              <p className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-200">
                Esta acción no elimina el producto ni sus ventas históricas. Solo ajusta el inventario actual.
              </p>
            </div>

            <div className="flex gap-3 p-5">
              <button
                type="button"
                onClick={() => setStockZeroProduct(null)}
                disabled={stockZeroLoading}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSetStockZero}
                disabled={stockZeroLoading}
                className="flex-1 rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white transition hover:bg-red-400 disabled:opacity-50"
              >
                {stockZeroLoading ? 'Actualizando...' : 'Sí, dejar en 0'}
              </button>
            </div>
          </div>
        </div>
      )}

      {stockZeroMessage && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#0F1216] shadow-2xl">
            <div className="px-6 py-6">
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${
                  stockZeroMessage.type === 'success'
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-red-500/10 text-red-400'
                }`}
              >
                {stockZeroMessage.type === 'success' ? (
                  <CheckCircle2 size={22} />
                ) : (
                  <X size={22} />
                )}
              </div>

              <h2 className="text-2xl font-black tracking-tight text-white">
                {stockZeroMessage.title}
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {stockZeroMessage.description}
              </p>
            </div>

            <div className="border-t border-white/10 p-5">
              <button
                type="button"
                onClick={() => setStockZeroMessage(null)}
                className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}