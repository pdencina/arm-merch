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

      // PERFIL
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

      // ÓRDENES
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
        .eq('status', 'paid')
        .order('created_at', { ascending: false })

      // VOLUNTARIO SOLO VE SUS VENTAS
      if (role === 'voluntario') {
        ordersQuery = ordersQuery.eq('seller_id', session.user.id)
      }

      const { data: ordersData, error: ordersError } = await ordersQuery

      console.log('ORDERS ERROR:', ordersError)
      console.log('ORDERS DATA:', ordersData)

      // SELLERS IDS
      const sellerIds = Array.from(
        new Set(
          (ordersData ?? [])
            .map((order: any) => order.seller_id)
            .filter(Boolean)
        )
      )

      // OBTENER VENDEDORES
      const { data: sellerProfiles } =
        sellerIds.length > 0
          ? await supabase
              .from('profiles')
              .select('id, full_name, campus_id')
              .in('id', sellerIds)
          : { data: [] }

      // MAPA SELLERS
      const sellerMap = Object.fromEntries(
        (sellerProfiles ?? []).map((seller: any) => [
          seller.id,
          seller,
        ])
      )

      // ENRIQUECER ÓRDENES
      const enrichedOrders = (ordersData ?? []).map((order: any) => ({
        ...order,
        seller: sellerMap[order.seller_id] ?? null,
      }))

      // FILTRO CAMPUS ADMIN
      let filteredOrders = enrichedOrders

      if (role === 'admin' && campusId) {
        filteredOrders = enrichedOrders.filter(
          (order: any) =>
            order.seller?.campus_id === campusId
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