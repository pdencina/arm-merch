'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import InventoryClient from './inventory-client'

export default function InventoryPage() {
  const [products, setProducts]     = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [userRole, setUserRole]     = useState('')
  const [campusId, setCampusId]     = useState<string|null>(null)
  const [campusName, setCampusName] = useState<string|null>(null)
  const [loaded, setLoaded]         = useState(false)

  const loadProducts = useCallback(async (cId: string|null, role: string) => {
    const supabase = createClient()

    // Obtener todos los productos activos
    const { data: allProducts } = await supabase
      .from('products')
      .select('id, name, description, price, sku, active, image_url, category_id, category:categories(name)')
      .eq('active', true)
      .order('name')

    if (!allProducts) return []

    // Obtener inventario filtrado por campus
    let invQuery = supabase
      .from('inventory')
      .select('id, product_id, stock, low_stock_alert, campus_id, campus:campus(name)')

    if (role !== 'super_admin' && cId) {
      invQuery = invQuery.eq('campus_id', cId)
    }

    const { data: inventory } = await invQuery

    // Combinar manualmente
    const invMap: Record<string, any> = {}
    ;(inventory ?? []).forEach((i: any) => {
      // Si hay múltiples por producto, tomar el del campus correcto
      if (!invMap[i.product_id] || i.campus_id === cId) {
        invMap[i.product_id] = i
      }
    })

    return allProducts.map((p: any) => {
      const inv = invMap[p.id]
      return {
        inventory_id:    inv?.id ?? null,
        id:              p.id,
        name:            p.name,
        description:     p.description,
        price:           p.price,
        sku:             p.sku,
        active:          p.active,
        image_url:       p.image_url,
        category_id:     p.category_id,
        category_name:   p.category?.name ?? null,
        stock:           inv?.stock ?? 0,
        low_stock_alert: inv?.low_stock_alert ?? 5,
        campus_id:       inv?.campus_id ?? null,
        campus_name:     inv?.campus?.name ?? null,
        low_stock:       (inv?.stock ?? 0) <= (inv?.low_stock_alert ?? 5),
      }
    })
  }, [])

  useEffect(() => {
    const supabase = createClient()
    async function init() {
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

      const [prods, { data: cats }] = await Promise.all([
        loadProducts(cId, role),
        supabase.from('categories').select('id, name').eq('active', true).order('name'),
      ])

      setProducts(prods)
      setCategories(cats ?? [])
      setLoaded(true)
    }
    init()
  }, [loadProducts])

  const handleReload = useCallback(async () => {
    const prods = await loadProducts(campusId, userRole)
    setProducts(prods)
  }, [campusId, userRole, loadProducts])

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
      onReload={handleReload}
    />
  )
}
