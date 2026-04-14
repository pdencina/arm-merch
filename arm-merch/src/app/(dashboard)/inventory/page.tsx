'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import InventoryClient from './inventory-client'

export default function InventoryPage() {
  const [products, setProducts]     = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [userRole, setUserRole]     = useState('')
  const [campusId, setCampusId]     = useState<string|null>(null)
  const [campusName, setCampusName] = useState<string|null>(null)
  const [loaded, setLoaded]         = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, campus_id, campus:campus(id, name)')
      .eq('id', session.user.id)
      .single()

    const role  = profile?.role ?? 'voluntario'
    const cId   = profile?.campus_id ?? null
    const cName = (profile?.campus as any)?.name ?? null

    setUserRole(role)
    setCampusId(cId)
    setCampusName(cName)

    // Cargar directamente desde inventory JOIN products — sin usar la vista
    // Filtrar por campus del usuario si no es super_admin
    let query = supabase
      .from('inventory')
      .select(`
        id,
        stock,
        low_stock_alert,
        campus_id,
        product:products!inner(
          id, name, description, price, sku, active, image_url, category_id,
          category:categories(name)
        ),
        campus:campus(name)
      `)
      .eq('product.active', true)
      .order('product(name)')

    if (role !== 'super_admin' && cId) {
      query = query.eq('campus_id', cId)
    }

    const [{ data: inv }, { data: cats }] = await Promise.all([
      query,
      supabase.from('categories').select('id, name').eq('active', true).order('name'),
    ])

    // Aplanar para que tenga la misma forma que products_with_stock
    const flat = (inv ?? []).map((row: any) => ({
      inventory_id:    row.id,           // ID exacto del registro inventory
      id:              row.product.id,
      name:            row.product.name,
      description:     row.product.description,
      price:           row.product.price,
      sku:             row.product.sku,
      active:          row.product.active,
      image_url:       row.product.image_url,
      category_id:     row.product.category_id,
      category_name:   row.product.category?.name ?? null,
      stock:           row.stock,
      low_stock_alert: row.low_stock_alert,
      campus_id:       row.campus_id,
      campus_name:     row.campus?.name ?? null,
      low_stock:       row.stock <= row.low_stock_alert,
    }))

    setProducts(flat)
    setCategories(cats ?? [])
    setLoaded(true)
  }

  if (!loaded) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <InventoryClient
      initialProducts={products}
      categories={categories}
      userRole={userRole}
      userCampusId={campusId}
      userCampusName={campusName}
      onReload={loadAll}
    />
  )
}
