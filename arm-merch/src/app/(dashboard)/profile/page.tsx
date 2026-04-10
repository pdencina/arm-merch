'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, TrendingUp, ShoppingBag, Award } from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin', admin: 'Administrador', voluntario: 'Voluntario'
}

const CAMPUS_COLORS: Record<string, string> = {
  'ARM Santiago':    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'ARM Puente Alto': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'ARM Punta Arenas':'bg-teal-500/10 text-teal-400 border-teal-500/20',
  'ARM Montevideo':  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'ARM Maracaibo':   'bg-red-500/10 text-red-400 border-red-500/20',
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [stats, setStats]     = useState<any>(null)
  const [orders, setOrders]   = useState<any[]>([])

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const [{ data: p }, { data: o }, { data: campus }] = await Promise.all([
        supabase.from('profiles').select('*, campus:campus(name)').eq('id', session.user.id).single(),
        supabase.from('orders').select('id, total, status, created_at, order_number, payment_method, notes')
          .eq('seller_id', session.user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('campus').select('id, name'),
      ])

      const myOrders = (o ?? []) as any[]
      const completed = myOrders.filter((x: any) => x.status === 'completada')
      const today = new Date().toDateString()
      const todayOrders = completed.filter((x: any) => new Date(x.created_at).toDateString() === today)

      setProfile(p)
      setOrders(myOrders)
      setStats({
        total:      completed.reduce((s: number, x: any) => s + Number(x.total), 0),
        count:      completed.length,
        todayTotal: todayOrders.reduce((s: number, x: any) => s + Number(x.total), 0),
        todayCount: todayOrders.length,
        avg:        completed.length ? completed.reduce((s: number, x: any) => s + Number(x.total), 0) / completed.length : 0,
      })
    }
    load()
  }, [])

  const initials = profile?.full_name?.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'
  const campusName = profile?.campus?.name ?? null
  const campusStyle = campusName ? (CAMPUS_COLORS[campusName] ?? 'bg-zinc-700/50 text-zinc-400 border-zinc-600') : null

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* Header perfil */}
      <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-amber-500/20 border-2 border-amber-500/30 flex items-center justify-center shrink-0">
          <span className="text-lg font-bold text-amber-400">{initials}</span>
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">{profile?.full_name ?? '—'}</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{profile?.email ?? '—'}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${
              profile?.role === 'super_admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
              profile?.role === 'admin' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
              'bg-green-500/10 text-green-400 border-green-500/20'
            }`}>
              {ROLE_LABEL[profile?.role ?? 'voluntario']}
            </span>
            {campusName && (
              <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${campusStyle}`}>
                {campusName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats personales */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: TrendingUp, label: 'Mis ventas hoy',     value: fmt(stats.todayTotal), sub: `${stats.todayCount} órdenes`, color: 'text-amber-400' },
            { icon: ShoppingBag,label: 'Total mis ventas',   value: fmt(stats.total),      sub: `${stats.count} órdenes totales`, color: 'text-green-400' },
            { icon: Award,      label: 'Ticket promedio',    value: fmt(stats.avg),         sub: 'por venta', color: 'text-blue-400' },
            { icon: User,       label: 'Órdenes del mes',    value: stats.count.toString(), sub: 'completadas', color: 'text-purple-400' },
          ].map(s => (
            <div key={s.label} className="bg-zinc-800/50 border border-zinc-700/40 rounded-xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-700/60 flex items-center justify-center shrink-0 mt-0.5">
                <s.icon size={14} className={s.color} />
              </div>
              <div>
                <p className="text-xs text-zinc-500">{s.label}</p>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-zinc-600">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mis últimas ventas */}
      <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-4">
        <p className="text-sm font-medium text-white mb-3">Mis últimas ventas</p>
        {orders.length === 0 ? (
          <p className="text-zinc-600 text-xs py-4 text-center">Sin ventas registradas</p>
        ) : orders.slice(0, 10).map(o => (
          <div key={o.id} className="flex items-center gap-3 py-2 border-b border-zinc-700/30 last:border-0">
            <span className="text-xs text-zinc-600 font-mono w-10">#{o.order_number}</span>
            <span className="text-xs text-zinc-400 flex-1 truncate">
              {o.notes?.replace('Cliente: ', '').split(' | ')[0] ?? '—'}
            </span>
            <span className="text-xs text-zinc-500 hidden sm:block">{fmtDate(o.created_at)}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              o.status === 'completada' ? 'text-green-400 bg-green-500/10' :
              o.status === 'pendiente'  ? 'text-amber-400 bg-amber-500/10' :
              'text-red-400 bg-red-500/10'
            }`}>{o.status}</span>
            <span className="text-xs font-bold text-amber-400 min-w-[70px] text-right">{fmt(o.total)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
