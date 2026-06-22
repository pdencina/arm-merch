'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Clock3, CreditCard, Banknote, Landmark, Wallet } from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
  }).format(n || 0)

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const PM_ICON: Record<string, { icon: React.ElementType; color: string }> = {
  efectivo: { icon: Banknote, color: 'text-emerald-400' },
  transferencia: { icon: Landmark, color: 'text-blue-400' },
  solo: { icon: CreditCard, color: 'text-violet-400' },
  sumup: { icon: CreditCard, color: 'text-violet-400' },
  link: { icon: Wallet, color: 'text-amber-400' },
}

function getMonday(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

interface WeeklyViewProps {
  orders: Array<{
    id: string
    order_number: number | string
    total: number
    created_at: string
    payment_method: string | null
    campus_id?: string | null
  }>
  campusMap?: Map<string, string>
}

export default function WeeklyView({ orders, campusMap }: WeeklyViewProps) {
  const today = new Date()
  const [weekOffset, setWeekOffset] = useState(0)
  const [expandedDay, setExpandedDay] = useState<number | null>(null)

  const weekStart = useMemo(() => {
    const monday = getMonday(today)
    monday.setDate(monday.getDate() + weekOffset * 7)
    return monday
  }, [weekOffset])

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + i)
      return date
    })
  }, [weekStart])

  const weekData = useMemo(() => {
    return weekDays.map((date, index) => {
      const dayStart = new Date(date)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(date)
      dayEnd.setHours(23, 59, 59, 999)

      const dayOrders = orders.filter(o => {
        const d = new Date(o.created_at)
        return d >= dayStart && d <= dayEnd
      })

      const total = dayOrders.reduce((s, o) => s + Number(o.total ?? 0), 0)
      const isToday = isSameDay(date, today)

      return {
        index,
        date,
        dayName: DAY_NAMES[index],
        dateStr: date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }),
        total,
        count: dayOrders.length,
        orders: dayOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        isToday,
        isFuture: date > today,
      }
    })
  }, [weekDays, orders])

  const weekTotal = weekData.reduce((s, d) => s + d.total, 0)
  const weekOrders = weekData.reduce((s, d) => s + d.count, 0)
  const maxDayTotal = Math.max(...weekData.map(d => d.total), 1)

  const weekLabel = `${weekDays[0].toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} — ${weekDays[6].toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}`

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-blue-400" />
          <div>
            <h2 className="font-semibold text-white">Vista semanal</h2>
            <p className="mt-0.5 text-xs text-zinc-500">{weekLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="mr-3 text-right">
            <p className="text-xs text-zinc-500">{weekOrders} ventas</p>
            <p className="text-sm font-bold text-amber-400">{fmt(weekTotal)}</p>
          </div>
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="rounded-lg border border-zinc-700 p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
          >
            <ChevronLeft size={16} />
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="rounded-lg border border-zinc-700 px-2 py-1.5 text-[10px] font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
            >
              Hoy
            </button>
          )}
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            disabled={weekOffset >= 0}
            className="rounded-lg border border-zinc-700 p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekData.map((day) => (
          <button
            key={day.index}
            onClick={() => setExpandedDay(expandedDay === day.index ? null : day.index)}
            disabled={day.isFuture}
            className={`relative flex flex-col items-center rounded-xl border p-3 transition ${
              day.isToday
                ? 'border-amber-500/40 bg-amber-500/10'
                : expandedDay === day.index
                  ? 'border-blue-500/40 bg-blue-500/10'
                  : 'border-zinc-800 bg-zinc-950/50 hover:border-zinc-700 hover:bg-zinc-800/50'
            } ${day.isFuture ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span className={`text-[10px] font-bold uppercase tracking-widest ${
              day.isToday ? 'text-amber-400' : 'text-zinc-500'
            }`}>
              {day.dayName}
            </span>
            <span className={`mt-0.5 text-xs ${day.isToday ? 'text-amber-300' : 'text-zinc-400'}`}>
              {day.dateStr}
            </span>

            {/* Mini bar */}
            <div className="mt-2 h-10 w-full flex items-end justify-center">
              <div
                className={`w-5 rounded-t transition-all ${
                  day.isToday ? 'bg-amber-500' : day.total > 0 ? 'bg-blue-500/60' : 'bg-zinc-800'
                }`}
                style={{ height: `${Math.max(4, (day.total / maxDayTotal) * 40)}px` }}
              />
            </div>

            <span className={`mt-1.5 text-xs font-bold ${
              day.total > 0
                ? day.isToday ? 'text-amber-300' : 'text-white'
                : 'text-zinc-600'
            }`}>
              {day.total > 0 ? fmt(day.total) : '—'}
            </span>
            <span className="text-[10px] text-zinc-600">
              {day.count > 0 ? `${day.count} venta${day.count > 1 ? 's' : ''}` : ''}
            </span>

            {day.isToday && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
            )}
          </button>
        ))}
      </div>

      {/* Expanded day detail */}
      {expandedDay !== null && weekData[expandedDay] && weekData[expandedDay].orders.length > 0 && (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold text-zinc-400">
              {weekData[expandedDay].date.toLocaleDateString('es-CL', {
                weekday: 'long', day: 'numeric', month: 'long'
              })}
            </p>
            <p className="text-xs font-bold text-amber-400">
              {fmt(weekData[expandedDay].total)} · {weekData[expandedDay].count} ventas
            </p>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1.5">
            {weekData[expandedDay].orders.map((order) => {
              const pmConfig = PM_ICON[order.payment_method ?? ''] ?? { icon: Wallet, color: 'text-zinc-400' }
              const Icon = pmConfig.icon
              const time = new Date(order.created_at).toLocaleTimeString('es-CL', {
                hour: '2-digit', minute: '2-digit'
              })
              const campus = order.campus_id && campusMap ? campusMap.get(order.campus_id) : null

              return (
                <div key={order.id} className="flex items-center gap-3 rounded-lg bg-zinc-900/60 px-3 py-2">
                  <Icon size={14} className={pmConfig.color} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-300">#{order.order_number}</span>
                      {campus && <span className="text-[10px] text-zinc-600">{campus}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Clock3 size={11} />
                    <span>{time}</span>
                  </div>
                  <span className="text-xs font-bold text-white">{fmt(order.total)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {expandedDay !== null && weekData[expandedDay] && weekData[expandedDay].orders.length === 0 && (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-center">
          <p className="text-sm text-zinc-600">Sin ventas este día</p>
        </div>
      )}
    </div>
  )
}
