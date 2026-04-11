'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, MapPin } from 'lucide-react'
import ProductTable from '@/components/inventory/product-table'
import MovementForm from '@/components/inventory/movement-form'
import LowStockAlert from '@/components/inventory/low-stock-alert'

interface Props {
  initialProducts: any[]
  categories: { id: string; name: string }[]
  userRole?: string
  userCampusId?: string | null
  userCampusName?: string | null
}

export default function InventoryClient({ initialProducts, categories, userRole, userCampusId, userCampusName }: Props) {
  const [products, setProducts]       = useState<any[]>(initialProducts)
  const [campus, setCampus]           = useState<any[]>([])
  const [search, setSearch]           = useState('')
  const [filterCategory, setFilterCat] = useState('')
  const [filterCampus, setFilterCampus] = useState(
    // Admin ve solo su campus por defecto — no puede cambiarlo
    userRole !== 'super_admin' && userCampusId ? userCampusId : ''
  )
  const [filterStock, setFilterStock] = useState<'all'|'low'|'out'>('all')
  const [movementProduct, setMovProd] = useState<any|null>(null)
  const supabase = createClient()
  const isSuperAdmin = userRole === 'super_admin'

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('campus').select('id, name').eq('active', true).order('name')
        .then(({ data }) => setCampus(data ?? []))
    }
  }, [isSuperAdmin])

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('inventory-realtime')
      .on('postgres_changes', { event:'*', schema:'public', table:'inventory' }, async () => {
        let query = supabase.from('products_with_stock').select('*').order('name')
        if (!isSuperAdmin && userCampusId) query = query.eq('campus_id', userCampusId)
        const { data } = await query
        if (data) setProducts(data)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [isSuperAdmin, userCampusId])

  const filtered = products.filter(p => {
    const matchSearch  = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku ?? '').toLowerCase().includes(search.toLowerCase())
    const matchCat     = !filterCategory || p.category_id === filterCategory
    const matchCampus  = !filterCampus || p.campus_id === filterCampus
    const matchStock   = filterStock === 'all' ? true : filterStock === 'out' ? (p.stock ?? 0) === 0 : (p.stock ?? 0) > 0 && (p.stock ?? 0) <= (p.low_stock_alert ?? 5)
    return matchSearch && matchCat && matchCampus && matchStock
  })

  const lowStock  = products.filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= (p.low_stock_alert ?? 5))
  const outStock  = products.filter(p => (p.stock ?? 0) === 0)
  const totalVal  = products.reduce((s, p) => s + p.price * (p.stock ?? 0), 0)
  const fmt = (n: number) => new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(n)

  return (
    <div className="flex flex-col gap-5">
      {/* Header con campus del admin */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Inventario</h1>
          {userCampusName && !isSuperAdmin ? (
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin size={11} className="text-amber-400" />
              <span className="text-xs text-amber-400 font-medium">{userCampusName}</span>
              <span className="text-xs text-zinc-600">· Stock de tu campus</span>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 mt-0.5">Gestión de stock global</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label:'Total productos',  value:products.length.toString(), color:'text-white' },
          { label:'Valor inventario', value:fmt(totalVal),              color:'text-amber-400' },
          { label:'Stock bajo',       value:lowStock.length.toString(), color:'text-orange-400' },
          { label:'Sin stock',        value:outStock.length.toString(), color:'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/40">
            <p className="text-xs text-zinc-500 mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {(lowStock.length > 0 || outStock.length > 0) && (
        <LowStockAlert lowStock={lowStock} outOfStock={outStock} onAdjust={p => setMovProd(p)} />
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto o SKU..."
            className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600
                       rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition" />
        </div>
        <select value={filterCategory} onChange={e => setFilterCat(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition">
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {/* Filtro campus — SOLO Super Admin */}
        {isSuperAdmin && (
          <select value={filterCampus} onChange={e => setFilterCampus(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition">
            <option value="">Todos los campus</option>
            {campus.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        <select value={filterStock} onChange={e => setFilterStock(e.target.value as any)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition">
          <option value="all">Todo el stock</option>
          <option value="low">Stock bajo</option>
          <option value="out">Sin stock</option>
        </select>
      </div>

      <ProductTable products={filtered} campus={isSuperAdmin ? campus : []} onMovement={p => setMovProd(p)} />

      {movementProduct && (
        <MovementForm
          product={movementProduct}
          campus={isSuperAdmin ? campus : []}
          onClose={() => setMovProd(null)}
          onSuccess={async () => {
            setMovProd(null)
            let query = supabase.from('products_with_stock').select('*').order('name')
            if (!isSuperAdmin && userCampusId) query = query.eq('campus_id', userCampusId)
            const { data } = await query
            if (data) setProducts(data)
          }}
        />
      )}
    </div>
  )
}
