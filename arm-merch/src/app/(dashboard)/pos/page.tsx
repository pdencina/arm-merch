'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/lib/hooks/use-cart'
import ProductGrid from '@/components/pos/product-grid'
import Cart from '@/components/pos/cart'
import type { Product } from '@/types'

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [filtered, setFiltered] = useState<Product[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [{ data: prods }, { data: cats }] = await Promise.all([
        supabase.from('products_with_stock').select('*').order('name'),
        supabase.from('categories').select('id, name').eq('active', true).order('name'),
      ])
      setProducts(prods ?? [])
      setFiltered(prods ?? [])
      setCategories(cats ?? [])
      setLoading(false)
    }

    load()

    // Realtime: actualiza stock en tiempo real
    const channel = supabase
      .channel('inventory-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        load()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    let result = products
    if (activeCategory) {
      result = result.filter(p => p.category_id === activeCategory)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q)
      )
    }
    setFiltered(result)
  }, [products, activeCategory, search])

  return (
    <div className="flex h-full gap-0 -m-6 overflow-hidden">
      {/* Panel izquierdo: productos */}
      <div className="flex flex-col flex-1 p-5 gap-4 overflow-hidden bg-zinc-950">

        {/* Searchbar + categorías */}
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Buscar por nombre o SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600
                       rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500
                       focus:ring-1 focus:ring-amber-500 transition"
          />
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setActiveCategory(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                !activeCategory
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
              }`}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  activeCategory === cat.id
                    ? 'bg-amber-500 text-zinc-950'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Grid de productos */}
        <ProductGrid products={filtered} loading={loading} />
      </div>

      {/* Panel derecho: carrito */}
      <Cart />
    </div>
  )
}
