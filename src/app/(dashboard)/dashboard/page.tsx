'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Building2, CalendarDays, Clock3,
  ShoppingBag, ArrowUpRight, ArrowDownRight, Banknote,
  CreditCard, Landmark, Wallet, Package, Users, Zap,
  ReceiptText, RefreshCw,
} from 'lucide-react'

// ─── Formatters ──────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
  }).format(n || 0)

const fmtShort = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return fmt(n)
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

const fmtTime = (d: Date) =>
  d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })

function greeting(d: Date) {
  const h = d.getHours()
  if (h < 12) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function startOfDay(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x
}

// Payment method icons & colors
const PM: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  efectivo:      { icon: Banknote,    color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  transferencia: { icon: Landmark,    color: 'text-blue-400',    bg: 'bg-blue-500/10'    },
  debito:        { icon: CreditCard,  color: 'text-violet-400',  bg: 'bg-violet-500/10'  },
  credito:       { icon: Wallet,      color: 'text-amber-400',   bg: 'bg-amber-500/10'   },
}

// Campus colors
const CC: Record<string, string> = {
  'ARM Santiago':     '#60a5fa',
  'ARM Puente Alto':  '#c084fc',
  'ARM Punta Arenas': '#2dd4bf',
  'ARM Montevideo':   '#fbbf24',
  'ARM Maracaibo':    '#f87171',
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-xl text-xs">
      <p className="text-zinc-400 mb-1">{label}</p>
      <p className="font-bold text-amber-400">{fmt(payload[0]?.value ?? 0)}</p>
    </div>
  )
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({
  title, value, sub, trend, sparkData, accent = 'amber',
}: {
  title: string
  value: string
  sub?: string
  trend?: number
  sparkData?: number[]
  accent?: 'amber' | 'blue' | 'green' | 'purple'
}) {
  const accentColor = {
    amber:  { line: '#f59e0b', fill: '#f59e0b22' },
    blue:   { line: '#60a5fa', fill: '#60a5fa22' },
    green:  { line: '#34d399', fill: '#34d39922' },
    purple: { line: '#c084fc', fill: '#c084fc22' },
  }[accent]

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{title}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-white">{value}</p>

      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}

      {trend !== undefined && (
        <div className={`mt-2 flex items-center gap-1 text-xs font-semibold ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend >= 0
            ? <ArrowUpRight size={13} />
            : <ArrowDownRight size={13} />}
          {Math.abs(trend).toFixed(1)}% vs mes anterior
        </div>
      )}

      {sparkData && sparkData.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-12 opacity-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData.map((v, i) => ({ v, i }))} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`sg-${accent}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accentColor.line} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={accentColor.line} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={accentColor.line} strokeWidth={2}
                fill={`url(#sg-${accent})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function DashboardPage() {
  const supabase = createClient()
  const [orders, setOrders] = useState<any[]>([])
  const [orderItems, setOrderItems] = useState<any[]>([])
  const [campuses, setCampuses] = useState<any[]>([])
  const [sellers, setSellers] = useState<any[]>([])
  const [role, setRole] = useState('')
  const [userName, setUserName] = useState('')
  const [userCampusId, setUserCampusId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Data load
  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, campus_id, full_name')
        .eq('id', session.user.id)
        .single()

      const currentRole = profile?.role ?? ''
      const currentCampusId = profile?.campus_id ?? null
      setRole(currentRole)
      setUserName(profile?.full_name ?? '')
      setUserCampusId(currentCampusId)

      let ordersQ = supabase
        .from('orders')
        .select('id, total, discount, created_at, campus_id, payment_method, seller_id, order_number')
        .in('status', ['paid', 'completada', 'completed'])
        .order('created_at', { ascending: false })

      let itemsQ = supabase
        .from('order_items')
        .select('quantity, unit_price, product:products(name), order:orders(id, campus_id, created_at)')

      if (currentRole !== 'super_admin' && currentCampusId) {
        ordersQ = ordersQ.eq('campus_id', currentCampusId)
      }

      const [
        { data: ordersData },
        { data: itemsData },
        { data: campusData },
        { data: sellersData },
      ] = await Promise.all([
        ordersQ,
        itemsQ,
        supabase.from('campus').select('id, name').eq('active', true).order('name'),
        supabase.from('profiles').select('id, full_name').eq('active', true),
      ])

      const safeItems = (itemsData ?? []).filter((item: any) => {
        if (currentRole === 'super_admin') return true
        const o = Array.isArray(item.order) ? item.order[0] : item.order
        return o?.campus_id === currentCampusId
      })

      setOrders(ordersData ?? [])
      setOrderItems(safeItems)
      setCampuses(campusData ?? [])
      setSellers(sellersData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // ── Derived data ────────────────────────────────────────────────────────
  const campusMap = useMemo(() => {
    const m = new Map<string, string>()
    campuses.forEach(c => m.set(c.id, c.name))
    return m
  }, [campuses])

  const sellerMap = useMemo(() => {
    const m = new Map<string, string>()
    sellers.forEach(s => m.set(s.id, s.full_name))
    return m
  }, [sellers])

  const metrics = useMemo(() => {
    const todayStart    = startOfDay(now)
    const weekAgo       = new Date(now); weekAgo.setDate(now.getDate() - 7)
    const monthStart    = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd  = new Date(now.getFullYear(), now.getMonth(), 0)
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1)

    const todayOrders     = orders.filter(o => new Date(o.created_at) >= todayStart)
    const yesterdayOrders = orders.filter(o => {
      const d = new Date(o.created_at)
      return d >= yesterdayStart && d < todayStart
    })
    const weekOrders      = orders.filter(o => new Date(o.created_at) >= weekAgo)
    const monthOrders     = orders.filter(o => new Date(o.created_at) >= monthStart)
    const lastMonthOrders = orders.filter(o => {
      const d = new Date(o.created_at)
      return d >= lastMonthStart && d <= lastMonthEnd
    })

    const totalToday     = todayOrders.reduce((s, o) => s + Number(o.total ?? 0), 0)
    const totalYesterday = yesterdayOrders.reduce((s, o) => s + Number(o.total ?? 0), 0)
    const totalWeek      = weekOrders.reduce((s, o) => s + Number(o.total ?? 0), 0)
    const totalMonth     = monthOrders.reduce((s, o) => s + Number(o.total ?? 0), 0)
    const totalLastMonth = lastMonthOrders.reduce((s, o) => s + Number(o.total ?? 0), 0)
    const totalDiscounts = monthOrders.reduce((s, o) => s + Number(o.discount ?? 0), 0)

    const growth    = totalLastMonth > 0 ? ((totalMonth - totalLastMonth) / totalLastMonth) * 100 : 0
    const dayGrowth = totalYesterday > 0 ? ((totalToday - totalYesterday) / totalYesterday) * 100 : 0
    const avgTicket = monthOrders.length > 0 ? totalMonth / monthOrders.length : 0

    return {
      totalToday, totalYesterday, totalWeek, totalMonth, totalLastMonth,
      totalDiscounts, growth, dayGrowth, avgTicket,
      todayCount: todayOrders.length,
      monthCount: monthOrders.length,
      weekCount: weekOrders.length,
    }
  }, [orders, now])

  // 30-day daily chart
  const dailyChart = useMemo(() => {
    const days = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const start = startOfDay(d)
      const end   = new Date(start); end.setDate(end.getDate() + 1)
      const total = orders
        .filter(o => { const x = new Date(o.created_at); return x >= start && x < end })
        .reduce((s, o) => s + Number(o.total ?? 0), 0)
      days.push({
        label: d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }),
        total,
      })
    }
    return days
  }, [orders])

  // Sparkline data (last 7 days totals)
  const spark7 = useMemo(() => dailyChart.slice(-7).map(d => d.total), [dailyChart])

  // Hourly breakdown (today)
  const hourlyChart = useMemo(() => {
    const todayStart = startOfDay(now)
    const buckets: Record<number, number> = {}
    orders
      .filter(o => new Date(o.created_at) >= todayStart)
      .forEach(o => {
        const h = new Date(o.created_at).getHours()
        buckets[h] = (buckets[h] || 0) + Number(o.total ?? 0)
      })
    return Array.from({ length: 24 }, (_, h) => ({
      label: `${h}h`,
      total: buckets[h] || 0,
    }))
  }, [orders, now])

  // Top products
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>()
    orderItems.forEach(item => {
      const pRaw = Array.isArray(item.product) ? item.product[0] : item.product
      const name = pRaw?.name || 'Producto'
      if (!map.has(name)) map.set(name, { name, qty: 0, revenue: 0 })
      const cur = map.get(name)!
      cur.qty += Number(item.quantity ?? 0)
      cur.revenue += Number(item.quantity ?? 0) * Number(item.unit_price ?? 0)
    })
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 6)
  }, [orderItems])

  // Campus ranking
  const campusSales = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>()
    orders.forEach(o => {
      const name = campusMap.get(o.campus_id) || 'Sin campus'
      if (!map.has(o.campus_id)) map.set(o.campus_id, { name, total: 0, count: 0 })
      const cur = map.get(o.campus_id)!
      cur.total += Number(o.total ?? 0)
      cur.count += 1
    })
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [orders, campusMap])

  // Payment methods
  const paymentStats = useMemo(() => {
    const map = new Map<string, number>()
    orders.forEach(o => {
      const m = o.payment_method || 'otro'
      map.set(m, (map.get(m) || 0) + Number(o.total ?? 0))
    })
    const total = [...map.values()].reduce((s, v) => s + v, 0)
    return [...map.entries()]
      .map(([name, amount]) => ({ name, amount, pct: total > 0 ? (amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount)
  }, [orders])

  // Recent activity (last 8 orders)
  const recentOrders = useMemo(() => orders.slice(0, 8), [orders])

  // Top sellers (month)
  const topSellers = useMemo(() => {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const map = new Map<string, { name: string; total: number; count: number }>()
    orders
      .filter(o => new Date(o.created_at) >= monthStart)
      .forEach(o => {
        const name = sellerMap.get(o.seller_id) || 'Desconocido'
        if (!map.has(o.seller_id)) map.set(o.seller_id, { name, total: 0, count: 0 })
        const cur = map.get(o.seller_id)!
        cur.total += Number(o.total ?? 0)
        cur.count += 1
      })
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 5)
  }, [orders, sellerMap, now])

  const maxCampus = Math.max(...campusSales.map(c => c.total), 1)

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-500" />
          <p className="text-sm text-zinc-500">Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-5 text-white">

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-5">
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-500/5 blur-3xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-zinc-400">
              <Zap size={14} className="text-amber-500" />
              <span className="text-xs font-semibold uppercase tracking-widest">
                {greeting(now)}
                {userName && `, ${userName.split(' ')[0]}`}
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {role === 'super_admin' ? 'Vista global · Todos los campus' : 'Vista de tu campus'}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-2.5">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <CalendarDays size={12} />
                <span className="text-[10px] uppercase tracking-widest">Fecha</span>
              </div>
              <p className="mt-0.5 text-sm font-semibold capitalize text-white">{fmtDate(now)}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-2.5">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <Clock3 size={12} />
                <span className="text-[10px] uppercase tracking-widest">Hora</span>
              </div>
              <p className="mt-0.5 text-sm font-semibold text-white">{fmtTime(now)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Hoy"
          value={fmtShort(metrics.totalToday)}
          sub={`${metrics.todayCount} órdenes`}
          trend={metrics.dayGrowth}
          sparkData={spark7}
          accent="amber"
        />
        <StatCard
          title="7 días"
          value={fmtShort(metrics.totalWeek)}
          sub={`${metrics.weekCount} órdenes`}
          accent="blue"
        />
        <StatCard
          title="Mes actual"
          value={fmtShort(metrics.totalMonth)}
          sub={`${metrics.monthCount} órdenes`}
          trend={metrics.growth}
          accent="green"
        />
        <StatCard
          title="Mes anterior"
          value={fmtShort(metrics.totalLastMonth)}
          accent="purple"
        />
        <StatCard
          title="Ticket promedio"
          value={fmtShort(metrics.avgTicket)}
          sub="Mes actual"
          accent="amber"
        />
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Crecimiento</p>
          <div className={`mt-2 flex items-center gap-1.5 ${metrics.growth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {metrics.growth >= 0
              ? <TrendingUp size={22} />
              : <TrendingDown size={22} />}
            <span className="text-2xl font-black">{metrics.growth.toFixed(1)}%</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">vs mes anterior</p>
          {metrics.totalDiscounts > 0 && (
            <p className="mt-2 text-[10px] text-green-400">
              {fmtShort(metrics.totalDiscounts)} en descuentos
            </p>
          )}
        </div>
      </div>

      {/* ── AREA CHART 30 días ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-white">Ventas — últimos 30 días</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Ingresos diarios acumulados</p>
          </div>
          <div className="rounded-xl bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400">
            {fmtShort(metrics.totalMonth)} este mes
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={dailyChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fill: '#52525b', fontSize: 10 }}
              axisLine={false} tickLine={false}
              interval={4}
            />
            <YAxis hide />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone" dataKey="total"
              stroke="#f59e0b" strokeWidth={2}
              fill="url(#areaGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── ROW: HOURLY + PAYMENT METHODS ───────────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">

        {/* Hourly bars */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4">
            <h2 className="font-semibold text-white">Actividad de hoy por hora</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Distribución de ventas en el día</p>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={hourlyChart} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fill: '#52525b', fontSize: 9 }}
                axisLine={false} tickLine={false}
                interval={2}
              />
              <YAxis hide />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="total" radius={[3, 3, 0, 0]}>
                {hourlyChart.map((entry, i) => (
                  <Cell key={i} fill={entry.total > 0 ? '#f59e0b' : '#27272a'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment methods */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-4 font-semibold text-white">Métodos de pago</h2>
          {paymentStats.length === 0 ? (
            <p className="text-sm text-zinc-500">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {paymentStats.map(pm => {
                const cfg = PM[pm.name] ?? { icon: Wallet, color: 'text-zinc-400', bg: 'bg-zinc-800' }
                const Icon = cfg.icon
                return (
                  <div key={pm.name} className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${cfg.bg}`}>
                      <Icon size={14} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs">
                        <span className="capitalize text-zinc-300">{pm.name}</span>
                        <span className="font-bold text-white">{fmtShort(pm.amount)}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-current transition-all"
                          style={{ width: `${pm.pct}%`, color: cfg.color.replace('text-', '') }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] text-zinc-600 w-8 text-right">{pm.pct.toFixed(0)}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── ROW: TOP PRODUCTS + CAMPUS / SELLERS ─────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-2">

        {/* Top products */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Package size={16} className="text-emerald-400" />
            <h2 className="font-semibold text-white">Productos más vendidos</h2>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-sm text-zinc-500">Sin datos</p>
          ) : (
            <div className="space-y-2.5">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-black
                    ${i === 0 ? 'bg-amber-500/20 text-amber-400' : i === 1 ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-800 text-zinc-500'}`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm text-zinc-200">{p.name}</p>
                      <p className="ml-2 text-xs font-bold text-emerald-400">{p.qty} uds</p>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${(p.qty / (topProducts[0]?.qty || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-zinc-500 w-16 text-right">{fmtShort(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Campus ranking (super_admin) or Top sellers */}
        {role === 'super_admin' ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Building2 size={16} className="text-violet-400" />
              <h2 className="font-semibold text-white">Ranking de campus</h2>
            </div>
            {campusSales.length === 0 ? (
              <p className="text-sm text-zinc-500">Sin datos</p>
            ) : (
              <div className="space-y-3">
                {campusSales.map((c, i) => {
                  const color = CC[c.name] ?? '#71717a'
                  return (
                    <div key={c.name} className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-[10px] font-black text-zinc-400">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="truncate text-zinc-200">{c.name}</span>
                          <span className="ml-2 font-bold text-white">{fmtShort(c.total)}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${(c.total / maxCampus) * 100}%`, backgroundColor: color }}
                          />
                        </div>
                        <p className="mt-0.5 text-[10px] text-zinc-600">{c.count} órdenes</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Users size={16} className="text-blue-400" />
              <h2 className="font-semibold text-white">Top vendedores del mes</h2>
            </div>
            {topSellers.length === 0 ? (
              <p className="text-sm text-zinc-500">Sin datos</p>
            ) : (
              <div className="space-y-3">
                {topSellers.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-sm font-black text-amber-400">
                      {s.name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate text-zinc-200">{s.name}</span>
                        <span className="ml-2 font-bold text-amber-400">{fmtShort(s.total)}</span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-zinc-600">{s.count} órdenes</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── ACTIVIDAD RECIENTE ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-4 flex items-center gap-2">
          <ReceiptText size={16} className="text-zinc-400" />
          <h2 className="font-semibold text-white">Actividad reciente</h2>
          <span className="ml-auto text-xs text-zinc-600">Últimas 8 ventas</span>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-zinc-500">Sin ventas registradas.</p>
        ) : (
          <div className="space-y-1.5">
            {recentOrders.map(o => {
              const pm = PM[o.payment_method] ?? { icon: Wallet, color: 'text-zinc-400', bg: 'bg-zinc-800' }
              const PMIcon = pm.icon
              const campusName = campusMap.get(o.campus_id) ?? '—'
              const sellerName = sellerMap.get(o.seller_id)?.split(' ')[0] ?? '—'
              const dateStr = new Date(o.created_at).toLocaleString('es-CL', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
              })
              return (
                <div key={o.id}
                  className="flex items-center gap-3 rounded-xl border border-zinc-800/50 bg-zinc-950/40 px-3 py-2.5 transition hover:bg-zinc-800/30">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${pm.bg}`}>
                    <PMIcon size={14} className={pm.color} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-zinc-500">#{o.order_number}</span>
                      <span className="text-xs text-zinc-400">{sellerName}</span>
                      {role === 'super_admin' && (
                        <span className="text-[10px] text-zinc-600">· {campusName}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{fmtShort(o.total)}</p>
                    <p className="text-[10px] text-zinc-600">{dateStr}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
