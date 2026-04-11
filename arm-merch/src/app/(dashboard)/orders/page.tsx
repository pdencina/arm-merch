'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search } from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const STATUS_STYLES: Record<string, string> = {
  completada: 'text-green-400 bg-green-500/10 border-green-500/20',
  pendiente:  'text-amber-400 bg-amber-500/10 border-amber-500/20',
  cancelada:  'text-red-400 bg-red-500/10 border-red-500/20',
}

const METHOD_LABEL: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transfer.', debito: 'Débito', credito: 'Crédito'
}

export default function OrdersPage() {
  const [orders, setOrders]     = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMethod, setFilterMethod] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [userRole, setUserRole] = useState('')
  const [userId, setUserId]     = useState('')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile } = await supabase
        .from('profiles').select('role, campus_id').eq('id', session.user.id).single()

      const role = profile?.role ?? 'voluntario'
      setUserRole(role)
      setUserId(session.user.id)

      let query = supabase.from('orders')
        .select(`id, order_number, total, subtotal, discount, status, payment_method, notes, created_at,
          seller:profiles(full_name, campus_id),
          order_items(quantity, unit_price, product:products(name, sku))`)
        .order('created_at', { ascending: false })
        .limit(200)

      // Voluntario solo ve sus propias órdenes
      if (role === 'voluntario') {
        query = query.eq('seller_id', session.user.id)
      }

      const { data } = await query
      setOrders(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = orders.filter(o => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      o.order_number?.toString().includes(q) ||
      (o.notes ?? '').toLowerCase().includes(q) ||
      (o.seller?.full_name ?? '').toLowerCase().includes(q)
    const matchStatus = !filterStatus || o.status === filterStatus
    const matchMethod = !filterMethod || o.payment_method === filterMethod
    return matchSearch && matchStatus && matchMethod
  })

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-white">Órdenes</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          {userRole === 'voluntario' ? 'Tus ventas' : 'Historial completo'} · {orders.length} registros
        </p>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cliente, orden o número..."
            className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600
                       rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition">
          <option value="">Todos los estados</option>
          <option value="completada">Completada</option>
          <option value="pendiente">Pendiente</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition">
          <option value="">Todos los métodos</option>
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
          <option value="debito">Débito</option>
          <option value="credito">Crédito</option>
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.length === 0 ? (
            <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-10 text-center text-zinc-600 text-sm">
              No se encontraron órdenes
            </div>
          ) : filtered.map(order => (
            <div key={order.id}
              className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl overflow-hidden">
              <button className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-zinc-700/10 transition"
                onClick={() => setExpanded(expanded === order.id ? null : order.id)}>
                <span className="text-xs text-zinc-600 font-mono w-12 shrink-0">#{order.order_number}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 font-medium truncate">
                    {order.notes?.replace('Cliente: ','').split(' | ')[0] ?? '—'}
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    {fmtDate(order.created_at)}
                    {order.seller?.full_name && userRole !== 'voluntario' && ` · ${order.seller.full_name}`}
                  </p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg border shrink-0 hidden sm:block ${STATUS_STYLES[order.status] ?? ''}`}>
                  {order.status}
                </span>
                <span className="text-xs text-zinc-500 hidden md:block shrink-0">
                  {METHOD_LABEL[order.payment_method] ?? order.payment_method}
                </span>
                <span className="text-sm font-bold text-amber-400 shrink-0">{fmt(order.total)}</span>
              </button>

              {expanded === order.id && (
                <div className="px-4 pb-4 border-t border-zinc-700/40 pt-3">
                  <div className="flex flex-col gap-1.5">
                    {(order.order_items ?? []).map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400">{item.product?.name ?? '—'} ×{item.quantity}</span>
                        <span className="text-zinc-300">{fmt(item.unit_price * item.quantity)}</span>
                      </div>
                    ))}
                    {order.discount > 0 && (
                      <div className="flex justify-between text-xs text-green-400 border-t border-zinc-700/40 pt-1.5 mt-1">
                        <span>Descuento</span><span>−{fmt(order.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold border-t border-zinc-700/40 pt-1.5 mt-1">
                      <span className="text-zinc-400">Total</span>
                      <span className="text-amber-400">{fmt(order.total)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
