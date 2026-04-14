'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import InventoryClient from './inventory-client'

type Category = {
  id: string
  name: string
}

type ProductRow = {
  id: string
  name: string
  description?: string | null
  price: number
  sku?: string | null
  category_id?: string | null
  image_url?: string | null
  active?: boolean
  created_at?: string
  updated_at?: string
  inventory_id?: string
  stock?: number
  low_stock_alert?: number
  updated_by?: string | null
  campus_id?: string | null
  low_stock?: boolean
  category?: {
    id: string
    name: string
  } | null
}

export default function InventoryPage() {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [userRole, setUserRole] = useState('')
  const [campusId, setCampusId] = useState<string | null>(null)
  const [campusName, setCampusName] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadInventory = useCallback(async (currentCampusId: string | null, role: string) => {
    const supabase = createClient()

    let inventoryQuery = supabase
      .from('inventory')
      .select(`
        id,
        product_id,
        stock,
        low_stock_alert,
        updated_at,
        updated_by,
        campus_id,
        product:products(
          id,
          name,
          description,
          price,
          sku,
          category_id,
          image_url,
          active,
          created_at,
          updated_at,
          category:categories(
            id,
            name
          )
        )
      `)
      .order('updated_at', { ascending: false })

    if (role !== 'super_admin' && currentCampusId) {
      inventoryQuery = inventoryQuery.eq('campus_id', currentCampusId)
    }

    if (role !== 'super_admin' && !currentCampusId) {
      setProducts([])
      return
    }

    const { data, error } = await inventoryQuery

    if (error) {
      setError(error.message)
      setProducts([])
      return
    }

    const mapped: ProductRow[] = (data ?? []).map((row: any) => {
      const product = row.product ?? {}

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: Number(product.price ?? 0),
        sku: product.sku,
        category_id: product.category_id,
        image_url: product.image_url,
        active: product.active,
        created_at: product.created_at,
        updated_at: product.updated_at,
        inventory_id: row.id,
        stock: row.stock ?? 0,
        low_stock_alert: row.low_stock_alert ?? 5,
        updated_by: row.updated_by,
        campus_id: row.campus_id,
        low_stock: (row.stock ?? 0) > 0 && (row.stock ?? 0) <= (row.low_stock_alert ?? 5),
        category: product.category
          ? {
              id: product.category.id,
              name: product.category.name,
            }
          : null,
      }
    })

    setProducts(mapped)
  }, [])

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      try {
        setLoaded(false)
        setError(null)

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          setError(sessionError.message)
          setLoaded(true)
          return
        }

        if (!session) {
          setError('No hay sesión activa')
          setLoaded(true)
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, campus_id, campus:campus(name)')
          .eq('id', session.user.id)
          .single()

        if (profileError) {
          setError(profileError.message)
          setLoaded(true)
          return
        }

        const role = profile?.role ?? 'voluntario'
        const currentCampusId = profile?.campus_id ?? null
        const currentCampusName = (profile?.campus as any)?.name ?? null

        setUserRole(role)
        setCampusId(currentCampusId)
        setCampusName(currentCampusName)

        await loadInventory(currentCampusId, role)

        const { data: cats, error: catsError } = await supabase
          .from('categories')
          .select('id, name')
          .eq('active', true)
          .order('name')

        if (catsError) {
          setError(catsError.message)
        } else {
          setCategories((cats ?? []) as Category[])
        }
      } catch (err: any) {
        setError(err?.message ?? 'Error cargando inventario')
      } finally {
        setLoaded(true)
      }
    }

    init()
  }, [loadInventory])

  const handleReload = useCallback(async () => {
    setError(null)
    await loadInventory(campusId, userRole)
  }, [campusId, userRole, loadInventory])

  if (!loaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-6 text-red-200">
        <p className="text-sm font-medium">Error cargando inventario</p>
        <p className="mt-2 text-sm text-red-300/80">{error}</p>
      </div>
    )
  }

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