'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

const STATUS_COLOR: Record<string, string> = {
  completada: 'text-green-400 bg-green-500/10',
  pendiente:  'text-amber-400 bg-amber-500/10',
  cancelada:  'text-red-400 bg-red-500/10',
}

const DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function DashboardPage() {
  const today = new Date()
  const [selectedDate, setSelectedDate] = useState(today)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calMonth, setCalMonth]         = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [data, setData]                 = useState<any>(null)
  const [monthSales, setMonthSales]     = useState<Record<string, number>>({})

  useEffect(() => {
    loadData(selectedDate)
  }, [selectedDate])

  useEffect(() => {
    loadMonthSales(calMonth)
  }, [calMonth])

  async function loadData(date: Date) {
    setData(null)
    const supabase = createClient()
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString()
    const end   = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString()

    const [{ data: dayOrders }, { data: lowStock }, { data: recent }] = await Promise.all([
      supabase.from('orders').select('total, status, created_at, order_number, payment_method, seller:profiles(full_name)')
        .eq('status', 'completada').gte('created_at', start).lt('created_at', end)
        .order('created_at', { ascending: false }),
      supabase.from('products_with_stock').select('id, name, stock').lte('stock', 5).gt('stock', 0).limit(5),
      supabase.from('orders').select('id, order_number, total, status, payment_method, created_at, seller:profiles(full_name)')
        .order('created_at', { ascending: false }).limit(8),
    ])

    const orders = (dayOrders ?? []) as any[]

    // Ventas por hora del día seleccionado
    const hourMap: Record<number, number> = {}
    for (let h = 8; h <= 20; h++) hourMap[h] = 0
    orders.forEach((o: any) => {
      const h = new Date(o.created_at).getHours()
      if (h in hourMap) hourMap[h] += Number(o.total)
    })
    const hourlyData = Object.entries(hourMap).map(([h, total]) => ({ hour: `${h}h`, total }))

    setData({
      dayTotal:  orders.reduce((s: number, o: any) => s + Number(o.total), 0),
      dayCount:  orders.length,
      dayOrders: orders,
      lowStock:  lowStock ?? [],
      recent:    recent ?? [],
      hourlyData,
    })
  }

  async function loadMonthSales(monthStart: Date) {
    const supabase = createClient()
    const start = monthStart.toISOString()
    const end   = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1).toISOString()
    const { data } = await supabase.from('orders')
      .select('total, created_at').eq('status', 'completada')
      .gte('created_at', start).lt('created_at', end)

    const map: Record<string, number> = {}
    ;(data ?? []).forEach((o: any) => {
      const d = new Date(o.created_at).getDate().toString()
      map[d] = (map[d] || 0) + Number(o.total)
    })
    setMonthSales(map)
  }

  const isToday = (d: Date) =>
    d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()

  const isSelected = (d: Date) =>
    d.getDate() === selectedDate.getDate() && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear()

  function buildCalendar() {
    const firstDay = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay()
    const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate()
    const cells: (Date | null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(calMonth.getFullYear(), calMonth.getMonth(), d))
    return cells
  }

  const isFuture = (d: Date) => d > today

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length || !payload[0].value) return null
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs">
        <p className="text-zinc-400 mb-0.5">{label}</p>
        <p className="text-amber-400 font-bold">{fmt(payload[0].value)}</p>
      </div>
    )
  }

  const selectedLabel = isToday(selectedDate)
    ? 'Hoy'
    : selectedDate.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="flex flex-col gap-5">

      {/* Selector de fecha */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <button
            onClick={() => setCalendarOpen(!calendarOpen)}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white transition"
          >
            <Calendar size={14} className="text-amber-400" />
            <span className="font-medium">{selectedLabel}</span>
            <ChevronRight size={14} className={`text-zinc-500 transition-transform ${calendarOpen ? 'rotate-90' : ''}`} />
          </button>

          {/* Calendario dropdown */}
          {calendarOpen && (
            <div className="absolute top-12 left-0 z-50 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-4 w-72">

              {/* Nav mes */}
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition">
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-semibold text-white">
                  {MESES[calMonth.getMonth()]} {calMonth.getFullYear()}
                </span>
                <button
                  onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
                  disabled={calMonth.getMonth() === today.getMonth() && calMonth.getFullYear() === today.getFullYear()}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Días semana */}
              <div className="grid grid-cols-7 mb-2">
                {DIAS.map(d => (
                  <div key={d} className="text-center text-[10px] text-zinc-600 font-medium py-1">{d}</div>
                ))}
              </div>

              {/* Días del mes */}
              <div className="grid grid-cols-7 gap-0.5">
                {buildCalendar().map((date, i) => {
                  if (!date) return <div key={i} />
                  const hasSales  = !!monthSales[date.getDate().toString()]
                  const salesAmt  = monthSales[date.getDate().toString()] || 0
                  const future    = isFuture(date)
                  const selected  = isSelected(date)
                  const todayDate = isToday(date)

                  return (
                    <button
                      key={i}
                      disabled={future}
                      onClick={() => { setSelectedDate(date); setCalendarOpen(false) }}
                      title={hasSales ? fmt(salesAmt) : undefined}
                      className={`
                        relative flex flex-col items-center justify-center rounded-lg py-1.5 text-xs transition
                        ${future ? 'opacity-30 cursor-not-allowed text-zinc-600' :
                          selected ? 'bg-amber-500 text-zinc-950 font-bold' :
                          todayDate ? 'bg-zinc-700 text-white font-semibold' :
                          'hover:bg-zinc-800 text-zinc-300'}
                      `}
                    >
                      <span>{date.getDate()}</span>
                      {hasSales && !selected && (
                        <span className="w-1 h-1 rounded-full bg-amber-400 mt-0.5" />
                      )}
                      {hasSales && selected && (
                        <span className="w-1 h-1 rounded-full bg-zinc-950 mt-0.5" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Leyenda */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-[10px] text-zinc-500">Días con ventas</span>
                <span className="ml-auto text-[10px] text-zinc-600">Hover para ver monto</span>
              </div>
            </div>
          )}
        </div>

        {!isToday(selectedDate) && (
          <button onClick={() => { setSelectedDate(today); setCalMonth(new Date(today.getFullYear(), today.getMonth(), 1)) }}
            className="text-xs text-amber-400 hover:text-amber-300 transition">
            Volver a hoy
          </button>
        )}
      </div>

      {/* Stats */}
      {data ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: `Ventas ${selectedLabel.toLowerCase()}`, value: fmt(data.dayTotal), color: 'text-amber-400' },
              { label: `Órdenes ${selectedLabel.toLowerCase()}`, value: data.dayCount.toString(), color: 'text-blue-400' },
              { label: 'Stock bajo', value: data.lowStock.length.toString(), color: 'text-orange-400' },
              { label: 'Ticket promedio', value: data.dayCount > 0 ? fmt(data.dayTotal / data.dayCount) : '$0', color: 'text-green-400' },
            ].map(s => (
              <div key={s.label} className="bg-zinc-800/50 border border-zinc-700/40 rounded-xl p-4">
                <p className="text-xs text-zinc-500">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Gráfico por hora */}
          <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-4">
            <p className="text-sm font-medium text-white mb-4">
              Ventas por hora — {selectedLabel}
            </p>
            {data.hourlyData.every((d: any) => d.total === 0) ? (
              <div className="h-40 flex items-center justify-center text-zinc-600 text-sm">
                Sin ventas registradas este día
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.hourlyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <XAxis dataKey="hour" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" radius={[4,4,0,0]}>
                    {data.hourlyData.map((_: any, i: number) => (
                      <Cell key={i} fill="#f59e0b" fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Órdenes del día + stock bajo */}
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
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[o.status] ?? ''}`}>
                      {o.status}
                    </span>
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
    </div>
  )
}
