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
    <div className="flex h-full flex-col -m-5 bg-black">
      {campusName && (
        <div className="shrink-0 border-b border-zinc-800/70 bg-zinc-950/80 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-2 text-sm">
            <div className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-zinc-400">Punto de Venta —</span>
            <span className="font-semibold text-amber-400">{campusName}</span>
            <span className="text-zinc-600">· {products.length} productos disponibles</span>
          </div>
        </div>
      )}

      <div className="flex flex-1 gap-4 overflow-hidden p-4 xl:gap-5 xl:p-5">
        <div className="min-w-0 flex-1 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/60">
          <ProductGrid products={products} categories={categories} />
        </div>

        <div className="w-[360px] shrink-0 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/80 xl:w-[380px]">
          <Cart />
        </div>
      </div>
    </div>
  )
}