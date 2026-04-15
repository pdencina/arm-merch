'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  TrendingUp,
  TrendingDown,
  Building2,
  CalendarDays,
  Clock3,
  ShoppingBag,
} from 'lucide-react'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function getStartOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatLongDate(value: Date) {
  return value.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(value: Date) {
  return value.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getGreeting(date: Date) {
  const hour = date.getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

type Campus = {
  id: string
  name: string
}

export default function DashboardPage() {
  const supabase = createClient()

  const [orders, setOrders] = useState<any[]>([])
  const [orderItems, setOrderItems] = useState<any[]>([])
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [role, setRole] = useState<string>('')
  const [userCampusId, setUserCampusId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date())
    }, 30000)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, campus_id')
        .eq('id', session.user.id)
        .single()

      const currentRole = profile?.role ?? ''
      const currentCampusId = profile?.campus_id ?? null

      setRole(currentRole)
      setUserCampusId(currentCampusId)

      let ordersQuery = supabase
        .from('orders')
        .select(`
          id,
          total,
          created_at,
          campus_id,
          payment_method
        `)
        .order('created_at', { ascending: false })

      let orderItemsQuery = supabase
        .from('order_items')
        .select(`
          quantity,
          subtotal,
          product:products(name),
          order:orders(
            id,
            campus_id,
            created_at
          )
        `)

      if (currentRole !== 'super_admin' && currentCampusId) {
        ordersQuery = ordersQuery.eq('campus_id', currentCampusId)
      }

      const [
        { data: ordersData },
        { data: orderItemsData },
        { data: campusesData },
      ] = await Promise.all([
        ordersQuery,
        orderItemsQuery,
        supabase.from('campus').select('id, name').eq('active', true).order('name'),
      ])

      const safeOrderItems = (orderItemsData ?? []).filter((item: any) => {
        if (currentRole === 'super_admin') return true
        const orderRaw = Array.isArray(item.order) ? item.order[0] : item.order
        return orderRaw?.campus_id === currentCampusId
      })

      setOrders(ordersData ?? [])
      setOrderItems(safeOrderItems)
      setCampuses((campusesData ?? []) as Campus[])
      setLoading(false)
    }

    load()
  }, [supabase])

  const campusMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const campus of campuses) {
      map.set(campus.id, campus.name)
    }
    return map
  }, [campuses])

  const metrics = useMemo(() => {
    const todayStart = getStartOfDay(now)

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(now.getDate() - 7)

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

    const todayOrders = orders.filter((o) => new Date(o.created_at) >= todayStart)
    const weekOrders = orders.filter((o) => new Date(o.created_at) >= sevenDaysAgo)
    const monthOrders = orders.filter((o) => new Date(o.created_at) >= monthStart)
    const lastMonthOrders = orders.filter((o) => {
      const d = new Date(o.created_at)
      return d >= lastMonthStart && d <= lastMonthEnd
    })

    const totalToday = todayOrders.reduce((s, o) => s + Number(o.total ?? 0), 0)
    const totalWeek = weekOrders.reduce((s, o) => s + Number(o.total ?? 0), 0)
    const totalMonth = monthOrders.reduce((s, o) => s + Number(o.total ?? 0), 0)
    const totalLastMonth = lastMonthOrders.reduce((s, o) => s + Number(o.total ?? 0), 0)

    const growth =
      totalLastMonth > 0
        ? ((totalMonth - totalLastMonth) / totalLastMonth) * 100
        : 0

    const avgTicket =
      monthOrders.length > 0 ? totalMonth / monthOrders.length : 0

    return {
      totalToday,
      totalWeek,
      totalMonth,
      totalLastMonth,
      growth,
      avgTicket,
      monthOrdersCount: monthOrders.length,
    }
  }, [orders, now])

  const dailyChart = useMemo(() => {
    const days: { label: string; total: number }[] = []

    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)

      const start = getStartOfDay(d)
      const end = new Date(start)
      end.setDate(end.getDate() + 1)

      const total = orders
        .filter((o) => {
          const date = new Date(o.created_at)
          return date >= start && date < end
        })
        .reduce((s, o) => s + Number(o.total ?? 0), 0)

      days.push({
        label: d.toLocaleDateString('es-CL', { weekday: 'short' }),
        total,
      })
    }

    return days
  }, [orders])

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; total: number }>()

    for (const item of orderItems) {
      const productRaw = Array.isArray(item.product) ? item.product[0] : item.product
      const name = productRaw?.name || 'Producto'

      if (!map.has(name)) {
        map.set(name, { name, qty: 0, total: 0 })
      }

      const current = map.get(name)!
      current.qty += Number(item.quantity ?? 0)
      current.total += Number(item.subtotal ?? 0)
    }

    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
  }, [orderItems])

  const campusSales = useMemo(() => {
    const map = new Map<string, { name: string; total: number; orders: number }>()

    for (const order of orders) {
      const campusName = campusMap.get(order.campus_id) || 'Sin campus'

      if (!map.has(order.campus_id)) {
        map.set(order.campus_id, {
          name: campusName,
          total: 0,
          orders: 0,
        })
      }

      const current = map.get(order.campus_id)!
      current.total += Number(order.total ?? 0)
      current.orders += 1
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [orders, campusMap])

  const paymentMethods = useMemo(() => {
    const map = new Map<string, number>()

    for (const order of orders) {
      const method = order.payment_method || 'Sin definir'
      map.set(method, (map.get(method) || 0) + Number(order.total ?? 0))
    }

    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
  }, [orders])

  const currentCampusSummary = useMemo(() => {
    if (!userCampusId) return null

    const campusName = campusMap.get(userCampusId) || 'Tu campus'
    const campusOrders = orders.filter((o) => o.campus_id === userCampusId)
    const total = campusOrders.reduce((sum, o) => sum + Number(o.total ?? 0), 0)

    return {
      name: campusName,
      total,
      orders: campusOrders.length,
      avg: campusOrders.length > 0 ? total / campusOrders.length : 0,
    }
  }, [userCampusId, orders, campusMap])

  const maxDaily = Math.max(...dailyChart.map((d) => d.total), 1)
  const maxCampus = Math.max(...campusSales.map((c) => c.total), 1)
  const totalPaymentAmount = paymentMethods.reduce((sum, p) => sum + p.total, 0)

  if (loading) {
    return <p className="p-5 text-white">Cargando dashboard...</p>
  }

  return (
    <div className="space-y-6 p-5 text-white">
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-zinc-400">
              <TrendingUp size={16} />
              <span className="text-sm">{getGreeting(now)}</span>
            </div>

            <h1 className="mt-2 text-3xl font-bold text-white">
              Dashboard PRO
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              {role === 'super_admin'
                ? 'Inteligencia de negocio global'
                : 'Inteligencia de negocio de tu campus'}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
              <div className="flex items-center gap-2 text-zinc-500">
                <CalendarDays size={14} />
                <span className="text-xs uppercase tracking-wide">Fecha local</span>
              </div>
              <p className="mt-1 text-sm font-medium capitalize text-white">
                {formatLongDate(now)}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
              <div className="flex items-center gap-2 text-zinc-500">
                <Clock3 size={14} />
                <span className="text-xs uppercase tracking-wide">Hora local</span>
              </div>
              <p className="mt-1 text-sm font-medium text-white">
                {formatTime(now)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
        <Card title="Hoy" value={formatCurrency(metrics.totalToday)} />
        <Card title="7 días" value={formatCurrency(metrics.totalWeek)} />
        <Card title="Mes actual" value={formatCurrency(metrics.totalMonth)} />
        <Card title="Mes anterior" value={formatCurrency(metrics.totalLastMonth)} />
        <Card title="Ticket promedio" value={formatCurrency(metrics.avgTicket)} />
        <GrowthCard value={metrics.growth} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900 p-5">
          <h2 className="text-lg font-semibold text-white">Ventas últimos 7 días</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Tendencia diaria de ingresos
          </p>

          <div className="mt-6 flex h-52 items-end gap-3">
            {dailyChart.map((d, i) => {
              const height = Math.max((d.total / maxDaily) * 100, 4)

              return (
                <div key={i} className="flex flex-1 flex-col items-center">
                  <div className="mb-2 text-[11px] text-zinc-500">
                    {d.total > 0 ? formatCurrency(d.total) : ''}
                  </div>
                  <div
                    className="w-full rounded-t-lg bg-amber-500 transition-all"
                    style={{ height: `${height}%` }}
                  />
                  <span className="mt-2 text-xs text-zinc-400">{d.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900 p-5">
          <h2 className="text-lg font-semibold text-white">Métodos de pago</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Distribución de ingresos
          </p>

          <div className="mt-5 space-y-4">
            {paymentMethods.length === 0 ? (
              <p className="text-sm text-zinc-500">Sin ventas registradas.</p>
            ) : (
              paymentMethods.map((method) => {
                const width =
                  totalPaymentAmount > 0 ? (method.total / totalPaymentAmount) * 100 : 0

                return (
                  <div key={method.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-300">{method.name}</span>
                      <span className="text-white">{formatCurrency(method.total)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zinc-800">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      {width.toFixed(1)}% del total
                    </p>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900 p-5">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-green-400" />
            <h2 className="text-lg font-semibold text-white">Top productos vendidos</h2>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Ranking por unidades vendidas
          </p>

          <div className="mt-5 space-y-3">
            {topProducts.length === 0 ? (
              <p className="text-sm text-zinc-500">No hay productos vendidos aún.</p>
            ) : (
              topProducts.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-white">{p.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">Ranking #{i + 1}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-400">{p.qty} uds</p>
                    <p className="text-xs text-zinc-500">{formatCurrency(p.total)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {role === 'super_admin' ? (
          <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900 p-5">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-purple-400" />
              <h2 className="text-lg font-semibold text-white">Ranking de sedes</h2>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Comparación de ventas por campus
            </p>

            <div className="mt-5 space-y-4">
              {campusSales.length === 0 ? (
                <p className="text-sm text-zinc-500">No hay ventas por campus aún.</p>
              ) : (
                campusSales.map((campus, i) => {
                  const width = maxCampus > 0 ? (campus.total / maxCampus) * 100 : 0

                  return (
                    <div key={campus.name} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-300">
                          #{i + 1} {campus.name}
                        </span>
                        <span className="text-white">{formatCurrency(campus.total)}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-zinc-800">
                        <div
                          className="h-2 rounded-full bg-purple-500"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        {campus.orders} órdenes
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900 p-5">
            <h2 className="text-lg font-semibold text-white">Rendimiento de tu campus</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Resumen operativo de tu sede
            </p>

            <div className="mt-5 grid gap-3">
              <MiniCard
                label="Campus"
                value={currentCampusSummary?.name ?? 'Tu campus'}
              />
              <MiniCard
                label="Ventas acumuladas"
                value={formatCurrency(currentCampusSummary?.total ?? 0)}
              />
              <MiniCard
                label="Órdenes registradas"
                value={String(currentCampusSummary?.orders ?? 0)}
              />
              <MiniCard
                label="Promedio por orden"
                value={formatCurrency(currentCampusSummary?.avg ?? 0)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900 p-4">
      <p className="text-xs text-zinc-400">{title}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  )
}

function GrowthCard({ value }: { value: number }) {
  const positive = value >= 0

  return (
    <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900 p-4">
      <p className="text-xs text-zinc-400">Crecimiento</p>
      <div className="mt-2 flex items-center gap-2">
        {positive ? (
          <TrendingUp size={18} className="text-green-400" />
        ) : (
          <TrendingDown size={18} className="text-red-400" />
        )}
        <p className={`text-2xl font-bold ${positive ? 'text-green-400' : 'text-red-400'}`}>
          {value.toFixed(1)}%
        </p>
      </div>
    </div>
  )
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-950/50 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-white">{value}</p>
    </div>
  )
}