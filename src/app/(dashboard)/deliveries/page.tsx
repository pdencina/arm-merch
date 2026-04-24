'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Package, Clock, CheckCircle2, Truck, Search,
  RefreshCw, ChevronDown, ChevronUp, Building2,
  X, Filter,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
type DeliveryStatus = 'pending' | 'ready' | 'delivered'

type DeliveryOrder = {
  id: string
  order_number: number
  total: number
  delivery_status: DeliveryStatus
  created_at: string
  payment_method: string
  notes: string | null
  campus_id: string
  campus: { name: string }[] | { name: string } | null
  order_contacts: { client_name: string; client_email: string | null }[]
  order_items: {
    quantity: number
    unit_price: number
    product: { name: string; sku: string | null } | null
  }[]
}

// ─── Config ───────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  pending: {
    label:  'En producción',
    icon:   Clock,
    color:  'text-amber-400',
    bg:     'bg-amber-500/12 ring-1 ring-amber-500/25',
    border: 'border-amber-500/20',
    dot:    'bg-amber-400',
    next:   'ready' as DeliveryStatus,
    nextLabel: 'Marcar como listo para entregar',
    nextColor: 'bg-blue-600 hover:bg-blue-500 text-white',
  },
  ready: {
    label:  'Listo para entregar',
    icon:   Truck,
    color:  'text-blue-400',
    bg:     'bg-blue-500/12 ring-1 ring-blue-500/25',
    border: 'border-blue-500/20',
    dot:    'bg-blue-400',
    next:   'delivered' as DeliveryStatus,
    nextLabel: 'Marcar como entregado',
    nextColor: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  },
  delivered: {
    label:  'Entregado',
    icon:   CheckCircle2,
    color:  'text-emerald-400',
    bg:     'bg-emerald-500/12 ring-1 ring-emerald-500/25',
    border: 'border-emerald-500/20',
    dot:    'bg-emerald-400',
    next:   null,
    nextLabel: null,
    nextColor: '',
  },
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0)

const fmtDate = (v: string) =>
  new Date(v).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

