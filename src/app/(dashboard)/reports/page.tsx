'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ReportsClient from './reports-client'

export default function ReportsPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [sellers, setSellers] = useState<any[]>([])
  const [campusName, setCampusName] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) return

      // PERFIL USUARIO
      const { data: profile } = await supabase
        .from('profiles')
        .select(`
          role,
          campus_id,
          campus:campus(name)
        `)
        .eq('id', session.user.id)
        .single()

      const role = profile?.role ?? 'voluntario'
      const campusId = profile?.campus_id ?? null

      setCampusName((profile?.campus as any)?.name ?? null)

      // QUERY ÓRDENES
      let ordersQuery = supabase
        .from('orders')
        .select(`
          *,
          order_contacts(*),
          order_items(
            *,
            product:products(*)
          )
        `)
        .in('status', [
          'paid',
          'pending',
          'completed',
          'delivered',
          'completada',
          'entregada',
        ])
        .order('created_at', { ascending: false })

      if (role === 'voluntario') {
        ordersQuery = ordersQuery.eq('seller_id', session.user.id)
      }

      const { data: ordersData } = await ordersQuery

      // OBTENER VENDEDORES MANUALMENTE
      // Evita usar spread sobre Set para compatibilidad con el target TS del proyecto.
      const sellerIds = Array.from(
        new Set(
          (ordersData ?? [])
            .map((order: any) => order.seller_id)
            .filter(Boolean)
        )
      )

      const { data: sellerProfiles } =
        sellerIds.length > 0
          ? await supabase
              .from('profiles')
              .select('id, full_name, campus_id')
              .in('id', sellerIds)
          : { data: [] }

      const sellerMap = Object.fromEntries(
        (sellerProfiles ?? []).map((seller: any) => [seller.id, seller])
      )

      const enrichedOrders = (ordersData ?? []).map((order: any) => ({
        ...order,
        seller: sellerMap[order.seller_id] ?? null,
      }))

      // FILTRO ADMIN CAMPUS
      let filteredOrders = enrichedOrders

      if (role === 'admin' && campusId) {
        filteredOrders = enrichedOrders.filter(
          (order: any) => order.seller?.campus_id === campusId
        )
      }

      // PRODUCTOS
      let productsQuery = supabase
        .from('products_with_stock')
        .select('*')
        .order('name')

      if (role !== 'super_admin' && campusId) {
        productsQuery = productsQuery.eq('campus_id', campusId)
      }

      const { data: productsData } = await productsQuery

      // VENDEDORES
      let sellersQuery = supabase
        .from('profiles')
        .select('id, full_name')
        .eq('active', true)

      if (role !== 'super_admin' && campusId) {
        sellersQuery = sellersQuery.eq('campus_id', campusId)
      }

      const { data: sellersData } = await sellersQuery

      setOrders(filteredOrders ?? [])
      setProducts(productsData ?? [])
      setSellers(sellersData ?? [])
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
