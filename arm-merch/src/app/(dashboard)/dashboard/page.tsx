'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ChevronLeft, ChevronRight, Calendar, Globe, MapPin } from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(n)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('es-CL', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })

const STATUS_COLOR: Record<string, string> = {
  completada: 'text-green-400 bg-green-500/10',
  pendiente:  'text-amber-400 bg-amber-500/10',
  cancelada:  'text-red-400 bg-red-500/10',
}

const CAMPUS_COLORS: Record<string, string> = {
  'ARM Santiago':    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'ARM Puente Alto': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'ARM Punta Arenas':'bg-teal-500/10 text-teal-400 border-teal-500/20',
  'ARM Montevideo':  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'ARM Maracaibo':   'bg-red-500/10 text-red-400 border-red-500/20',
}

const DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function DashboardPage() {
  const today = new Date()
  const [selectedDate, setSelectedDate] = useState(today)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calMonth, setCalMonth]         = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [data, setData]                 = useState<any>(null)
  const [monthSales, setMonthSales]     = useState<Record<string, number>>({})
  const [userRole, setUserRole]         = useState('voluntario')
  const [userCampus, setUserCampus]     = useState<string | null>(null)
  const [campus, setCampus]             = useState<any[]>([])
  const [campusStats, setCampusStats]   = useState<any[]>([])
  const [viewMode, setViewMode]         = useState<'global' | 'campus'>('campus')

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: p } = await supabase.from('profiles').select('role, campus_id').eq('id', session.user.id).single()
      setUserRole(p?.role ?? 'voluntario')
      setUserCampus(p?.campus_id ?? null)
      if (p?.role === 'super_admin') {
        const { data: c } = await supabase.from('campus').select('id, name').eq('active', true).order('name')
        setCampus(c ?? [])
      }
    }
    init()
  }, [])

  useEffect(() => { loadData(selectedDate) }, [selectedDate, userCampus, userRole])
  useEffect(() => { loadMonthSales(calMonth) }, [calMonth])
  useEffect(() => {
    if (userRole === 'super_admin' && viewMode === 'global') loadCampusStats(selectedDate)
  }, [selectedDate, viewMode, userRole])

  async function loadData(date: Date) {
    setData(null)
    const supabase = createClient()
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString()
    const end   = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString()

    // Voluntarios solo ven sus propias ventas
    let query = supabase.from('orders').select('total, status, created_at, order_number, payment_method, seller_id')
      .eq('status', 'completada').gte('created_at', start).lt('created_at', end)
    if (userRole === 'voluntario' && session.user.id) {
      query = query.eq('seller_id', session.user.id)
    }

    const [{ data: dayOrders }, { data: lowStock }, { data: recent }] = await Promise.all([
      query.order('created_at', { ascending: false }),
      supabase.from('products_with_stock').select('id, name, stock').lte('stock', 5).gt('stock', 0).limit(5),
      supabase.from('orders').select('id, order_number, total, status, payment_method, created_at, seller:profiles(full_name)')
        .order('created_at', { ascending: false }).limit(8),
    ])

    const orders = (dayOrders ?? []) as any[]
    const hourMap: Record<number, number> = {}
    for (let h = 8; h <= 20; h++) hourMap[h] = 0
    orders.forEach((o: any) => {
      const h = new Date(o.created_at).getHours()
      if (h in hourMap) hourMap[h] += Number(o.total)
    })

    setData({
      dayTotal:   orders.reduce((s: number, o: any) => s + Number(o.total), 0),
      dayCount:   orders.length,
      dayOrders:  orders,
      lowStock:   lowStock ?? [],
      recent:     recent ?? [],
      hourlyData: Object.entries(hourMap).map(([h, total]) => ({ hour:`${h}h`, total })),
    })
  }

  async function loadCampusStats(date: Date) {
    const supabase = createClient()
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString()
    const end   = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString()

    const [{ data: orders }, { data: campusList }] = await Promise.all([
      supabase.from('orders').select('total, seller:profiles(campus_id, campus:campus(name))')
        .eq('status', 'completada').gte('created_at', start).lt('created_at', end),
      supabase.from('campus').select('id, name').eq('active', true).order('name'),
    ])

    const statsMap: Record<string, { name: string; total: number; count: number }> = {}
    ;(campusList ?? []).forEach((c: any) => { statsMap[c.id] = { name: c.name, total: 0, count: 0 } })
    ;(orders ?? []).forEach((o: any) => {
      const cid = o.seller?.campus_id
      if (cid && statsMap[cid]) {
        statsMap[cid].total += Number(o.total)
        statsMap[cid].count++
      }
    })
    setCampusStats(Object.values(statsMap).sort((a: any, b: any) => b.total - a.total))
  }

  async function loadMonthSales(monthStart: Date) {
    const supabase = createClient()
    const start = monthStart.toISOString()
    const end   = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1).toISOString()
    const { data } = await supabase.from('orders').select('total, created_at').eq('status', 'completada')
      .gte('created_at', start).lt('created_at', end)
    const map: Record<string, number> = {}
    ;(data ?? []).forEach((o: any) => {
      const d = new Date(o.created_at).getDate().toString()
      map[d] = (map[d] || 0) + Number(o.total)
    })
    setMonthSales(map)
  }

  const isToday    = (d: Date) => d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  const isSelected = (d: Date) => d.getDate() === selectedDate.getDate() && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear()
  const isFuture   = (d: Date) => d > today

  function buildCalendar() {
    const firstDay = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay()
    const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate()
    const cells: (Date | null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(calMonth.getFullYear(), calMonth.getMonth(), d))
    return cells
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length || !payload[0].value) return null
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs">
        <p className="text-zinc-400 mb-0.5">{label}</p>
        <p className="text-amber-400 font-bold">{fmt(payload[0].value)}</p>
      </div>
    )
  }

  const selectedLabel = isToday(selectedDate) ? 'Hoy'
    : selectedDate.toLocaleDateString('es-CL', { day:'2-digit', month:'short', year:'numeric' })

  return (
    <div className="flex flex-col gap-5">

      {/* Header con selector de fecha y modo de vista */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="relative">
          <button onClick={() => setCalendarOpen(!calendarOpen)}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white transition">
            <Calendar size={14} className="text-amber-400" />
            <span className="font-medium">{selectedLabel}</span>
            <ChevronRight size={14} className={`text-zinc-500 transition-transform ${calendarOpen ? 'rotate-90' : ''}`} />
          </button>

          {calendarOpen && (
            <div className="absolute top-12 left-0 z-50 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-4 w-72">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth()-1, 1))}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition">
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-semibold text-white">{MESES[calMonth.getMonth()]} {calMonth.getFullYear()}</span>
                <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth()+1, 1))}
                  disabled={calMonth.getMonth() === today.getMonth() && calMonth.getFullYear() === today.getFullYear()}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="grid grid-cols-7 mb-2">
                {DIAS.map(d => <div key={d} className="text-center text-[10px] text-zinc-600 font-medium py-1">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {buildCalendar().map((date, i) => {
                  if (!date) return <div key={i} />
                  const hasSales = !!monthSales[date.getDate().toString()]
                  const selected = isSelected(date)
                  const todayD   = isToday(date)
                  return (
                    <button key={i} disabled={isFuture(date)}
                      onClick={() => { setSelectedDate(date); setCalendarOpen(false) }}
                      title={hasSales ? fmt(monthSales[date.getDate().toString()]) : undefined}
                      className={`relative flex flex-col items-center justify-center rounded-lg py-1.5 text-xs transition
                        ${isFuture(date) ? 'opacity-30 cursor-not-allowed text-zinc-600'
                          : selected ? 'bg-amber-500 text-zinc-950 font-bold'
                          : todayD ? 'bg-zinc-700 text-white font-semibold'
                          : 'hover:bg-zinc-800 text-zinc-300'}`}>
                      <span>{date.getDate()}</span>
                      {hasSales && <span className={`w-1 h-1 rounded-full mt-0.5 ${selected ? 'bg-zinc-950' : 'bg-amber-400'}`} />}
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-[10px] text-zinc-500">Días con ventas</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isToday(selectedDate) && (
            <button onClick={() => { setSelectedDate(today); setCalMonth(new Date(today.getFullYear(), today.getMonth(), 1)) }}
              className="text-xs text-amber-400 hover:text-amber-300 transition">
              Volver a hoy
            </button>
          )}
          {/* Toggle global/campus para Super Admin */}
          {userRole === 'super_admin' && (
            <div className="flex bg-zinc-800 rounded-xl p-0.5 gap-0.5">
              <button onClick={() => setViewMode('campus')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${viewMode === 'campus' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-white'}`}>
                <MapPin size={12} />Mi campus
              </button>
              <button onClick={() => { setViewMode('global'); loadCampusStats(selectedDate) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${viewMode === 'global' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-white'}`}>
                <Globe size={12} />Global
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Vista Global — comparación entre campus */}
      {userRole === 'super_admin' && viewMode === 'global' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {campusStats.map(c => (
              <div key={c.name} className={`border rounded-xl p-4 ${CAMPUS_COLORS[c.name] ?? 'bg-zinc-800/50 border-zinc-700/40 text-zinc-400'}`}>
                <p className="text-[10px] font-semibold uppercase tracking-widest opacity-70 mb-1">{c.name.replace('ARM ','')}</p>
                <p className="text-lg font-bold">{fmt(c.total)}</p>
                <p className="text-[10px] opacity-60 mt-0.5">{c.count} orden{c.count !== 1 ? 'es' : ''}</p>
              </div>
            ))}
          </div>

          {/* Gráfico comparativo */}
          {campusStats.some(c => c.total > 0) && (
            <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-4">
              <p className="text-sm font-medium text-white mb-4">Ventas por campus — {selectedLabel}</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={campusStats.map(c => ({ name: c.name.replace('ARM ',''), total: c.total }))}>
                  <XAxis dataKey="name" tick={{ fill:'#52525b', fontSize:11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" radius={[6,6,0,0]} fill="#f59e0b" fillOpacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Vista normal por fecha */}
      {(viewMode === 'campus' || userRole !== 'super_admin') && (
        <>
          {data ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label:`Ventas ${selectedLabel.toLowerCase()}`, value:fmt(data.dayTotal), color:'text-amber-400' },
                  { label:`Órdenes ${selectedLabel.toLowerCase()}`, value:data.dayCount.toString(), color:'text-blue-400' },
                  { label:'Stock bajo', value:data.lowStock.length.toString(), color:'text-orange-400' },
                  { label:'Ticket promedio', value:data.dayCount > 0 ? fmt(data.dayTotal/data.dayCount) : '$0', color:'text-green-400' },
                ].map(s => (
                  <div key={s.label} className="bg-zinc-800/50 border border-zinc-700/40 rounded-xl p-4">
                    <p className="text-xs text-zinc-500">{s.label}</p>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-4">
                <p className="text-sm font-medium text-white mb-4">Ventas por hora — {selectedLabel}</p>
                {data.hourlyData.every((d: any) => d.total === 0) ? (
                  <div className="h-40 flex items-center justify-center text-zinc-600 text-sm">Sin ventas este día</div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={data.hourlyData} margin={{ top:4, right:4, bottom:0, left:0 }}>
                      <XAxis dataKey="hour" tick={{ fill:'#52525b', fontSize:10 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" radius={[4,4,0,0]}>
                        {data.hourlyData.map((_: any, i: number) => <Cell key={i} fill="#f59e0b" fillOpacity={0.85} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-4">
                  <p className="text-sm font-medium text-white mb-3">Stock bajo</p>
                  {data.lowStock.length === 0
                    ? <p className="text-zinc-600 text-xs py-4 text-center">Todo el stock normal</p>
                    : data.lowStock.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between py-1.5">
                        <span className="text-xs text-zinc-300 truncate flex-1">{p.name}</span>
                        <span className="text-xs font-bold text-orange-400 ml-2">{p.stock} uds.</span>
                      </div>
                    ))
                  }
                </div>

                <div className="lg:col-span-2 bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-4">
                  <p className="text-sm font-medium text-white mb-3">
                    {isToday(selectedDate) ? 'Órdenes recientes' : `Órdenes del ${selectedLabel}`}
                  </p>
                  {(isToday(selectedDate) ? data.recent : data.dayOrders).length === 0
                    ? <p className="text-zinc-600 text-xs py-4 text-center">Sin órdenes este día</p>
                    : (isToday(selectedDate) ? data.recent : data.dayOrders).map((o: any) => (
                      <div key={o.id} className="flex items-center gap-3 py-1.5 border-b border-zinc-700/30 last:border-0">
                        <span className="text-xs text-zinc-600 font-mono w-10">#{o.order_number}</span>
                        <span className="text-xs text-zinc-400 flex-1 truncate">{o.seller?.full_name ?? '—'}</span>
                        <span className="text-xs text-zinc-500 hidden sm:block">{fmtDate(o.created_at)}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[o.status] ?? ''}`}>{o.status}</span>
                        <span className="text-xs font-bold text-amber-400 min-w-[70px] text-right">{fmt(o.total)}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </>
      )}
    </div>
  )
}
