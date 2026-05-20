'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, X, Loader2, MapPin, Users, Package, TrendingUp, Edit2, Check,
         AlertTriangle, Clock, ArrowRight, BarChart2 } from 'lucide-react'
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis } from 'recharts'

const CAMPUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string; chart: string }> = {
  'ARM Santiago':    { bg:'bg-blue-950/40',   text:'text-blue-300',   border:'border-blue-500/30',   dot:'bg-blue-400',   chart:'#60a5fa' },
  'ARM Puente Alto': { bg:'bg-purple-950/40', text:'text-purple-300', border:'border-purple-500/30', dot:'bg-purple-400', chart:'#c084fc' },
  'ARM Punta Arenas':{ bg:'bg-teal-950/40',   text:'text-teal-300',   border:'border-teal-500/30',   dot:'bg-teal-400',   chart:'#2dd4bf' },
  'ARM Montevideo':  { bg:'bg-amber-950/40',  text:'text-amber-300',  border:'border-amber-500/30',  dot:'bg-amber-400',  chart:'#fbbf24' },
  'ARM Maracaibo':   { bg:'bg-red-950/40',    text:'text-red-300',    border:'border-red-500/30',    dot:'bg-red-400',    chart:'#f87171' },
}
const DEFAULT_COLOR = { bg:'bg-zinc-800/50', text:'text-zinc-300', border:'border-zinc-700/40', dot:'bg-zinc-500', chart:'#71717a' }

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(n)

