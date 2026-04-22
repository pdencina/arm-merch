'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ProductGrid from '@/components/pos/product-grid'
import Cart from '@/components/pos/cart'

export default function POSPage() {
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [campusName, setCampusName] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, campus_id, campus:campus(name)')
        .eq('id', session.user.id)
        .single()

      const campusId = profile?.campus_id ?? null
      const cName = (profile?.campus as any)?.name ?? null
      setCampusName(cName)

      let query = supabase
        .from('products_with_stock')
        .select('*')
        .eq('active', true)
        .gt('stock', 0)
        .order('name')

      if (campusId) {
        query = query.eq('campus_id', campusId)
      } else {
        query = query.eq('campus_id', '__none__')
      }

      const [{ data: p }, { data: c }] = await Promise.all([
        query,
        supabase
          .from('categories')
          .select('id, name')
          .eq('active', true)
          .order('name'),
      ])

      setProducts(p ?? [])
      setCategories(c ?? [])
    }

    load()
  }, [])

  return (
    <div className="flex h-[calc(100vh-70px)] flex-col bg-black">
      {campusName && (
        <div className="shrink-0 border-b border-zinc-800 px-5 py-3">
          <div className="flex items-center gap-2 text-sm">
            <div className="h-2 w-2 rounded-full bg-slate-400" />
            <span className="text-zinc-400">Punto de Venta —</span>
            <span className="font-semibold text-slate-300">{campusName}</span>
            <span className="text-zinc-600">· {products.length} productos</span>
          </div>
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 xl:grid-cols-[1fr_380px]">
        <div className="min-h-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
          <ProductGrid products={products} categories={categories} />
        </div>

        <div className="min-h-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
          <Cart />
        </div>
      </div>
    </div>
  )
}