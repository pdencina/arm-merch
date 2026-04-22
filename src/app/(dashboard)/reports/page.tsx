'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ReportsClient from './reports-client'

export default function ReportsPage() {
  const [orders, setOrders]         = useState<any[]>([])
  const [products, setProducts]     = useState<any[]>([])
  const [sellers, setSellers]       = useState<any[]>([])
  const [campusName, setCampusName] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, campus_id, campus:campus(name)')
        .eq('id', session.user.id)
        .single()

      const role     = profile?.role ?? 'voluntario'
      const campusId = profile?.campus_id ?? null
      setCampusName((profile?.campus as any)?.name ?? null)

      // Buscar órdenes con todos los valores de status posibles:
      // 'paid' = nuevo (orders/route.ts actualizado)
      // 'completada' = registros anteriores del sistema original
      let ordersQuery = supabase
        .from('orders')
        .select(`
          id, order_number, total, discount, status, payment_method, created_at, seller_id, notes,
          seller:profiles(full_name, campus_id),
          order_contacts(client_name, client_email),
          order_items(quantity, unit_price, product:products(name))
        `)
        .in('status', ['paid', 'pending'])
        .order('created_at', { ascending: false })

      if (role === 'voluntario') {
        ordersQuery = ordersQuery.eq('seller_id', session.user.id)
      }

      let productsQuery = supabase
        .from('products_with_stock')
        .select('*')
        .order('name')

      if (role !== 'super_admin' && campusId) {
        productsQuery = productsQuery.eq('campus_id', campusId)
      }

      let sellersQuery = supabase
        .from('profiles')
        .select('id, full_name')
        .eq('active', true)

      if (role !== 'super_admin' && campusId) {
        sellersQuery = sellersQuery.eq('campus_id', campusId)
      }

      const [{ data: o }, { data: p }, { data: s }] = await Promise.all([
        ordersQuery,
        productsQuery,
        sellersQuery,
      ])

      // Admin filtra órdenes por campus de sus vendedores
      let filteredOrders = o ?? []
      if (role === 'admin' && campusId) {
        filteredOrders = filteredOrders.filter(
          (order: any) => order.seller?.campus_id === campusId
        )
      }

      setOrders(filteredOrders)
      setProducts(p ?? [])
      setSellers(s ?? [])
    }

    load()
  }, [])

  return (
    <ReportsClient
      orders={orders}
      products={products}
      sellers={sellers}
      campusName={campusName}
    />
  )
}
