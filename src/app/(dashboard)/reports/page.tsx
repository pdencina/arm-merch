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
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) return

        // PERFIL
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, campus_id')
          .eq('id', session.user.id)
          .single()

        const role = profile?.role ?? 'voluntario'
        const campusId = profile?.campus_id ?? null
        const hasGlobalAccess = role === 'super_admin' || role === 'adm_merch'

        // Nombre del campus (para roles locales)
        if (campusId && !hasGlobalAccess) {
          const { data: campusData } = await supabase
            .from('campus')
            .select('name')
            .eq('id', campusId)
            .maybeSingle()
          setCampusName(campusData?.name ?? null)
        } else {
          setCampusName(hasGlobalAccess ? 'Todos los campus' : null)
        }

        // ── ÓRDENES ──
        let ordersQuery = supabase
          .from('orders')
          .select('id, order_number, campus_id, seller_id, payment_method, total, discount, created_at, status, notes')
          .eq('status', 'paid')
          .order('created_at', { ascending: false })
          .limit(500)

        if (role === 'voluntario') {
          ordersQuery = ordersQuery.eq('seller_id', session.user.id)
        } else if (role === 'admin' && campusId) {
          ordersQuery = ordersQuery.eq('campus_id', campusId)
        }
        // adm_merch y super_admin ven todo (sin filtro)

        const { data: ordersData, error: ordersError } = await ordersQuery

        if (ordersError) {
          console.error('[Reports] Orders error:', ordersError.message)
          setOrders([])
          return
        }

        const safeOrders = ordersData ?? []

        // ── ITEMS (en batches para evitar límite del IN) ──
        const orderIds = safeOrders.map((o: any) => o.id)
        let allItems: any[] = []

        if (orderIds.length > 0) {
          // Supabase IN tiene limite, hacemos en batches de 100
          for (let i = 0; i < orderIds.length; i += 100) {
            const batch = orderIds.slice(i, i + 100)
            const { data: itemsBatch } = await supabase
              .from('order_items')
              .select('order_id, quantity, unit_price, product:products(id, name)')
              .in('order_id', batch)
            allItems = allItems.concat(itemsBatch ?? [])
          }
        }

        // ── CONTACTOS ──
        let allContacts: any[] = []
        if (orderIds.length > 0) {
          for (let i = 0; i < orderIds.length; i += 100) {
            const batch = orderIds.slice(i, i + 100)
            const { data: contactsBatch } = await supabase
              .from('order_contacts')
              .select('order_id, client_name, client_email, client_phone')
              .in('order_id', batch)
            allContacts = allContacts.concat(contactsBatch ?? [])
          }
        }

        // Enriquecer órdenes
        const contactsMap = Object.fromEntries(
          allContacts.map((c: any) => [c.order_id, c])
        )
        const itemsMap: Record<string, any[]> = {}
        allItems.forEach((item: any) => {
          if (!itemsMap[item.order_id]) itemsMap[item.order_id] = []
          itemsMap[item.order_id].push(item)
        })

        // ── SELLERS ──
        const sellerIds = Array.from(
          new Set(safeOrders.map((o: any) => o.seller_id).filter(Boolean))
        )

        let sellerMap: Record<string, any> = {}
        if (sellerIds.length > 0) {
          const { data: sellerProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, campus_id')
            .in('id', sellerIds as string[])
          ;(sellerProfiles ?? []).forEach((s: any) => {
            sellerMap[s.id] = s
          })
        }

        // Construir resultado final
        const enrichedOrders = safeOrders.map((order: any) => ({
          ...order,
          order_contacts: contactsMap[order.id] ? [contactsMap[order.id]] : [],
          order_items: itemsMap[order.id] ?? [],
          seller: sellerMap[order.seller_id] ?? null,
        }))

        setOrders(enrichedOrders)

        // ── PRODUCTOS (para top productos) ──
        let productsQuery = supabase
          .from('products_with_stock')
          .select('id, name, price, stock, campus_id')
          .order('name')

        if (!hasGlobalAccess && campusId) {
          productsQuery = productsQuery.eq('campus_id', campusId)
        }

        const { data: productsData } = await productsQuery
        setProducts(productsData ?? [])

        // ── VENDEDORES (para filtro) ──
        let sellersQuery = supabase
          .from('profiles')
          .select('id, full_name')
          .eq('active', true)

        if (!hasGlobalAccess && campusId) {
          sellersQuery = sellersQuery.eq('campus_id', campusId)
        }

        const { data: sellersData } = await sellersQuery
        setSellers(sellersData ?? [])

      } catch (err: any) {
        console.error('[Reports] Error loading:', err?.message)
      }
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
