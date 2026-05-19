'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  PackageCheck,
  Shirt,
  Truck,
} from 'lucide-react'

type OrderRow = {
  id: string
  order_number: number | string
  campus_id: string | null
  pickup_campus_id?: string | null
  total: number
  created_at: string
  production_status?: string | null
  tracking_token?: string | null
  order_contacts?: any[] | any
  order_items?: any[]
}

type CampusRow = { id: string; name: string }

const STATUS_LABEL: Record<string, string> = {
  pending_production: 'Pendiente producción',
  in_production: 'En producción',
  ready_pickup: 'Listo para retiro',
  delivered: 'Entregado',
}

const NEXT_STATUS: Record<string, string | null> = {
  pending_production: 'in_production',
  in_production: 'ready_pickup',
  ready_pickup: 'delivered',
  delivered: null,
}

const NEXT_LABEL: Record<string, string> = {
  pending_production: 'Marcar en producción',
  in_production: 'Marcar listo para retiro',
  ready_pickup: 'Marcar entregado',
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n || 0)
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-CL')
}

function getDaysSince(date: string) {
  const created = new Date(date).getTime()
  const now = new Date().getTime()

  return Math.floor((now - created) / (1000 * 60 * 60 * 24))
}

function getSlaInfo(order: OrderRow) {
  const days = getDaysSince(order.created_at)
  const status = String(order.production_status ?? '')

  if (status === 'delivered') {
    return {
      level: 'ok',
      label: 'Entregado',
      color: 'bg-green-500/15 text-green-400 border-green-500/20',
    }
  }

  if (status === 'ready_pickup' && days >= 7) {
    return {
      level: 'critical',
      label: `⚠️ Lleva ${days} días esperando retiro`,
      color: 'bg-red-500/15 text-red-400 border-red-500/20',
    }
  }

  if (days >= 5) {
    return {
      level: 'critical',
      label: `🚨 ${days} días sin avanzar`,
      color: 'bg-red-500/15 text-red-400 border-red-500/20',
    }
  }

  if (days >= 3) {
    return {
      level: 'late',
      label: `⚠️ ${days} días sin avanzar`,
      color: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
    }
  }

  if (days >= 2) {
    return {
      level: 'warning',
      label: `👀 Lleva ${days} días`,
      color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
    }
  }

  return {
    level: 'ok',
    label: '🟢 En plazo',
    color: 'bg-green-500/15 text-green-400 border-green-500/20',
  }
}

function statusIcon(status: string) {
  if (status === 'in_production') return <Shirt size={16} />
  if (status === 'ready_pickup') return <PackageCheck size={16} />
  if (status === 'delivered') return <Truck size={16} />
  return <Clock size={16} />
}

