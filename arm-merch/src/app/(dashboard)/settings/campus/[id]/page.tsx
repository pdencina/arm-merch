'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, MapPin, Users, Package, TrendingUp, Clock, ShoppingCart } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const CAMPUS_COLORS: Record<string, { text: string; border: string; dot: string; chart: string }> = {
  'ARM Santiago':    { text:'text-blue-400',   border:'border-blue-500/30',   dot:'bg-blue-400',   chart:'#3B8BD4' },
  'ARM Puente Alto': { text:'text-purple-400', border:'border-purple-500/30', dot:'bg-purple-400', chart:'#7F77DD' },
  'ARM Punta Arenas':{ text:'text-teal-400',   border:'border-teal-500/30',   dot:'bg-teal-400',   chart:'#1D9E75' },
  'ARM Montevideo':  { text:'text-amber-400',  border:'border-amber-500/30',  dot:'bg-amber-400',  chart:'#EF9F27' },
  'ARM Maracaibo':   { text:'text-red-400',    border:'border-red-500/30',    dot:'bg-red-400',    chart:'#E24B4A' },
}
const DEFAULT_COLOR = { text:'text-zinc-400', border:'border-zinc-700', dot:'bg-zinc-500', chart:'#888' }

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(n)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('es-CL', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })

export default function CampusDetailPage() {
  const { id }   = useParams()
  const router   = useRouter()
  const [campus, setCampus] = useState<any>(null)
  const [data, setData]     = useState<any>(null)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: c } = await supabase.from('campus').select('*').eq('id', id).single()
      if (!c) return
      setCampus(c)

      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

      const [
        { data: users },
        { data: inv },
        { data: orders },
        { data: movements },
      ] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role, active, email').eq('campus_id', id),
        supabase.from('products_with_stock').select('*').eq('campus_id', id).order('stock'),
        supabase.from('orders')
          .select('id, order_number, total, status, created_at, notes, payment_method, seller:profiles!inner(full_name, campus_id), order_items(quantity, unit_price, product:products(name))')
          .eq('status', 'completada')
          .eq('seller.campus_id', id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('inventory_movements')
          .select('id, type, quantity, notes, created_at, product:products(name)')
          .in('product_id', [])
          .limit(10),
      ])

      // Ventas por día últimos 30 días
      const days30: { day: string; total: number }[] = []
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        const ds = d.toLocaleDateString('es-CL', { day:'2-digit', month:'short' })
        const dt = (orders ?? []).filter((o: any) =>
          new Date(o.created_at).toDateString() === d.toDateString()
        ).reduce((s: number, o: any) => s + Number(o.total), 0)
        days30.push({ day: ds, total: dt })
      }

      // Top productos
      const productMap: Record<string, { name: string; qty: number; revenue: number }> = {}
      ;(orders ?? []).forEach((o: any) => {
        ;(o.order_items ?? []).forEach((item: any) => {
          const name = item.product?.name ?? '—'
          if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0 }
          productMap[name].qty += item.quantity
          productMap[name].revenue += item.quantity * item.unit_price
        })
      })
      const topProducts = Object.values(productMap).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 10)

      // Stats por vendedor
      const sellerMap: Record<string, { name: string; count: number; total: number }> = {}
      ;(orders ?? []).forEach((o: any) => {
        const name = o.seller?.full_name ?? '—'
        if (!sellerMap[name]) sellerMap[name] = { name, count: 0, total: 0 }
        sellerMap[name].count++
        sellerMap[name].total += Number(o.total)
      })
      const sellers = Object.values(sellerMap).sort((a: any, b: any) => b.total - a.total)

      setData({
        users:     users ?? [],
        inv:       inv ?? [],
        orders:    orders ?? [],
        topProducts,
        sellers,
        days30,
        totalSales: (orders ?? []).reduce((s: number, o: any) => s + Number(o.total), 0),
        lowStock:   (inv ?? []).filter((i: any) => (i.stock ?? 0) <= 5 && (i.stock ?? 0) > 0),
        outStock:   (inv ?? []).filter((i: any) => (i.stock ?? 0) === 0),
      })
    }
    load()
  }, [id])

  const color = campus ? (CAMPUS_COLORS[campus.name] ?? DEFAULT_COLOR) : DEFAULT_COLOR

  if (!campus || !data) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition text-sm">
          <ArrowLeft size={16} />Volver
        </button>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${color.dot}`} />
          <h1 className={`text-xl font-bold ${color.text}`}>{campus.name}</h1>
          {(campus.city || campus.country) && (
            <div className="flex items-center gap-1.5">
              <MapPin size={13} className="text-zinc-600" />
              <span className="text-sm text-zinc-500">{[campus.city, campus.country].filter(Boolean).join(', ')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label:'Ventas del mes', value:fmt(data.totalSales), icon:TrendingUp, color:'text-amber-400' },
          { label:'Órdenes',       value:data.orders.length.toString(), icon:ShoppingCart, color:'text-blue-400' },
          { label:'Voluntarios',   value:data.users.length.toString(), icon:Users, color:'text-green-400' },
          { label:'Productos',     value:data.inv.length.toString(), icon:Package, color:'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-800/50 border border-zinc-700/40 rounded-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-700/60 flex items-center justify-center shrink-0">
              <s.icon size={14} className={s.color} />
            </div>
            <div>
              <p className="text-xs text-zinc-500">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Gráfico 30 días */}
      <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-4">
        <p className="text-sm font-medium text-white mb-4">Ventas últimos 30 días</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={data.days30} margin={{ top:0, right:0, bottom:0, left:0 }}>
            <XAxis dataKey="day" tick={{ fill:'#52525b', fontSize:9 }} axisLine={false} tickLine={false}
              interval={4} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background:'#18181b', border:'1px solid #3f3f46', borderRadius:8, fontSize:11 }}
              formatter={(v: any) => [fmt(v), 'Ventas']}
            />
            <Bar dataKey="total" radius={[3,3,0,0]}>
              {data.days30.map((_: any, i: number) => <Cell key={i} fill={color.chart} fillOpacity={0.8} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top productos */}
        <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-4">
          <p className="text-sm font-medium text-white mb-3">Top productos vendidos</p>
          {data.topProducts.length === 0 ? (
            <p className="text-zinc-600 text-xs text-center py-6">Sin ventas registradas</p>
          ) : data.topProducts.map((p: any, i: number) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-zinc-700/30 last:border-0">
              <span className={`text-xs font-bold ${color.text} w-5 text-center`}>#{i+1}</span>
              <span className="text-xs text-zinc-300 flex-1 truncate">{p.name}</span>
              <span className="text-xs text-zinc-500">{p.qty} uds.</span>
              <span className={`text-xs font-bold ${color.text}`}>{fmt(p.revenue)}</span>
            </div>
          ))}
        </div>

        {/* Equipo */}
        <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-4">
          <p className="text-sm font-medium text-white mb-3">Equipo del campus</p>
          {data.users.length === 0 ? (
            <p className="text-zinc-600 text-xs text-center py-6">Sin usuarios asignados</p>
          ) : data.users.map((u: any) => {
            const seller = data.sellers.find((s: any) => s.name === u.full_name)
            return (
              <div key={u.id} className="flex items-center gap-3 py-2 border-b border-zinc-700/30 last:border-0">
                <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-amber-400">{u.full_name?.[0]?.toUpperCase() ?? '?'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-200 font-medium truncate">{u.full_name}</p>
                  <p className="text-[10px] text-zinc-500 capitalize">{u.role?.replace('_',' ')} · {u.email}</p>
                </div>
                {seller && (
                  <div className="text-right">
                    <p className={`text-xs font-bold ${color.text}`}>{fmt(seller.total)}</p>
                    <p className="text-[10px] text-zinc-500">{seller.count} ventas</p>
                  </div>
                )}
                <div className={`w-1.5 h-1.5 rounded-full ${u.active !== false ? 'bg-green-400' : 'bg-zinc-600'}`} />
              </div>
            )
          })}
        </div>

        {/* Inventario del campus */}
        <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-4">
          <p className="text-sm font-medium text-white mb-3">
            Inventario
            {data.outStock.length > 0 && <span className="ml-2 text-xs text-red-400">· {data.outStock.length} sin stock</span>}
            {data.lowStock.length > 0 && <span className="ml-1 text-xs text-orange-400">· {data.lowStock.length} bajo</span>}
          </p>
          <div className="max-h-52 overflow-y-auto flex flex-col gap-0">
            {data.inv.length === 0 ? (
              <p className="text-zinc-600 text-xs text-center py-6">Sin inventario asignado a este campus</p>
            ) : data.inv.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-zinc-700/20 last:border-0">
                <span className="text-xs text-zinc-300 truncate flex-1">{p.name}</span>
                <span className={`text-xs font-bold ml-2 ${
                  (p.stock ?? 0) === 0 ? 'text-red-400' :
                  (p.stock ?? 0) <= 5 ? 'text-orange-400' : 'text-green-400'
                }`}>{p.stock ?? 0} uds.</span>
              </div>
            ))}
          </div>
        </div>

        {/* Últimas órdenes */}
        <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-4">
          <p className="text-sm font-medium text-white mb-3">Últimas órdenes</p>
          {data.orders.length === 0 ? (
            <p className="text-zinc-600 text-xs text-center py-6">Sin órdenes</p>
          ) : data.orders.slice(0, 8).map((o: any) => (
            <div key={o.id} className="flex items-center gap-2 py-1.5 border-b border-zinc-700/20 last:border-0">
              <span className="text-[10px] text-zinc-600 font-mono w-8">#{o.order_number}</span>
              <span className="text-xs text-zinc-400 flex-1 truncate">
                {o.notes?.replace('Cliente: ','').split(' | ')[0] ?? '—'}
              </span>
              <span className="text-[10px] text-zinc-500 hidden sm:block">{fmtDate(o.created_at)}</span>
              <span className={`text-xs font-bold ${color.text}`}>{fmt(o.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
