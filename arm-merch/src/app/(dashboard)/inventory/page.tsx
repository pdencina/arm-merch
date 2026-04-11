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
    const supabase = createClient()
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile } = await supabase
        .from('profiles').select('role, campus_id, campus:campus(id, name)')
        .eq('id', session.user.id).single()

      const role = profile?.role ?? 'voluntario'
      const cId  = profile?.campus_id ?? null
      const cName = (profile?.campus as any)?.name ?? null

      setUserRole(role)
      setCampusId(cId)
      setCampusName(cName)

      let query = supabase.from('products_with_stock').select('*').order('name')

      // Admin y voluntario solo ven su campus
      if (role !== 'super_admin' && cId) {
        query = query.eq('campus_id', cId)
      }

      const [{ data: p }, { data: c }] = await Promise.all([
        query,
        supabase.from('categories').select('id, name').eq('active', true).order('name'),
      ])
      setProducts(p ?? [])
      setCategories(c ?? [])
      setLoaded(true)
    }
    load()
  }, [])

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
    />
  )
}
