'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function startOfTodayLocal() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfMonthLocal() {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

type CampusRow = {
  id: string
  name: string
}

export default function DashboardPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [role, setRole] = useState<string>('')
  const [orders, setOrders] = useState<any[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [orderItems, setOrderItems] = useState<any[]>([])
  const [campuses, setCampuses] = useState<CampusRow[]>([])

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true)
      setError(null)

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        setError('No autenticado')
        setLoading(false)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, campus_id')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile) {
        setError(profileError?.message ?? 'No se pudo cargar el perfil')
        setLoading(false)
        return
      }

      setRole(profile.role ?? '')

      let ordersQuery = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          payment_method,
          subtotal,
          discount,
          total,
          created_at,
          campus_id
        `)
        .order('created_at', { ascending: false })

      let inventoryQuery = supabase
        .from('inventory')
        .select(`
          id,
          stock,
          low_stock_alert,
          campus_id,
          product:products(
            id,
            name
          )
        `)

      let orderItemsQuery = supabase
        .from('order_items')
        .select(`
          id,
          order_id,
          product_id,
          quantity,
          unit_price,
          subtotal,
          order:orders(
            id,
            created_at,
            campus_id
          ),
          product:products(
            id,
            name
          )
        `)

      if (profile.role !== 'super_admin' && profile.campus_id) {
        ordersQuery = ordersQuery.eq('campus_id', profile.campus_id)
        inventoryQuery = inventoryQuery.eq('campus_id', profile.campus_id)
      }

      const [
        { data: ordersData, error: ordersError },
        { data: inventoryData, error: inventoryError },
        { data: orderItemsData, error: orderItemsError },
        { data: campusData, error: campusError },
      ] = await Promise.all([
        ordersQuery,
        inventoryQuery,
        orderItemsQuery,
        supabase.from('campus').select('id, name').eq('active', true).order('name'),
      ])

      if (ordersError) {
        setError(ordersError.message)
        setLoading(false)
        return
      }

      if (inventoryError) {
        setError(inventoryError.message)
        setLoading(false)
        return
      }

      if (orderItemsError) {
        setError(orderItemsError.message)
        setLoading(false)
        return
      }

      if (campusError) {
        setError(campusError.message)
        setLoading(false)
        return
      }

      const safeOrderItems = (orderItemsData ?? []).filter((item: any) => {
        if (profile.role === 'super_admin') return true

        const orderRaw = item.order
        const orderCampusId = Array.isArray(orderRaw)
          ? orderRaw[0]?.campus_id
          : orderRaw?.campus_id

        return orderCampusId === profile.campus_id
      })

      setOrders(ordersData ?? [])
      setInventory(inventoryData ?? [])
      setOrderItems(safeOrderItems)
      setCampuses((campusData ?? []) as CampusRow[])
      setLoading(false)
    }

    loadDashboard()
  }, [supabase])

  const campusMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const campus of campuses) {
      map.set(campus.id, campus.name)
    }
    return map
  }, [campuses])

  const metrics = useMemo(() => {
    const now = new Date()
    const todayStart = startOfTodayLocal()
    const monthStart = startOfMonthLocal()

    const ordersToday = orders.filter((o) => new Date(o.created_at) >= todayStart)
    const ordersMonth = orders.filter((o) => new Date(o.created_at) >= monthStart)

    const totalToday = ordersToday.reduce((sum, o) => sum + Number(o.total ?? 0), 0)
    const totalMonth = ordersMonth.reduce((sum, o) => sum + Number(o.total ?? 0), 0)

    const avgTicket = ordersMonth.length > 0 ? totalMonth / ordersMonth.length : 0

    const criticalStock = inventory.filter((item) => {
      const stock = Number(item.stock ?? 0)
      const low = Number(item.low_stock_alert ?? 5)
      return stock === 0 || stock <= low
    }).length

    const paymentMethodMap = new Map<string, number>()
    for (const order of ordersMonth) {
      const method = order.payment_method || 'Sin definir'
      paymentMethodMap.set(method, (paymentMethodMap.get(method) || 0) + Number(order.total ?? 0))
    }

    const paymentMethods = Array.from(paymentMethodMap.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)

    const last6Months: { label: string; total: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = monthKey(d)
      const total = orders
        .filter((o) => monthKey(new Date(o.created_at)) === key)
        .reduce((sum, o) => sum + Number(o.total ?? 0), 0)

      last6Months.push({
        label: MONTH_LABELS[d.getMonth()],
        total,
      })
    }

    const weekdays = WEEKDAY_LABELS.map((label) => ({
      label,
      total: 0,
    }))

    for (const order of ordersMonth) {
      const day = new Date(order.created_at).getDay()
      weekdays[day].total += Number(order.total ?? 0)
    }

    const campusSalesMap = new Map<string, number>()
    if (role === 'super_admin') {
      for (const order of ordersMonth) {
        const campusName = campusMap.get(order.campus_id) || 'Sin campus'
        campusSalesMap.set(campusName, (campusSalesMap.get(campusName) || 0) + Number(order.total ?? 0))
      }
    }

    const campusComparison = Array.from(campusSalesMap.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)

    return {
      totalToday,
      totalMonth,
      avgTicket,
      criticalStock,
      ordersTodayCount: ordersToday.length,
      ordersMonthCount: ordersMonth.length,
      paymentMethods,
      last6Months,
      weekdays,
      campusComparison,
    }
  }, [orders, inventory, role, campusMap])

  const topSoldProducts = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; total: number }>()

    for (const item of orderItems) {
      const productRaw = item.product
      const productName = Array.isArray(productRaw)
        ? productRaw[0]?.name
        : productRaw?.name

      const key = item.product_id || productName || item.id
      const existing = map.get(key)

      if (existing) {
        existing.quantity += Number(item.quantity ?? 0)
        existing.total += Number(item.subtotal ?? 0)
      } else {
        map.set(key, {
          name: productName || 'Producto',
          quantity: Number(item.quantity ?? 0),
          total: Number(item.subtotal ?? 0),
        })
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
  }, [orderItems])

  const currentStockProducts = useMemo(() => {
    return inventory
      .map((item: any) => {
        const productRaw = item.product
        const productName = Array.isArray(productRaw)
          ? productRaw[0]?.name
          : productRaw?.name

        return {
          id: item.id,
          name: productName || 'Producto',
          stock: Number(item.stock ?? 0),
        }
      })
      .sort((a, b) => b.stock - a.stock)
      .slice(0, 5)
  }, [inventory])

  const maxMonth = Math.max(...metrics.last6Months.map((m) => m.total), 1)
  const maxWeekday = Math.max(...metrics.weekdays.map((d) => d.total), 1)
  const maxCampus = Math.max(...metrics.campusComparison.map((c) => c.total), 1)
  const totalPayments = metrics.paymentMethods.reduce((sum, p) => sum + p.total, 0)

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-6 text-red-200">
        <p className="text-sm font-medium">Error cargando dashboard</p>
        <p className="mt-2 text-sm text-red-300/80">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {role === 'super_admin' ? 'Vista global de todos los campus' : 'Vista de tu campus'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
          <p className="text-sm text-zinc-500">Ventas hoy</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {formatCurrency(metrics.totalToday)}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            {metrics.ordersTodayCount} órdenes
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
          <p className="text-sm text-zinc-500">Mes actual</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {formatCurrency(metrics.totalMonth)}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            {metrics.ordersMonthCount} órdenes
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
          <p className="text-sm text-zinc-500">Stock crítico</p>
          <p className="mt-2 text-3xl font-bold text-orange-400">
            {metrics.criticalStock}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            entre sin stock y stock bajo
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
          <p className="text-sm text-zinc-500">Ticket promedio mes</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {formatCurrency(metrics.avgTicket)}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            basado en ventas del mes
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
          <h2 className="text-lg font-semibold text-white">Tendencia de ventas</h2>
          <p className="mt-1 text-sm text-zinc-500">Últimos 6 meses</p>

          <div className="mt-6 flex h-64 items-end gap-4">
            {metrics.last6Months.map((month) => {
              const height = Math.max((month.total / maxMonth) * 220, 6)

              return (
                <div key={month.label} className="flex flex-1 flex-col items-center gap-3">
                  <div
                    className="w-full rounded-t-xl bg-amber-500/80"
                    style={{ height: `${height}px` }}
                    title={`${month.label}: ${formatCurrency(month.total)}`}
                  />
                  <div className="text-xs text-zinc-500">{month.label}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
          <h2 className="text-lg font-semibold text-white">Métodos de pago</h2>
          <p className="mt-1 text-sm text-zinc-500">Mes actual</p>

          <div className="mt-6 space-y-4">
            {metrics.paymentMethods.length === 0 ? (
              <p className="text-sm text-zinc-500">Sin ventas este mes.</p>
            ) : (
              metrics.paymentMethods.map((item) => {
                const percent =
                  totalPayments > 0 ? (item.total / totalPayments) * 100 : 0

                return (
                  <div key={item.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-300">{item.name}</span>
                      <span className="text-white">{formatCurrency(item.total)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zinc-800">
                      <div
                        className="h-2 rounded-full bg-amber-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      {percent.toFixed(1)}% del total del mes
                    </p>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
          <h2 className="text-lg font-semibold text-white">Ventas por día</h2>
          <p className="mt-1 text-sm text-zinc-500">Distribución semanal del mes actual</p>

          <div className="mt-6 space-y-4">
            {metrics.weekdays.map((day) => {
              const width = maxWeekday > 0 ? (day.total / maxWeekday) * 100 : 0

              return (
                <div key={day.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300">{day.label}</span>
                    <span className="text-white">{formatCurrency(day.total)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-800">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {role === 'super_admin' ? (
          <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
            <h2 className="text-lg font-semibold text-white">Comparación por campus</h2>
            <p className="mt-1 text-sm text-zinc-500">Ventas del mes actual</p>

            <div className="mt-6 space-y-4">
              {metrics.campusComparison.length === 0 ? (
                <p className="text-sm text-zinc-500">Sin ventas este mes.</p>
              ) : (
                metrics.campusComparison.map((campus) => {
                  const width = maxCampus > 0 ? (campus.total / maxCampus) * 100 : 0

                  return (
                    <div key={campus.name} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-300">{campus.name}</span>
                        <span className="text-white">{formatCurrency(campus.total)}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-zinc-800">
                        <div
                          className="h-2 rounded-full bg-purple-500"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
            <h2 className="text-lg font-semibold text-white">Resumen operativo</h2>
            <p className="mt-1 text-sm text-zinc-500">Estado actual de tu campus</p>

            <div className="mt-6 grid gap-3">
              <div className="rounded-xl bg-zinc-950/50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                  Órdenes del mes
                </p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {metrics.ordersMonthCount}
                </p>
              </div>

              <div className="rounded-xl bg-zinc-950/50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                  Ventas del mes
                </p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {formatCurrency(metrics.totalMonth)}
                </p>
              </div>

              <div className="rounded-xl bg-zinc-950/50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                  Stock crítico
                </p>
                <p className="mt-1 text-lg font-semibold text-orange-400">
                  {metrics.criticalStock}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
          <h2 className="text-lg font-semibold text-white">Top productos vendidos</h2>
          <p className="mt-1 text-sm text-zinc-500">Según unidades vendidas</p>

          <div className="mt-5 space-y-3">
            {topSoldProducts.length === 0 ? (
              <p className="text-sm text-zinc-500">No hay ventas para mostrar.</p>
            ) : (
              topSoldProducts.map((product, index) => (
                <div
                  key={`${product.name}-${index}`}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{product.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">Ranking #{index + 1}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-300">
                      {product.quantity} uds.
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatCurrency(product.total)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
          <h2 className="text-lg font-semibold text-white">Top por stock actual</h2>
          <p className="mt-1 text-sm text-zinc-500">Disponibilidad actual</p>

          <div className="mt-5 space-y-3">
            {currentStockProducts.length === 0 ? (
              <p className="text-sm text-zinc-500">No hay productos para mostrar.</p>
            ) : (
              currentStockProducts.map((product, index) => (
                <div
                  key={`${product.id}-${index}`}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{product.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">Ranking #{index + 1}</p>
                  </div>

                  <span className="rounded-lg bg-green-500/10 px-3 py-1 text-sm font-semibold text-green-300">
                    Stock {product.stock}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}