'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Building2, Target, TrendingUp, Package, Plus, MapPin,
  ArrowUpRight, ArrowDownRight, Trophy, DollarSign,
} from 'lucide-react'
import { clsx } from 'clsx'

interface CampusGoal {
  id: string
  campus_id: string
  month: number
  year: number
  target_amount: number
  target_orders: number | null
  current_amount: number
  current_orders: number
  progress: number
  remaining: number
  campus: { id: string; name: string }
}

interface CampusSales {
  campus_id: string
  campus_name: string
  total: number
  orders: number
  avg_ticket: number
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

const CAMPUS_COLORS: Record<string, string> = {
  'ARM Santiago': '#60a5fa',
  'ARM Puente Alto': '#c084fc',
  'ARM Punta Arenas': '#2dd4bf',
  'ARM Montevideo': '#fbbf24',
  'ARM Maracaibo': '#f87171',
}

export default function CampusConsolidatedPage() {
  const [goals, setGoals] = useState<CampusGoal[]>([])
  const [campusSales, setCampusSales] = useState<CampusSales[]>([])
  const [campuses, setCampuses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [formData, setFormData] = useState({
    campus_id: '',
    target_amount: '',
    target_orders: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }

    const token = session.access_token

    // Load goals
    const goalsRes = await fetch(
      `/api/campus/goals?month=${currentMonth}&year=${currentYear}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const goalsData = await goalsRes.json()
    setGoals(goalsData.goals ?? [])

    // Load campus list
    const { data: campusData } = await supabase
      .from('campus')
      .select('id, name, city, country')
      .eq('active', true)
      .order('name')
    setCampuses(campusData ?? [])

    // Load aggregated sales for this month by campus
    const startDate = new Date(currentYear, currentMonth - 1, 1).toISOString()
    const { data: orders } = await supabase
      .from('orders')
      .select('campus_id, total')
      .eq('status', 'paid')
      .gte('created_at', startDate)

    const salesMap: Record<string, { total: number; count: number }> = {}
    ;(orders ?? []).forEach((o: any) => {
      const cid = o.campus_id ?? 'none'
      if (!salesMap[cid]) salesMap[cid] = { total: 0, count: 0 }
      salesMap[cid].total += Number(o.total ?? 0)
      salesMap[cid].count += 1
    })

    const salesList = (campusData ?? []).map((c: any) => {
      const s = salesMap[c.id] ?? { total: 0, count: 0 }
      return {
        campus_id: c.id,
        campus_name: c.name,
        total: s.total,
        orders: s.count,
        avg_ticket: s.count > 0 ? s.total / s.count : 0,
      }
    }).sort((a: CampusSales, b: CampusSales) => b.total - a.total)

    setCampusSales(salesList)
    setLoading(false)
  }

  async function handleCreateGoal() {
    if (!formData.campus_id || !formData.target_amount) return
    setSubmitting(true)

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSubmitting(false); return }

    const res = await fetch('/api/campus/goals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        campus_id: formData.campus_id,
        month: currentMonth,
        year: currentYear,
        target_amount: Number(formData.target_amount),
        target_orders: formData.target_orders ? Number(formData.target_orders) : null,
        notes: formData.notes || null,
      }),
    })

    setSubmitting(false)
    if (res.ok) {
      setShowGoalForm(false)
      setFormData({ campus_id: '', target_amount: '', target_orders: '', notes: '' })
      loadData()
    }
  }

  const totalGlobal = campusSales.reduce((s, c) => s + c.total, 0)
  const totalOrders = campusSales.reduce((s, c) => s + c.orders, 0)
  const globalAvgTicket = totalOrders > 0 ? totalGlobal / totalOrders : 0

  const monthName = now.toLocaleDateString('es-CL', { month: 'long' })

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Building2 size={20} className="text-violet-400" />
            Consolidado Multi-Campus
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Vista panorámica de todos los campus — {monthName} {currentYear}
          </p>
        </div>

        <button
          onClick={() => setShowGoalForm(true)}
          className="flex items-center gap-2 rounded-2xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-400"
        >
          <Target size={16} />
          Definir meta
        </button>
      </div>

      {/* Global metrics */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
            <DollarSign size={18} className="text-amber-400" />
          </div>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Ventas globales</p>
          <p className="mt-0.5 text-2xl font-black text-white">{fmt(totalGlobal)}</p>
          <p className="mt-1 text-xs text-zinc-500">{totalOrders} órdenes · {monthName}</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-500/10">
            <TrendingUp size={18} className="text-green-400" />
          </div>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Ticket promedio</p>
          <p className="mt-0.5 text-2xl font-black text-green-400">{fmt(globalAvgTicket)}</p>
          <p className="mt-1 text-xs text-zinc-500">Global todos los campus</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10">
            <MapPin size={18} className="text-violet-400" />
          </div>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Campus activos</p>
          <p className="mt-0.5 text-2xl font-black text-violet-400">{campusSales.filter(c => c.total > 0).length}</p>
          <p className="mt-1 text-xs text-zinc-500">Con ventas este mes</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10">
            <Trophy size={18} className="text-blue-400" />
          </div>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Líder del mes</p>
          <p className="mt-0.5 text-lg font-black text-blue-400 truncate">
            {campusSales[0]?.campus_name ?? '—'}
          </p>
          <p className="mt-1 text-xs text-zinc-500">{fmt(campusSales[0]?.total ?? 0)}</p>
        </div>
      </div>

      {/* Metas de venta */}
      {goals.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
            <Target size={16} className="text-violet-400" />
            Metas del mes
          </h2>

          <div className="space-y-4">
            {goals.map((goal) => {
              const color = CAMPUS_COLORS[goal.campus?.name] ?? '#71717a'
              const isAchieved = goal.progress >= 100

              return (
                <div key={goal.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-sm font-semibold text-white">{goal.campus?.name}</span>
                      {isAchieved && (
                        <span className="rounded-lg bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-400">
                          🎉 Meta cumplida
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-white">{fmt(goal.current_amount)}</span>
                      <span className="text-xs text-zinc-500"> / {fmt(goal.target_amount)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, goal.progress)}%`,
                          backgroundColor: isAchieved ? '#34d399' : color,
                        }}
                      />
                    </div>
                    <span className={clsx(
                      'text-xs font-bold min-w-[3rem] text-right',
                      isAchieved ? 'text-green-400' : 'text-zinc-300'
                    )}>
                      {goal.progress}%
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-[10px] text-zinc-500">
                    <span>{goal.current_orders} órdenes</span>
                    {!isAchieved && <span>Faltan {fmt(goal.remaining)}</span>}
                    {goal.target_orders && <span>Meta: {goal.target_orders} órdenes</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Ranking por campus */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
          <Building2 size={16} className="text-amber-400" />
          Rendimiento por campus
        </h2>

        {campusSales.length === 0 ? (
          <p className="text-sm text-zinc-500">Sin datos de ventas</p>
        ) : (
          <div className="space-y-3">
            {campusSales.map((campus, i) => {
              const color = CAMPUS_COLORS[campus.campus_name] ?? '#71717a'
              const maxTotal = campusSales[0]?.total ?? 1
              const pct = maxTotal > 0 ? (campus.total / maxTotal) * 100 : 0

              return (
                <div key={campus.campus_id} className="rounded-xl border border-zinc-800/50 bg-zinc-950/50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={clsx(
                        'flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-black',
                        i === 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-500'
                      )}>
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">{campus.campus_name}</p>
                        <p className="text-[10px] text-zinc-500">{campus.orders} órdenes · Ticket: {fmt(campus.avg_ticket)}</p>
                      </div>
                    </div>

                    <p className="text-sm font-bold text-white">{fmt(campus.total)}</p>
                  </div>

                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Formulario de meta */}
      {showGoalForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-zinc-700 bg-zinc-900 p-6">
            <h2 className="text-lg font-bold text-white">Definir meta mensual</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {monthName} {currentYear}
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-400">Campus</label>
                <select
                  value={formData.campus_id}
                  onChange={(e) => setFormData({ ...formData, campus_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white"
                >
                  <option value="">Seleccionar campus...</option>
                  {campuses.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400">Meta de ventas (CLP)</label>
                <input
                  type="number"
                  min={0}
                  value={formData.target_amount}
                  onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                  placeholder="ej: 500000"
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400">Meta de órdenes (opcional)</label>
                <input
                  type="number"
                  min={0}
                  value={formData.target_orders}
                  onChange={(e) => setFormData({ ...formData, target_orders: e.target.value })}
                  placeholder="ej: 50"
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400">Notas (opcional)</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="ej: Meta evento Youth"
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowGoalForm(false)}
                  className="flex-1 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateGoal}
                  disabled={submitting || !formData.campus_id || !formData.target_amount}
                  className="flex-1 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-400 disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : 'Guardar meta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
