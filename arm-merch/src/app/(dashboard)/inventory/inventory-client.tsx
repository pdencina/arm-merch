'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, AlertTriangle } from 'lucide-react'
import ProductTable from '@/components/inventory/product-table'
import MovementForm from '@/components/inventory/movement-form'
import LowStockAlert from '@/components/inventory/low-stock-alert'
import type { Product } from '@/types'

interface Props {
  initialProducts: Product[]
  categories: { id: string; name: string }[]
}

export default function InventoryClient({ initialProducts, categories }: Props) {
  const [products, setProducts]         = useState<Product[]>(initialProducts)
  const [search, setSearch]             = useState('')
  const [filterCategory, setFilterCat]  = useState('')
  const [filterStock, setFilterStock]   = useState<'all' | 'low' | 'out'>('all')
  const [movementProduct, setMovProd]   = useState<Product | null>(null)
  const supabase = createClient()

  // Realtime: escucha cambios en inventario
  useEffect(() => {
    const channel = supabase
      .channel('inventory-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, async () => {
        const { data } = await supabase
          .from('products_with_stock')
          .select('*')
          .order('name')
        if (data) setProducts(data)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const filtered = products.filter(p => {
    const matchSearch = search === '' ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? '').toLowerCase().includes(search.toLowerCase())

    const matchCat = filterCategory === '' || p.category_id === filterCategory

    const matchStock =
      filterStock === 'all' ? true :
      filterStock === 'out' ? (p.stock ?? 0) === 0 :
      filterStock === 'low' ? (p.stock ?? 0) > 0 && (p.stock ?? 0) <= (p.low_stock_alert ?? 5) :
      true

    return matchSearch && matchCat && matchStock
  })

  const lowStockProducts  = products.filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= (p.low_stock_alert ?? 5))
  const outOfStockProducts = products.filter(p => (p.stock ?? 0) === 0)
  const totalValue = products.reduce((sum, p) => sum + p.price * (p.stock ?? 0), 0)

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)

  return (
    <div className="flex flex-col gap-5">

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total productos', value: products.length.toString(), color: 'text-white' },
          { label: 'Valor inventario', value: fmt(totalValue), color: 'text-amber-400' },
          { label: 'Stock bajo', value: lowStockProducts.length.toString(), color: 'text-orange-400' },
          { label: 'Sin stock', value: outOfStockProducts.length.toString(), color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/40">
            <p className="text-xs text-zinc-500 mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Alertas de stock bajo */}
      {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
        <LowStockAlert
          lowStock={lowStockProducts}
          outOfStock={outOfStockProducts}
          onAdjust={(p) => setMovProd(p)}
        />
      )}

      {/* Filtros y búsqueda */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto o SKU..."
            className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600
                       rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition"
          />
        </div>

        <select
          value={filterCategory}
          onChange={e => setFilterCat(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl px-3 py-2.5 text-sm
                     focus:outline-none focus:border-amber-500 transition"
        >
          <option value="">Todas las categorías</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={filterStock}
          onChange={e => setFilterStock(e.target.value as typeof filterStock)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl px-3 py-2.5 text-sm
                     focus:outline-none focus:border-amber-500 transition"
        >
          <option value="all">Todo el stock</option>
          <option value="low">Stock bajo</option>
          <option value="out">Sin stock</option>
        </select>
      </div>

      {/* Tabla */}
      <ProductTable
        products={filtered}
        onMovement={p => setMovProd(p)}
      />

      {/* Modal movimiento */}
      {movementProduct && (
        <MovementForm
          product={movementProduct}
          onClose={() => setMovProd(null)}
          onSuccess={async () => {
            setMovProd(null)
            const { data } = await supabase.from('products_with_stock').select('*').order('name')
            if (data) setProducts(data)
          }}
        />
      )}
    </div>
  )
}