// ─── Order Card ───────────────────────────────────────────────────────────────
function OrderCard({
  order, onStatusChange, updating,
}: {
  order: DeliveryOrder
  onStatusChange: (id: string, status: DeliveryStatus, notes?: string) => void
  updating: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [showNoteInput, setShowNoteInput] = useState(false)

  const cfg = STATUS_CFG[order.delivery_status as DeliveryStatus] ?? STATUS_CFG['pending']
  const Icon = cfg.icon
  const campusObj = Array.isArray(order.campus) ? order.campus[0] : order.campus
  const client = order.order_contacts?.[0]
  const isUpdating = updating === order.id

  function handleAdvance() {
    if (!cfg.next) return
    if (cfg.next === 'delivered' && !noteInput.trim() && showNoteInput) {
      onStatusChange(order.id, cfg.next, noteInput.trim() || undefined)
      setShowNoteInput(false)
      setNoteInput('')
    } else if (cfg.next === 'delivered') {
      setShowNoteInput(true)
    } else {
      onStatusChange(order.id, cfg.next)
    }
  }

  return (
    <div className={`overflow-hidden rounded-2xl border bg-zinc-900 transition ${cfg.border}`}>

      {/* Header row */}
      <div className="flex items-center gap-3 p-4">

        {/* Status icon */}
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.bg}`}>
          <Icon size={16} className={cfg.color} />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-zinc-500">#{order.order_number}</span>
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${order.delivery_status === 'pending' ? 'animate-pulse' : ''}`} />
              {cfg.label}
            </span>
            {campusObj && (
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                {campusObj.name}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-500">
            <span>{client?.client_name ?? '—'}</span>
            <span>·</span>
            <span>{fmtDate(order.created_at)}</span>
          </div>
        </div>

        {/* Total + expand */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-base font-black text-white">{fmt(order.total)}</span>
          <button
            onClick={() => setExpanded(v => !v)}
            className="rounded-lg p-1 text-zinc-600 transition hover:text-zinc-300"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-zinc-800 bg-zinc-950/30 px-4 pb-4 pt-3 space-y-3">

          {/* Products */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Productos pedidos</p>
            <div className="space-y-1.5">
              {order.order_items.map((item, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-zinc-800/40 px-3 py-2">
                  <div>
                    <p className="text-sm text-zinc-200">{item.product?.name ?? '—'}</p>
                    {item.product?.sku && (
                      <p className="text-[10px] text-zinc-600">{item.product.sku}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{item.quantity} uds.</p>
                    <p className="text-[10px] text-zinc-600">{fmt(item.unit_price)} c/u</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Client contact */}
          {client && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-zinc-800/40 px-3 py-2">
                <p className="text-[10px] text-zinc-600">Cliente</p>
                <p className="text-xs text-zinc-300">{client.client_name}</p>
              </div>
              {client.client_email && (
                <div className="rounded-xl bg-zinc-800/40 px-3 py-2">
                  <p className="text-[10px] text-zinc-600">Email</p>
                  <p className="text-xs text-zinc-300">{client.client_email}</p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div className="rounded-xl bg-zinc-800/30 px-3 py-2">
              <p className="text-[10px] text-zinc-600">Nota</p>
              <p className="text-xs text-zinc-400">{order.notes}</p>
            </div>
          )}

          {/* Action */}
          {cfg.next && (
            <div className="space-y-2">
              {showNoteInput && (
                <div>
                  <p className="mb-1 text-[10px] text-zinc-600">Nota de entrega (opcional)</p>
                  <input
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    placeholder="Ej: Entregado en servicio domingo..."
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-500/40"
                  />
                </div>
              )}
              <button
                onClick={handleAdvance}
                disabled={isUpdating}
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${cfg.nextColor} disabled:opacity-50`}
              >
                {isUpdating
                  ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  : <Icon size={14} />}
                {cfg.nextLabel}
              </button>
              {showNoteInput && (
                <button
                  onClick={() => setShowNoteInput(false)}
                  className="w-full text-center text-xs text-zinc-600 hover:text-zinc-400"
                >
                  Cancelar
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DeliveriesPage() {
  const supabase = createClient()
  const [orders, setOrders]       = useState<DeliveryOrder[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updating, setUpdating]   = useState<string | null>(null)

  // Filters
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | ''>('')
  const [campusFilter, setCampusFilter] = useState('')

  async function load(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, order_number, total, delivery_status, created_at,
        payment_method, notes, campus_id,
        order_contacts(client_name, client_email),
        order_items(quantity, unit_price, product_id, product:products(name, sku))
      `)
      .not('delivery_status', 'is', null)
      .order('created_at', { ascending: false })

    if (error) { toast.error(error.message); setLoading(false); setRefreshing(false); return }

    // Fetch campus names separately (orders has no FK to campus in schema)
    const campusIds = [...new Set((data ?? []).map((o: any) => o.campus_id).filter(Boolean))]
    const campusMap: Record<string, string> = {}
    if (campusIds.length > 0) {
      const { data: campusData } = await supabase
        .from('campus')
        .select('id, name')
        .in('id', campusIds)
      ;(campusData ?? []).forEach((c: any) => { campusMap[c.id] = c.name })
    }

    // Attach campus name to each order
    const ordersWithCampus = (data ?? []).map((o: any) => ({
      ...o,
      campus: campusMap[o.campus_id] ? { name: campusMap[o.campus_id] } : null,
    }))

    setOrders(ordersWithCampus as unknown as DeliveryOrder[])
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  async function handleStatusChange(orderId: string, newStatus: DeliveryStatus, notes?: string) {
    setUpdating(orderId)

    const order = orders.find(o => o.id === orderId)

    // Update order delivery_status
    const { error } = await supabase
      .from('orders')
      .update({ delivery_status: newStatus })
      .eq('id', orderId)

    if (error) { toast.error(error.message); setUpdating(null); return }

    // Log the status change
    await supabase.from('delivery_updates').insert({
      order_id:    orderId,
      from_status: order?.delivery_status ?? null,
      to_status:   newStatus,
      notes:       notes ?? null,
    })

    // If delivered, deduct stock now (it wasn't deducted at sale time)
    if (newStatus === 'delivered' && order) {
      for (const item of order.order_items) {
        await supabase.from('inventory_movements').insert({
          product_id: (item as any).product_id,
          campus_id:  order.campus_id,
          type:       'salida',
          quantity:   item.quantity,
          notes:      `Entrega pedido #${order.order_number}`,
        })
      }
    }

    toast.success(
      newStatus === 'ready'     ? '✅ Marcado como listo para entregar' :
      newStatus === 'delivered' ? '🎉 Pedido entregado' : 'Estado actualizado'
    )

    setUpdating(null)
    load(true)
  }

  // Derived data
  const campuses = useMemo(() =>
    Array.from(new Map(orders.map(o => { const c = Array.isArray(o.campus) ? o.campus[0] : o.campus; return [o.campus_id, c?.name ?? o.campus_id] })).entries()),
    [orders]
  )

  const filtered = useMemo(() => orders.filter(o => {
    const client = o.order_contacts?.[0]
    const matchSearch = !search || [
      client?.client_name,
      String(o.order_number),
      o.order_items.map(i => i.product?.name).join(' '),
    ].some(v => v?.toLowerCase().includes(search.toLowerCase()))
    const matchStatus = !statusFilter || o.delivery_status === statusFilter
    const matchCampus = !campusFilter || o.campus_id === campusFilter
    return matchSearch && matchStatus && matchCampus
  }), [orders, search, statusFilter, campusFilter])

  const stats = useMemo(() => ({
    pending:   orders.filter(o => o.delivery_status === 'pending').length,
    ready:     orders.filter(o => o.delivery_status === 'ready').length,
    delivered: orders.filter(o => o.delivery_status === 'delivered').length,
  }), [orders])

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-500" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Pedidos pendientes de entrega</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            Seguimiento de pedidos bajo demanda · todos los campus
          </p>
        </div>
        <button
          onClick={() => load(true)} disabled={refreshing}
          className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-400 transition hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { key: 'pending',   label: 'En producción',         icon: Clock,         color: 'text-amber-400',  bg: 'bg-amber-500/10'  },
          { key: 'ready',     label: 'Listos para entregar',  icon: Truck,         color: 'text-blue-400',   bg: 'bg-blue-500/10'   },
          { key: 'delivered', label: 'Entregados',            icon: CheckCircle2,  color: 'text-emerald-400',bg: 'bg-emerald-500/10'},
        ] as const).map(s => {
          const Icon = s.icon
          return (
            <button
              key={s.key}
              onClick={() => setStatusFilter(statusFilter === s.key ? '' : s.key)}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                statusFilter === s.key ? 'border-white/20 bg-zinc-800' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
              }`}
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.bg}`}>
                <Icon size={15} className={s.color} />
              </div>
              <div>
                <p className={`text-xl font-black ${s.color}`}>{stats[s.key]}</p>
                <p className="text-[10px] text-zinc-500">{s.label}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente, producto, orden..."
            className="h-9 w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-8 pr-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-amber-500/40"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"><X size={12} /></button>}
        </div>

        <select
          value={campusFilter} onChange={e => setCampusFilter(e.target.value)}
          className="h-9 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 outline-none"
        >
          <option value="">Todos los campus</option>
          {campuses.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>

        {(search || statusFilter || campusFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setCampusFilter('') }}
            className="flex items-center gap-1 rounded-xl border border-zinc-700 px-3 text-xs text-zinc-500 hover:text-zinc-300"
          >
            <X size={11} /> Limpiar
          </button>
        )}

        <div className="flex items-center rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-500">
          {filtered.length} pedidos
        </div>
      </div>

      {/* Orders grouped by status */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package size={40} className="text-zinc-800" />
          <p className="mt-3 text-sm text-zinc-600">
            {orders.length === 0
              ? 'No hay pedidos pendientes de entrega aún.'
              : 'Sin resultados para los filtros seleccionados.'}
          </p>
          {orders.length === 0 && (
            <p className="mt-1 text-xs text-zinc-700">
              Los pedidos aparecen aquí cuando se activa "Pedido para producir" en el POS.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {(['pending', 'ready', 'delivered'] as const)
            .filter(status => !statusFilter || statusFilter === status)
            .map(status => {
              const group = filtered.filter(o => o.delivery_status === status)
              if (group.length === 0) return null
              const cfg = STATUS_CFG[status]
              const GIcon = cfg.icon
              return (
                <div key={status}>
                  <div className="mb-3 flex items-center gap-2">
                    <GIcon size={14} className={cfg.color} />
                    <h2 className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
                      {group.length}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {group.map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onStatusChange={handleStatusChange}
                        updating={updating}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
