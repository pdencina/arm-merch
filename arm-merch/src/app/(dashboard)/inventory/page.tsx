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

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, campus_id, campus:campus(name)')
        .eq('id', session.user.id)
        .single()

      const role  = profile?.role ?? 'voluntario'
      const cId   = profile?.campus_id ?? null
      const cName = (profile?.campus as any)?.name ?? null

      setUserRole(role)
      setCampusId(cId)
      setCampusName(cName)

      await loadInventory(cId, role)

      const { data: cats } = await supabase
        .from('categories').select('id, name').eq('active', true).order('name')
      setCategories(cats ?? [])
      setLoaded(true)
    }
    init()
  }, [])

  const loadInventory = useCallback(async (cId: string|null, role: string) => {
    const params = new URLSearchParams()
    // Admin y voluntario siempre filtran por su campus
    if (role !== 'super_admin' && cId) {
      params.set('campus_id', cId)
    }
    const res  = await fetch(`/api/inventory?${params}`)
    const data = await res.json()
    if (data.products) setProducts(data.products)
  }, [])

  const handleReload = useCallback(async () => {
    await loadInventory(campusId, userRole)
  }, [campusId, userRole, loadInventory])

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
