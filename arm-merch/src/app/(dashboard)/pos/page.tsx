'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ProductGrid from '@/components/pos/product-grid'
import Cart from '@/components/pos/cart'

export default function POSPage() {
  const [products, setProducts]     = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [campusName, setCampusName] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile } = await supabase
        .from('profiles').select('role, campus_id, campus:campus(name)')
        .eq('id', session.user.id).single()

      const role     = profile?.role ?? 'voluntario'
      const campusId = profile?.campus_id ?? null
      const cName    = (profile?.campus as any)?.name ?? null
      setCampusName(cName)

      let query = supabase
        .from('products_with_stock')
        .select('*')
        .eq('active', true)
        .gt('stock', 0)
        .order('name')

      // Voluntario y Admin → solo productos de su campus
      // Super Admin → ve todos (puede vender de cualquier campus)
      if (role !== 'super_admin' && campusId) {
        query = query.eq('campus_id', campusId)
      }

      const [{ data: p }, { data: c }] = await Promise.all([
        query,
        supabase.from('categories').select('id, name').eq('active', true).order('name'),
      ])

      setProducts(p ?? [])
      setCategories(c ?? [])
    }
    load()
  }, [])

  return (
    <div className="flex flex-col h-full -m-5">
      {campusName && (
        <div className="flex items-center gap-2 px-5 py-2 bg-zinc-900 border-b border-zinc-800/60 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span className="text-xs text-zinc-400">
            Punto de Venta — <span className="text-amber-400 font-medium">{campusName}</span>
          </span>
          <span className="text-xs text-zinc-600">· {products.length} productos disponibles</span>
        </div>
      )}
      <div className="flex flex-1 gap-0 overflow-hidden">
        <ProductGrid products={products} categories={categories} />
        <Cart />
      </div>
    </div>
  )
}