export default function CampusAdminPage() {
  const router = useRouter()
  const [campus, setCampus]         = useState<any[]>([])
  const [stats, setStats]           = useState<Record<string, any>>({})
  const [loading, setLoading]       = useState(true)
  const [totalSales, setTotalSales] = useState(0)
  const [showNew, setShowNew]       = useState(false)
  const [newName, setNewName]       = useState('')
  const [newCity, setNewCity]       = useState('')
  const [newCountry, setNewCountry] = useState('Chile')
  const [saving, setSaving]         = useState(false)
  const [editId, setEditId]         = useState<string | null>(null)
  const [editName, setEditName]     = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const supabase = createClient()
    const { data: campusList } = await supabase.from('campus').select('*').order('name')
    if (!campusList) { setLoading(false); return }
    setCampus(campusList)

    const statsMap: Record<string, any> = {}
    let grandTotal = 0

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i))
      return d.toISOString().split('T')[0]
    })

    await Promise.all(campusList.map(async c => {
      const [
        { count: userCount },
        { data: inv },
        { data: orders },
        { data: topProducts },
        { data: users },
        { data: lastMovement },
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count:'exact', head:true }).eq('campus_id', c.id),
        supabase.from('inventory').select('stock, product:products(price, name)').eq('campus_id', c.id),
        supabase.from('orders').select('total, created_at, seller:profiles!inner(campus_id)')
          .eq('status','completada').eq('seller.campus_id', c.id).gte('created_at', monthStart),
        supabase.from('order_items').select('quantity, product:products(name), order:orders!inner(status, seller:profiles!inner(campus_id))')
          .eq('order.status','completada').eq('order.seller.campus_id', c.id).limit(50),
        supabase.from('profiles').select('id, full_name, role').eq('campus_id', c.id).eq('active', true).limit(5),
        supabase.from('inventory_movements').select('created_at, type, quantity, product:products(name)')
          .order('created_at', { ascending: false }).limit(1),
      ])

      const stockValue  = (inv ?? []).reduce((s: number, i: any) => s + (i.stock ?? 0) * (i.product?.price ?? 0), 0)
      const monthSales  = (orders ?? []).reduce((s: number, o: any) => s + Number(o.total), 0)
      grandTotal += monthSales

      // Top productos
      const prodMap: Record<string, { name: string; qty: number }> = {}
      ;(topProducts ?? []).forEach((item: any) => {
        const name = item.product?.name ?? '—'
        if (!prodMap[name]) prodMap[name] = { name, qty: 0 }
        prodMap[name].qty += item.quantity
      })
      const top3 = Object.values(prodMap).sort((a: any, b: any) => b.qty - a.qty).slice(0, 3)

      // Ventas últimos 7 días
      const salesByDay: Record<string, number> = {}
      last7.forEach(d => salesByDay[d] = 0)
      ;(orders ?? []).forEach((o: any) => {
        const d = new Date(o.created_at).toISOString().split('T')[0]
        if (d in salesByDay) salesByDay[d] += Number(o.total)
      })
      const trend = last7.map(d => ({
        day: new Date(d).toLocaleDateString('es-CL', { day:'2-digit', month:'2-digit' }),
        total: salesByDay[d],
      }))

      // Stock crítico
      const lowStock = (inv ?? []).filter((i: any) => (i.stock ?? 0) <= 3).map((i: any) => ({
        name: i.product?.name ?? '—', stock: i.stock ?? 0
      })).slice(0, 3)

      statsMap[c.id] = {
        users:       userCount ?? 0,
        usersList:   users ?? [],
        products:    (inv ?? []).length,
        stockValue,
        monthSales,
        orderCount:  (orders ?? []).length,
        top3,
        trend,
        lowStock,
        lastMovement: lastMovement?.[0] ?? null,
      }
    }))

    setStats(statsMap)
    setTotalSales(grandTotal)
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) { toast.error('El nombre es obligatorio'); return }
    setSaving(true)
    const { error } = await createClient().from('campus').insert({
      name: newName.trim(), city: newCity.trim() || null, country: newCountry.trim() || null, active: true
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(`Campus "${newName.trim()}" creado`)
    setNewName(''); setNewCity(''); setNewCountry('Chile'); setShowNew(false)
    loadAll()
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return
    await createClient().from('campus').update({ name: editName.trim() }).eq('id', id)
    toast.success('Campus renombrado')
    setEditId(null); setEditName('')
    loadAll()
  }

  async function toggleActive(id: string, active: boolean) {
    await createClient().from('campus').update({ active }).eq('id', id)
    toast.success(active ? 'Campus activado' : 'Campus desactivado')
    loadAll()
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs">
        <p className="text-zinc-400">{label}</p>
        <p className="text-amber-400 font-bold">{fmt(payload[0].value)}</p>
      </div>
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Administración de campus</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{campus.filter(c => c.active).length} campus activos · Total mes: {fmt(totalSales)}</p>
        </div>
        <button onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl px-4 py-2.5 text-sm transition active:scale-[0.98]">
          <Plus size={15} />Nuevo campus
        </button>
      </div>

      {/* Barra de participación global */}
      {totalSales > 0 && (
        <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 size={14} className="text-zinc-400" />
            <span className="text-xs font-medium text-zinc-300">Participación en ventas — mes actual</span>
          </div>
          <div className="flex rounded-lg overflow-hidden h-5 gap-0.5">
            {campus.filter(c => c.active && (stats[c.id]?.monthSales ?? 0) > 0).map(c => {
              const pct = Math.round((stats[c.id]?.monthSales ?? 0) / totalSales * 100)
              const col = (CAMPUS_COLORS[c.name] ?? DEFAULT_COLOR).dot
              return (
                <div key={c.id} style={{ width:`${pct}%` }} title={`${c.name}: ${pct}%`}
                  className={`${col} transition-all`} />
              )
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {campus.filter(c => c.active).map(c => {
              const pct = totalSales > 0 ? Math.round((stats[c.id]?.monthSales ?? 0) / totalSales * 100) : 0
              const col = (CAMPUS_COLORS[c.name] ?? DEFAULT_COLOR)
              return (
                <div key={c.id} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="text-[10px] text-zinc-400">{c.name.replace('ARM ','')} {pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Form nuevo campus */}
      {showNew && (
        <form onSubmit={handleCreate} className="bg-zinc-800/30 border border-amber-500/20 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-white">Agregar nuevo campus</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Nombre *</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="ARM Ciudad"
                className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition" />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Ciudad</label>
              <input type="text" value={newCity} onChange={e => setNewCity(e.target.value)} placeholder="Santiago"
                className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition" />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">País</label>
              <input type="text" value={newCountry} onChange={e => setNewCountry(e.target.value)} placeholder="Chile"
                className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowNew(false)}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-xl text-sm transition">Cancelar</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 font-bold rounded-xl text-sm transition flex items-center gap-2">
              {saving && <Loader2 size={13} className="animate-spin" />}Crear campus
            </button>
          </div>
        </form>
      )}

      {/* Grid de campus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {campus.map(c => {
          const color   = CAMPUS_COLORS[c.name] ?? DEFAULT_COLOR
          const s       = stats[c.id] ?? {}
          const pct     = totalSales > 0 ? Math.round((s.monthSales ?? 0) / totalSales * 100) : 0
          const isEdit  = editId === c.id

          return (
            <div key={c.id} className={`rounded-2xl border p-5 flex flex-col gap-4 ${color.bg} ${color.border} transition ${!c.active ? 'opacity-50' : ''}`}>

              {/* Header campus */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className={`w-3 h-3 rounded-full shrink-0 ${color.dot}`} />
                  {isEdit ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key==='Enter') handleRename(c.id); if (e.key==='Escape') setEditId(null) }}
                        className="flex-1 bg-zinc-800 border border-zinc-600 text-white rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-amber-500" />
                      <button onClick={() => handleRename(c.id)} className={`${color.text}`}><Check size={15} /></button>
                      <button onClick={() => setEditId(null)} className="text-zinc-500"><X size={14} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <p className={`text-base font-bold truncate ${color.text}`}>{c.name}</p>
                      <button onClick={() => { setEditId(c.id); setEditName(c.name) }}
                        className="text-zinc-600 hover:text-zinc-400 shrink-0"><Edit2 size={12} /></button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {pct > 0 && <span className={`text-xs font-bold px-2 py-0.5 rounded-lg bg-black/20 ${color.text}`}>{pct}%</span>}
                  <button onClick={() => toggleActive(c.id, !c.active)}
                    className={`text-[9px] font-semibold px-2 py-1 rounded-lg border transition ${
                      c.active ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-zinc-700/50 text-zinc-500 border-zinc-600'}`}>
                    {c.active ? 'Activo' : 'Inactivo'}
                  </button>
                </div>
              </div>

              {/* Ubicación */}
              {(c.city || c.country) && (
                <div className="flex items-center gap-1.5 -mt-2">
                  <MapPin size={11} className="text-zinc-600" />
                  <span className="text-xs text-zinc-500">{[c.city, c.country].filter(Boolean).join(', ')}</span>
                </div>
              )}

              {/* Stats principales */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label:'Usuarios', value:s.users ?? 0, icon:<Users size={11}/> },
                  { label:'Productos', value:s.products ?? 0, icon:<Package size={11}/> },
                  { label:'Ventas mes', value:fmt(s.monthSales ?? 0), icon:<TrendingUp size={11}/> },
                  { label:'Órdenes', value:s.orderCount ?? 0, icon:<BarChart2 size={11}/> },
                ].map(stat => (
                  <div key={stat.label} className="bg-black/20 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-1 mb-1 text-zinc-500">{stat.icon}<span className="text-[9px]">{stat.label}</span></div>
                    <p className={`text-sm font-bold ${color.text}`}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Gráfico tendencia 7 días */}
              {s.trend && s.trend.some((d: any) => d.total > 0) ? (
                <div>
                  <p className="text-[10px] text-zinc-500 mb-1.5">Ventas últimos 7 días</p>
                  <ResponsiveContainer width="100%" height={60}>
                    <BarChart data={s.trend} margin={{ top:0, right:0, bottom:0, left:0 }}>
                      <XAxis dataKey="day" tick={{ fill:'#52525b', fontSize:9 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" fill={color.chart} radius={[3,3,0,0]} fillOpacity={0.8} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-12 flex items-center justify-center bg-black/10 rounded-xl">
                  <p className="text-[10px] text-zinc-600">Sin ventas en los últimos 7 días</p>
                </div>
              )}

              {/* Top productos */}
              {s.top3?.length > 0 && (
                <div>
                  <p className="text-[10px] text-zinc-500 mb-2">Top productos del mes</p>
                  <div className="flex flex-col gap-1.5">
                    {s.top3.map((p: any, i: number) => (
                      <div key={p.name} className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold w-4 ${color.text}`}>#{i+1}</span>
                        <span className="text-xs text-zinc-300 flex-1 truncate">{p.name}</span>
                        <span className={`text-xs font-semibold ${color.text}`}>{p.qty} uds.</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Voluntarios activos */}
              {s.usersList?.length > 0 && (
                <div>
                  <p className="text-[10px] text-zinc-500 mb-2">Equipo asignado</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {s.usersList.map((u: any) => (
                      <div key={u.id} className="flex items-center gap-1.5 bg-black/20 rounded-lg px-2 py-1">
                        <div className={`w-4 h-4 rounded-full ${color.dot} flex items-center justify-center`}>
                          <span className="text-[8px] font-bold text-zinc-950">{u.full_name?.[0] ?? '?'}</span>
                        </div>
                        <span className="text-[10px] text-zinc-300">{u.full_name?.split(' ')[0] ?? '—'}</span>
                        <span className="text-[9px] text-zinc-600 capitalize">{u.role?.replace('_',' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stock crítico */}
              {s.lowStock?.length > 0 && (
                <div className="bg-red-500/5 border border-red-500/15 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle size={11} className="text-red-400" />
                    <span className="text-[10px] text-red-400 font-medium">Stock crítico</span>
                  </div>
                  {s.lowStock.map((p: any) => (
                    <div key={p.name} className="flex items-center justify-between py-0.5">
                      <span className="text-[10px] text-zinc-400 truncate flex-1">{p.name}</span>
                      <span className="text-[10px] font-bold text-red-400 ml-2">{p.stock} uds.</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Último movimiento + botón ver detalle */}
              <div className="flex items-center justify-between pt-1 border-t border-black/20">
                <div className="flex items-center gap-1.5">
                  <Clock size={11} className="text-zinc-600" />
                  <span className="text-[10px] text-zinc-600">
                    {s.lastMovement
                      ? `Último mov. ${new Date(s.lastMovement.created_at).toLocaleDateString('es-CL', { day:'2-digit', month:'short' })}`
                      : 'Sin movimientos'}
                  </span>
                </div>
                <button onClick={() => router.push(`/inventory?campus=${c.id}`)}
                  className={`flex items-center gap-1 text-[10px] font-semibold ${color.text} hover:opacity-80 transition`}>
                  Ver inventario <ArrowRight size={11} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
