'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ProductGrid from '@/components/pos/product-grid'
import Cart from '@/components/pos/cart'

export default function POSPage() {
  const [products, setProducts]     = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [userCampus, setUserCampus] = useState<string | null>(null)
  const [userRole, setUserRole]     = useState<string>('voluntario')

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
      setUserRole(role)
      setUserCampus(campusId)

      // Super admin y admin ven todos los productos
      // Voluntario ve solo los de su campus (si tiene asignado)
      let query = supabase.from('products_with_stock')
        .select('*').eq('active', true).gt('stock', 0).order('name')

      if (role === 'voluntario' && campusId) {
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
    <div className="flex h-full gap-0 -m-6">
      <ProductGrid products={products} categories={categories} />
      <Cart />
    </div>
  )
}
