'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
  AreaChart, Area
} from 'recharts'
import {
  TrendingUp, TrendingDown, ShoppingCart, Package,
  Users, DollarSign, Calendar, Globe, MapPin,
  ArrowUpRight, ArrowDownRight, Minus, AlertTriangle,
  ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(n)

const fmtK = (n: number) => n >= 1000000
  ? `$${(n/1000000).toFixed(1)}M`
  : n >= 1000 ? `$${(n/1000).toFixed(0)}K` : fmt(n)

const DIAS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MESES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const CAMPUS_COLORS: Record<string, string> = {
  'ARM Santiago':    '#60a5fa',
  'ARM Puente Alto': '#c084fc',
  'ARM Punta Arenas':'#2dd4bf',
  'ARM Montevideo':  '#fbbf24',
  'ARM Maracaibo':   '#f87171',
}
const PIE_COLORS = ['#f59e0b','#60a5fa','#c084fc','#2dd4bf','#f87171','#4ade80']

const METHOD_LABEL: Record<string, string> = {
  efectivo:'Efectivo', transferencia:'Transferencia', debito:'Débito', credito:'Crédito'
}

export default function DashboardPage() {
  const today = new Date()
  const [selectedDate, setSelectedDate] = useState(today)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calMonth, setCalMonth]         = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [userRole, setUserRole]         = useState('voluntario')
  const [userCampusId, setUserCampusId] = useState<string|null>(null)
  const [userId, setUserId]             = useState<string>('')
  const [viewMode, setViewMode]         = useState<'global'|'campus'>('campus')
  const [loading, setLoading]           = useState(true)
  const [refreshing, setRefreshing]     = useState(false)

  // KPIs del día
  const [kpis, setKpis] = useState({
    dayTotal: 0, dayCount: 0, dayAvg: 0,
    prevTotal: 0, prevCount: 0,
    monthTotal: 0, monthCount: 0,
    prevMonthTotal: 0,
    lowStockCount: 0, outStockCount: 0,
    activeUsers: 0,
  })

  // Gráficos
  const [hourlyData, setHourlyData]   = useState<any[]>([])
  const [weeklyData, setWeeklyData]   = useState<any[]>([])
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [methodData, setMethodData]   = useState<any[]>([])
  const [campusData, setCampusData]   = useState<any[]>([])
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [calSales, setCalSales]       = useState<Record<string, number>>({})

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setUserId(session.user.id)
      const { data: p } = await supabase.from('profiles').select('role, campus_id').eq('id', session.user.id).single()
      setUserRole(p?.role ?? 'voluntario')
      setUserCampusId(p?.campus_id ?? null)
    }
    init()
  }, [])

  useEffect(() => {
    if (userId) loadAll(selectedDate)
  }, [selectedDate, userId, userRole, viewMode])

  useEffect(() => {
    if (userId) loadCalSales(calMonth)
  }, [calMonth, userId])

  const loadAll = useCallback(async (date: Date) => {
    setLoading(true)
    const supabase = createClient()

    const startDay   = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString()
    const endDay     = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString()
    const prevDay    = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1).toISOString()
    const startMonth = new Date(date.getFullYear(), date.getMonth(), 1).toISOString()
    const prevMonthStart = new Date(date.getFullYear(), date.getMonth() - 1, 1).toISOString()
    const prevMonthEnd   = new Date(date.getFullYear(), date.getMonth(), 1).toISOString()
    const last7Start     = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 6).toISOString()

    // Construir filtro base según rol
    const applyFilter = (q: any) => {
      if (userRole === 'voluntario') return q.eq('seller_id', userId)
      if (userRole === 'admin' && userCampusId && viewMode === 'campus') {
        // Admin ve su campus via seller profiles
      }
      return q
    }

    const [
      { data: dayOrders },
      { data: prevOrders },
      { data: monthOrders },
      { data: prevMonthOrders },
      { data: weekOrders },
      { data: stock },
      { data: recent },
    ] = await Promise.all([
      applyFilter(supabase.from('orders').select('total, payment_method, created_at').eq('status','completada').gte('created_at', startDay).lt('created_at', endDay)),
      applyFilter(supabase.from('orders').select('total').eq('status','completada').gte('created_at', prevDay).lt('created_at', startDay)),
      applyFilter(supabase.from('orders').select('total, payment_method, created_at').eq('status','completada').gte('created_at', startMonth)),
      applyFilter(supabase.from('orders').select('total').eq('status','completada').gte('created_at', prevMonthStart).lt('created_at', prevMonthEnd)),
      applyFilter(supabase.from('orders').select('total, created_at').eq('status','completada').gte('created_at', last7Start)),
      supabase.from('products_with_stock').select('stock, low_stock_alert'),
      applyFilter(supabase.from('orders').select('id, order_number, total, payment_method, notes, created_at, seller:profiles(full_name)').eq('status','completada').order('created_at', { ascending:false }).limit(6)),
    ])

    const dayList  = dayOrders  ?? []
    const dayTotal = dayList.reduce((s: number, o: any) => s + Number(o.total), 0)
    const prevTotal= (prevOrders ?? []).reduce((s: number, o: any) => s + Number(o.total), 0)
    const monthTotal = (monthOrders ?? []).reduce((s: number, o: any) => s + Number(o.total), 0)
    const prevMonthTotal = (prevMonthOrders ?? []).reduce((s: number, o: any) => s + Number(o.total), 0)
    const stockList = stock ?? []
    const lowStockCount = stockList.filter((s: any) => s.stock > 0 && s.stock <= (s.low_stock_alert ?? 5)).length
    const outStockCount = stockList.filter((s: any) => s.stock === 0).length

    // KPIs
    setKpis({
      dayTotal, dayCount: dayList.length,
      dayAvg: dayList.length > 0 ? dayTotal / dayList.length : 0,
      prevTotal, prevCount: (prevOrders ?? []).length,
      monthTotal, monthCount: (monthOrders ?? []).length,
      prevMonthTotal, lowStockCount, outStockCount,
      activeUsers: 0,
    })

    // Gráfico por hora
    const hourMap: Record<number, number> = {}
    for (let h = 8; h <= 21; h++) hourMap[h] = 0
    dayList.forEach((o: any) => {
      const h = new Date(o.created_at).getHours()
      if (h in hourMap) hourMap[h] += Number(o.total)
    })
    setHourlyData(Object.entries(hourMap).map(([h, total]) => ({
      hour: `${h}h`, total, count: dayList.filter((o: any) => new Date(o.created_at).getHours() === parseInt(h)).length
    })))

    // Gráfico últimos 7 días
    const weekMap: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(date); d.setDate(d.getDate() - i)
      weekMap[d.toISOString().split('T')[0]] = 0
    }
    ;(weekOrders ?? []).forEach((o: any) => {
      const d = new Date(o.created_at).toISOString().split('T')[0]
      if (d in weekMap) weekMap[d] += Number(o.total)
    })
    setWeeklyData(Object.entries(weekMap).map(([date, total]) => ({
      day: DIAS[new Date(date).getDay()],
      date, total,
    })))

    // Método de pago del mes
    const methodMap: Record<string, number> = {}
    ;(monthOrders ?? []).forEach((o: any) => {
      const m = METHOD_LABEL[o.payment_method] ?? o.payment_method
      methodMap[m] = (methodMap[m] ?? 0) + Number(o.total)
    })
    setMethodData(Object.entries(methodMap).map(([name, value]) => ({ name, value })))

    // Top productos del mes
    const { data: topItems } = await supabase.from('order_items')
      .select('quantity, unit_price, product:products(name), order:orders!inner(status, created_at)')
      .eq('order.status','completada')
      .gte('order.created_at', startMonth)
      .limit(100)

    const prodMap: Record<string, { name: string; qty: number; revenue: number }> = {}
    ;(topItems ?? []).forEach((item: any) => {
      const name = item.product?.name ?? '—'
      if (!prodMap[name]) prodMap[name] = { name, qty: 0, revenue: 0 }
      prodMap[name].qty     += item.quantity
      prodMap[name].revenue += item.quantity * Number(item.unit_price)
    })
    setTopProducts(Object.values(prodMap).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 8))

    // Órdenes recientes
    setRecentOrders(recent ?? [])

    // Campus comparison (super_admin global)
    if (userRole === 'super_admin' && viewMode === 'global') {
      const { data: campusList } = await supabase.from('campus').select('id, name').eq('active', true)
      const { data: allOrders } = await supabase.from('orders')
        .select('total, seller:profiles!inner(campus_id)')
        .eq('status','completada').gte('created_at', startMonth)

      const cMap: Record<string, number> = {}
      ;(campusList ?? []).forEach((c: any) => { cMap[c.id] = 0 })
      ;(allOrders ?? []).forEach((o: any) => {
        const cid = o.seller?.campus_id
        if (cid && cid in cMap) cMap[cid] += Number(o.total)
      })
      setCampusData((campusList ?? []).map((c: any) => ({
        name: c.name.replace('ARM ',''),
        total: cMap[c.id] ?? 0,
        color: CAMPUS_COLORS[c.name] ?? '#888',
      })).sort((a: any, b: any) => b.total - a.total))
    }

    // Tendencia mensual (últimos 6 meses)
    const months: any[] = []
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(date.getFullYear(), date.getMonth() - i, 1).toISOString()
      const mEnd   = new Date(date.getFullYear(), date.getMonth() - i + 1, 1).toISOString()
      const label  = MESES[new Date(date.getFullYear(), date.getMonth() - i, 1).getMonth()].slice(0,3)
      months.push({ mStart, mEnd, label })
    }
    const monthlyPromises = months.map(m =>
      applyFilter(supabase.from('orders').select('total').eq('status','completada').gte('created_at', m.mStart).lt('created_at', m.mEnd))
    )
    const monthlyResults = await Promise.all(monthlyPromises)
    setMonthlyData(months.map((m, i) => ({
      month: m.label,
      total: (monthlyResults[i]?.data ?? []).reduce((s: number, o: any) => s + Number(o.total), 0)
    })))

    setLoading(false)
  }, [userId, userRole, userCampusId, viewMode])

  async function loadCalSales(monthStart: Date) {
    const supabase = createClient()
    const start = monthStart.toISOString()
    const end   = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1).toISOString()
    const { data } = await supabase.from('orders').select('total, created_at').eq('status','completada').gte('created_at', start).lt('created_at', end)
    const map: Record<string, number> = {}
    ;(data ?? []).forEach((o: any) => {
      const d = new Date(o.created_at).getDate().toString()
      map[d] = (map[d] ?? 0) + Number(o.total)
    })
    setCalSales(map)
  }

  const isToday    = (d: Date) => d.toDateString() === today.toDateString()
  const isSelected = (d: Date) => d.toDateString() === selectedDate.toDateString()
  const isFuture   = (d: Date) => d > today

  function buildCalendar() {
    const firstDay    = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay()
    const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate()
    const cells: (Date|null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(calMonth.getFullYear(), calMonth.getMonth(), d))
    return cells
  }

  const Growth = ({ curr, prev, suffix = '' }: { curr: number; prev: number; suffix?: string }) => {
    if (prev === 0 && curr === 0) return <span className="text-xs text-zinc-600">Sin datos previos</span>
    if (prev === 0) return <span className="text-xs text-green-400 flex items-center gap-0.5"><ArrowUpRight size={12} />Nuevo</span>
    const pct = ((curr - prev) / prev) * 100
    const up  = pct >= 0
    return (
      <span className={`text-xs flex items-center gap-0.5 font-medium ${up ? 'text-green-400' : 'text-red-400'}`}>
        {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {Math.abs(pct).toFixed(1)}%{suffix}
      </span>
    )
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs shadow-xl">
        <p className="text-zinc-400 mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color ?? '#f59e0b' }} className="font-bold">
            {typeof p.value === 'number' && p.value > 1000 ? fmt(p.value) : p.value}
          </p>
        ))}
      </div>
    )
  }

  const selectedLabel = isToday(selectedDate) ? 'Hoy'
    : selectedDate.toLocaleDateString('es-CL', { day:'2-digit', month:'short', year:'numeric' })

  const dayGrowthPct = kpis.prevTotal > 0 ? ((kpis.dayTotal - kpis.prevTotal) / kpis.prevTotal) * 100 : null
  const monthGrowthPct = kpis.prevMonthTotal > 0 ? ((kpis.monthTotal - kpis.prevMonthTotal) / kpis.prevMonthTotal) * 100 : null

  return (
    <div className="flex flex-col gap-5">

      {/* ─── HEADER ─── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Dashboard</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{selectedLabel} · {new Date().toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' })}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector de fecha */}
          <div className="relative">
            <button onClick={() => setCalendarOpen(!calendarOpen)}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white transition">
              <Calendar size={13} className="text-amber-400" />
              <span>{selectedLabel}</span>
              <ChevronRight size={12} className={`text-zinc-500 transition-transform ${calendarOpen ? 'rotate-90' : ''}`} />
            </button>
            {calendarOpen && (
              <div className="absolute top-10 left-0 z-50 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-4 w-72">
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth()-1, 1))}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400"><ChevronLeft size={15} /></button>
                  <span className="text-xs font-semibold text-white">{MESES[calMonth.getMonth()]} {calMonth.getFullYear()}</span>
                  <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth()+1, 1))}
                    disabled={calMonth.getMonth() === today.getMonth() && calMonth.getFullYear() === today.getFullYear()}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 disabled:opacity-30"><ChevronRight size={15} /></button>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {DIAS.map(d => <div key={d} className="text-center text-[9px] text-zinc-600 font-medium py-1">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {buildCalendar().map((date, i) => {
                    if (!date) return <div key={i} />
                    const hasSales = !!calSales[date.getDate().toString()]
                    const sel = isSelected(date); const tod = isToday(date)
                    return (
                      <button key={i} disabled={isFuture(date)}
                        onClick={() => { setSelectedDate(date); setCalendarOpen(false) }}
                        className={`relative flex flex-col items-center justify-center rounded-lg py-1 text-[11px] transition
                          ${isFuture(date) ? 'opacity-20 cursor-not-allowed' : sel ? 'bg-amber-500 text-zinc-950 font-bold' : tod ? 'bg-zinc-700 text-white' : 'hover:bg-zinc-800 text-zinc-300'}`}>
                        {date.getDate()}
                        {hasSales && <span className={`w-1 h-1 rounded-full mt-0.5 ${sel ? 'bg-zinc-950' : 'bg-amber-400'}`} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {!isToday(selectedDate) && (
            <button onClick={() => setSelectedDate(today)} className="text-xs text-amber-400 hover:text-amber-300 transition">Hoy</button>
          )}

          {userRole === 'super_admin' && (
            <div className="flex bg-zinc-800 rounded-xl p-0.5 gap-0.5">
              <button onClick={() => setViewMode('campus')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${viewMode === 'campus' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-white'}`}>
                <MapPin size={11} />Mi campus
              </button>
              <button onClick={() => setViewMode('global')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${viewMode === 'global' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-white'}`}>
                <Globe size={11} />Global
              </button>
            </div>
          )}

          <button onClick={() => { setRefreshing(true); loadAll(selectedDate).finally(() => setRefreshing(false)) }}
            className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition text-zinc-400">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ─── KPI CARDS ─── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Ventas del día */}
            <div className="bg-zinc-800/50 border border-zinc-700/40 rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <DollarSign size={15} className="text-amber-400" />
                  </div>
                  <span className="text-xs text-zinc-500">Ventas {selectedLabel.toLowerCase()}</span>
                </div>
                <Growth curr={kpis.dayTotal} prev={kpis.prevTotal} suffix=" vs ayer" />
              </div>
              <p className="text-2xl font-black text-white">{fmtK(kpis.dayTotal)}</p>
              <p className="text-[10px] text-zinc-600">{kpis.dayCount} órdenes · ticket prom. {kpis.dayCount > 0 ? fmtK(kpis.dayAvg) : '$0'}</p>
            </div>

            {/* Ventas del mes */}
            <div className="bg-zinc-800/50 border border-zinc-700/40 rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <TrendingUp size={15} className="text-blue-400" />
                  </div>
                  <span className="text-xs text-zinc-500">Mes actual</span>
                </div>
                <Growth curr={kpis.monthTotal} prev={kpis.prevMonthTotal} suffix=" vs mes ant." />
              </div>
              <p className="text-2xl font-black text-white">{fmtK(kpis.monthTotal)}</p>
              <p className="text-[10px] text-zinc-600">{kpis.monthCount} órdenes · {MESES[selectedDate.getMonth()]}</p>
            </div>

            {/* Stock crítico */}
            <div className={`border rounded-2xl p-4 flex flex-col gap-2 ${kpis.outStockCount > 0 ? 'bg-red-500/5 border-red-500/20' : kpis.lowStockCount > 0 ? 'bg-orange-500/5 border-orange-500/20' : 'bg-zinc-800/50 border-zinc-700/40'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${kpis.outStockCount > 0 ? 'bg-red-500/10' : 'bg-orange-500/10'}`}>
                    <AlertTriangle size={15} className={kpis.outStockCount > 0 ? 'text-red-400' : 'text-orange-400'} />
                  </div>
                  <span className="text-xs text-zinc-500">Stock crítico</span>
                </div>
                {kpis.outStockCount > 0 && <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-semibold">URGENTE</span>}
              </div>
              <p className={`text-2xl font-black ${kpis.outStockCount > 0 ? 'text-red-400' : 'text-orange-400'}`}>
                {kpis.outStockCount + kpis.lowStockCount}
              </p>
              <p className="text-[10px] text-zinc-600">{kpis.outStockCount} sin stock · {kpis.lowStockCount} stock bajo</p>
            </div>

            {/* Ticket promedio mes */}
            <div className="bg-zinc-800/50 border border-zinc-700/40 rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <ShoppingCart size={15} className="text-green-400" />
                  </div>
                  <span className="text-xs text-zinc-500">Ticket promedio mes</span>
                </div>
              </div>
              <p className="text-2xl font-black text-white">
                {kpis.monthCount > 0 ? fmtK(kpis.monthTotal / kpis.monthCount) : '$0'}
              </p>
              <p className="text-[10px] text-zinc-600">Basado en {kpis.monthCount} ventas</p>
            </div>
          </div>

          {/* ─── GRÁFICOS FILA 1 ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Tendencia mensual 6M — área */}
            <div className="lg:col-span-2 bg-zinc-800/30 border border-zinc-700/40 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-white">Tendencia de ventas</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Últimos 6 meses</p>
                </div>
                {monthGrowthPct !== null && (
                  <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${monthGrowthPct >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {monthGrowthPct >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(monthGrowthPct).toFixed(1)}% vs mes anterior
                  </div>
                )}
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={monthlyData} margin={{ top:4, right:4, bottom:0, left:0 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill:'#52525b', fontSize:11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill:'#52525b', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={2} fill="url(#areaGrad)" dot={{ fill:'#f59e0b', r:4, strokeWidth:0 }} activeDot={{ r:6 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Métodos de pago — torta */}
            <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-2xl p-4">
              <p className="text-sm font-semibold text-white mb-1">Métodos de pago</p>
              <p className="text-[10px] text-zinc-500 mb-4">Mes actual</p>
              {methodData.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-zinc-600 text-xs">Sin datos</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={130}>
                    <PieChart>
                      <Pie data={methodData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3} dataKey="value">
                        {methodData.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-1.5 mt-2">
                    {methodData.map((m: any, i: number) => (
                      <div key={m.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-[10px] text-zinc-400">{m.name}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-zinc-300">{fmt(m.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ─── GRÁFICOS FILA 2 ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Ventas por hora */}
            <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-2xl p-4">
              <p className="text-sm font-semibold text-white mb-1">Ventas por hora</p>
              <p className="text-[10px] text-zinc-500 mb-4">{selectedLabel}</p>
              {hourlyData.every(d => d.total === 0) ? (
                <div className="h-32 flex items-center justify-center text-zinc-600 text-xs">Sin ventas</div>
              ) : (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={hourlyData} margin={{ top:0, right:0, bottom:0, left:0 }}>
                    <XAxis dataKey="hour" tick={{ fill:'#52525b', fontSize:9 }} axisLine={false} tickLine={false} interval={1} />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" radius={[4,4,0,0]} fill="#f59e0b" fillOpacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Últimos 7 días */}
            <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-2xl p-4">
              <p className="text-sm font-semibold text-white mb-1">Últimos 7 días</p>
              <p className="text-[10px] text-zinc-500 mb-4">Comparativa diaria</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={weeklyData} margin={{ top:0, right:0, bottom:0, left:0 }}>
                  <XAxis dataKey="day" tick={{ fill:'#52525b', fontSize:10 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" radius={[4,4,0,0]}>
                    {weeklyData.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.date === selectedDate.toISOString().split('T')[0] ? '#f59e0b' : '#3f3f46'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Campus global — torta (solo super_admin global) */}
            {userRole === 'super_admin' && viewMode === 'global' && campusData.length > 0 ? (
              <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-2xl p-4">
                <p className="text-sm font-semibold text-white mb-1">Participación por campus</p>
                <p className="text-[10px] text-zinc-500 mb-3">Mes actual</p>
                <ResponsiveContainer width="100%" height={110}>
                  <PieChart>
                    <Pie data={campusData} cx="50%" cy="50%" outerRadius={50} dataKey="total" paddingAngle={2}>
                      {campusData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1 mt-1">
                  {campusData.map((c: any) => {
                    const total = campusData.reduce((s: number, x: any) => s + x.total, 0)
                    const pct   = total > 0 ? Math.round(c.total / total * 100) : 0
                    return (
                      <div key={c.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                          <span className="text-[10px] text-zinc-400">{c.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-600">{pct}%</span>
                          <span className="text-[10px] font-semibold text-zinc-300">{fmtK(c.total)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              /* Top productos mini */
              <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-2xl p-4">
                <p className="text-sm font-semibold text-white mb-1">Top productos</p>
                <p className="text-[10px] text-zinc-500 mb-3">Mes · por ingresos</p>
                {topProducts.length === 0
                  ? <div className="text-zinc-600 text-xs text-center py-8">Sin datos</div>
                  : topProducts.slice(0,5).map((p: any, i: number) => {
                    const maxRev = topProducts[0].revenue
                    return (
                      <div key={p.name} className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] text-zinc-600 w-4 shrink-0">#{i+1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-zinc-300 truncate">{p.name}</p>
                          <div className="w-full bg-zinc-700/50 rounded-full h-1 mt-1">
                            <div className="h-1 rounded-full bg-amber-500" style={{ width:`${(p.revenue/maxRev)*100}%` }} />
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold text-amber-400 shrink-0">{fmtK(p.revenue)}</span>
                      </div>
                    )
                  })
                }
              </div>
            )}
          </div>

          {/* ─── FILA 3: Top productos completo + Órdenes recientes ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Top productos — barras horizontales */}
            <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-2xl p-4">
              <p className="text-sm font-semibold text-white mb-1">Ranking de productos</p>
              <p className="text-[10px] text-zinc-500 mb-4">Mes actual · unidades + ingresos</p>
              {topProducts.length === 0
                ? <div className="text-zinc-600 text-xs text-center py-8">Sin datos este mes</div>
                : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={topProducts.slice(0,6)} layout="vertical" margin={{ top:0, right:60, bottom:0, left:0 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tick={{ fill:'#71717a', fontSize:10 }} axisLine={false} tickLine={false} width={130} />
                      <Tooltip formatter={(v: any) => fmt(v)} />
                      <Bar dataKey="revenue" radius={[0,4,4,0]} fill="#f59e0b" fillOpacity={0.85} label={{ position:'right', fontSize:10, fill:'#a1a1aa', formatter: (v: number) => fmtK(v) }} />
                    </BarChart>
                  </ResponsiveContainer>
                )
              }
            </div>

            {/* Órdenes recientes */}
            <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-white">Órdenes recientes</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Últimas 6 ventas</p>
                </div>
              </div>
              {recentOrders.length === 0
                ? <div className="text-zinc-600 text-xs text-center py-8">Sin órdenes recientes</div>
                : recentOrders.map((o: any) => (
                  <div key={o.id} className="flex items-center gap-3 py-2 border-b border-zinc-700/30 last:border-0">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-amber-400">#{o.order_number}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-200 font-medium truncate">
                        {o.notes?.replace('Cliente: ','').split(' | ')[0] ?? '—'}
                      </p>
                      <p className="text-[10px] text-zinc-600">
                        {new Date(o.created_at).toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' })}
                        {o.seller?.full_name && userRole !== 'voluntario' ? ` · ${o.seller.full_name}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-amber-400">{fmt(o.total)}</p>
                      <p className="text-[9px] text-zinc-600 capitalize">{METHOD_LABEL[o.payment_method] ?? o.payment_method}</p>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </>
      )}
    </div>
  )
}