export default function ProductionPage() {
  const supabase = createClient()

  const [orders, setOrders] = useState<OrderRow[]>([])
  const [campuses, setCampuses] = useState<CampusRow[]>([])
  const [role, setRole] = useState<string>('')
  const [campusId, setCampusId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      setError('No autenticado')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, campus_id')
      .eq('id', session.user.id)
      .single()

    setRole(profile?.role ?? '')
    setCampusId(profile?.campus_id ?? null)

    let query = supabase
      .from('orders')
      .select(`
        id,
        order_number,
        campus_id,
        pickup_campus_id,
        total,
        created_at,
        production_status,
        tracking_token,
        order_contacts(client_name, client_email, client_phone),
        order_items(quantity, size, fulfillment_type, products(name, sku))
      `)
      .in('production_status', [
        'pending_production',
        'in_production',
        'ready_pickup',
        'delivered',
      ])
      .order('created_at', { ascending: false })

    if (profile?.role !== 'super_admin' && profile?.campus_id) {
      query = query.or(
        `campus_id.eq.${profile.campus_id},pickup_campus_id.eq.${profile.campus_id}`
      )
    }

    const [{ data: orderData, error: orderError }, { data: campusData }] =
      await Promise.all([
        query,
        supabase.from('campus').select('id, name').order('name'),
      ])

    if (orderError) {
      setError(orderError.message)
      setLoading(false)
      return
    }

    setOrders((orderData ?? []) as OrderRow[])
    setCampuses((campusData ?? []) as CampusRow[])
    setLoading(false)
  }

  useEffect(() => {
    load()

    const channel = supabase
      .channel('production-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => load()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const campusMap = useMemo(() => {
    return new Map(campuses.map((c) => [c.id, c.name]))
  }, [campuses])

  const filtered = useMemo(() => {
    return orders.filter(
      (o) => !statusFilter || o.production_status === statusFilter
    )
  }, [orders, statusFilter])

  const metrics = useMemo(() => {
    return {
      ok: filtered.filter((o) => getSlaInfo(o).level === 'ok').length,
      warning: filtered.filter((o) => getSlaInfo(o).level === 'warning').length,
      late: filtered.filter((o) => getSlaInfo(o).level === 'late').length,
      critical: filtered.filter((o) => getSlaInfo(o).level === 'critical')
        .length,
    }
  }, [filtered])

  async function updateStatus(order: OrderRow) {
    const current = String(order.production_status ?? 'pending_production')
    const next = NEXT_STATUS[current]

    if (!next) return

    setUpdatingId(order.id)
    setError(null)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`/api/orders/${order.id}/fulfillment`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ status: next }),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setError(data?.error ?? 'No se pudo actualizar el estado')
    }

    await load()
    setUpdatingId(null)
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Producción y retiros
          </h1>

          <p className="mt-1 text-sm text-zinc-500">
            Seguimiento de pedidos por producir, listos para retiro y
            entregados.
          </p>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
        >
          <option value="">Todos los estados</option>

          {Object.entries(STATUS_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          title="En plazo"
          value={metrics.ok}
          color="text-green-400"
        />

        <MetricCard
          title="Atención"
          value={metrics.warning}
          color="text-yellow-400"
        />

        <MetricCard
          title="Retrasados"
          value={metrics.late}
          color="text-orange-400"
        />

        <MetricCard
          title="Críticos"
          value={metrics.critical}
          color="text-red-400"
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-500">
            No hay pedidos en producción/retiro.
          </div>
        ) : (
          filtered.map((order) => {
            const status = String(
              order.production_status ?? 'pending_production'
            )

            const contact = Array.isArray(order.order_contacts)
              ? order.order_contacts[0]
              : order.order_contacts

            const pickupCampus =
              order.pickup_campus_id || order.campus_id

            const next = NEXT_STATUS[status]

            const canMove =
              role === 'super_admin' ||
              (next === 'delivered' && campusId === pickupCampus)

            const sla = getSlaInfo(order)

            const productionItems = (order.order_items ?? []).filter(
              (item: any) => item.fulfillment_type === 'production'
            )

            const immediateItems = (order.order_items ?? []).filter(
              (item: any) => item.fulfillment_type !== 'production'
            )

            return (
              <div
                key={order.id}
                className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-bold text-white">
                        Orden #{order.order_number}
                      </h2>

                      <span className="inline-flex items-center gap-2 rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-300">
                        {statusIcon(status)}{' '}
                        {STATUS_LABEL[status] ?? status}
                      </span>

                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${sla.color}`}
                      >
                        <AlertTriangle size={14} />
                        {sla.label}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <Info
                        label="Cliente"
                        value={contact?.client_name ?? 'Sin cliente'}
                      />

                      <Info
                        label="Campus venta"
                        value={
                          order.campus_id
                            ? campusMap.get(order.campus_id) ??
                              'Sin campus'
                            : 'Sin campus'
                        }
                      />

                      <Info
                        label="Campus retiro"
                        value={
                          pickupCampus
                            ? campusMap.get(pickupCampus) ??
                              'Por confirmar'
                            : 'Por confirmar'
                        }
                      />

                      <Info
                        label="Total"
                        value={fmt(Number(order.total ?? 0))}
                        highlight
                      />
                    </div>

                    <div className="mt-4 space-y-4">
                      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-xs font-black uppercase tracking-widest text-violet-300">
                            Productos a producir
                          </p>

                          <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-black text-violet-200">
                            {productionItems.length} item{productionItems.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        {productionItems.length === 0 ? (
                          <p className="text-sm text-zinc-500">
                            Esta orden no tiene productos marcados para producción.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {productionItems.map((item: any, idx: number) => {
                              const product = Array.isArray(item.products)
                                ? item.products[0]
                                : item.products

                              return (
                                <div
                                  key={`production-${idx}`}
                                  className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2 text-sm"
                                >
                                  <span className="text-zinc-100">
                                    <span className="mr-2 text-violet-300">●</span>
                                    {product?.name ?? 'Producto'}
                                    {item.size ? ` · Talla ${item.size}` : ''}
                                  </span>

                                  <span className="rounded-full bg-violet-500/20 px-2.5 py-1 text-xs font-black text-violet-200">
                                    x{item.quantity}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {immediateItems.length > 0 && (
                        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-xs font-black uppercase tracking-widest text-emerald-300">
                              Entrega inmediata
                            </p>

                            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-200">
                              Ya entregados
                            </span>
                          </div>

                          <div className="space-y-2">
                            {immediateItems.map((item: any, idx: number) => {
                              const product = Array.isArray(item.products)
                                ? item.products[0]
                                : item.products

                              return (
                                <div
                                  key={`immediate-${idx}`}
                                  className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2 text-sm"
                                >
                                  <span className="text-zinc-400">
                                    {product?.name ?? 'Producto'}
                                    {item.size ? ` · Talla ${item.size}` : ''}
                                  </span>

                                  <span className="text-xs font-bold text-emerald-300">
                                    x{item.quantity}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <p className="mt-3 text-xs text-zinc-600">
                      Creado: {formatDate(order.created_at)}
                    </p>
                  </div>

                  <div className="flex min-w-[220px] flex-col gap-3">
                    {order.tracking_token && (
                      <Link
                        href={`/track/${order.tracking_token}`}
                        target="_blank"
                        className="inline-flex items-center justify-center rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-800"
                      >
                        Ver tracking cliente
                      </Link>
                    )}

                    {next && canMove && (
                      <button
                        onClick={() => updateStatus(order)}
                        disabled={updatingId === order.id}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-black hover:bg-amber-400 disabled:opacity-50"
                      >
                        {updatingId === order.id
                          ? 'Actualizando...'
                          : NEXT_LABEL[status]}
                      </button>
                    )}

                    {status === 'delivered' && (
                      <div className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-500/15 px-4 py-3 text-sm font-bold text-green-400">
                        <CheckCircle2 size={16} />
                        Entregado
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  color,
}: {
  title: string
  value: number
  color: string
}) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
      <p className="text-xs uppercase tracking-widest text-zinc-500">
        {title}
      </p>

      <p className={`mt-3 text-3xl font-black ${color}`}>
        {value}
      </p>
    </div>
  )
}

function Info({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="rounded-2xl bg-zinc-950/60 px-4 py-3">
      <p className="text-[11px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>

      <p
        className={`mt-1 truncate text-sm font-semibold ${
          highlight ? 'text-amber-400' : 'text-white'
        }`}
      >
        {value}
      </p>
    </div>
  )
}