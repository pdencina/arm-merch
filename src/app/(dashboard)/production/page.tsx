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
  BarChart3,
  Building2,
  Timer,
  Trophy,
} from 'lucide-react'

type OrderRow = {
  id: string
  order_number: number | string
  campus_id: string | null
  pickup_campus_id?: string | null
  total: number
  amount_paid?: number | null
  balance_due?: number | null
  payment_status?: string | null
  payment_type?: string | null
  created_at: string
  production_status?: string | null
  tracking_token?: string | null
  order_contacts?: any[] | any
  order_items?: Array<{
    id?: string
    quantity?: number
    unit_price?: number
    size?: string | null
    fulfillment_type?: string | null
    production_started_at?: string | null
    ready_pickup_at?: string | null
    delivered_at?: string | null
    products?: any[] | any
  }>
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

function getHoursBetween(start?: string | null, end?: string | null) {
  if (!start) return null

  const from = new Date(start).getTime()
  const to = end ? new Date(end).getTime() : new Date().getTime()

  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null

  return Math.round(((to - from) / (1000 * 60 * 60)) * 10) / 10
}

function formatHours(hours: number | null) {
  if (hours === null) return 'Sin datos'
  if (hours < 24) return `${hours}h`

  const days = Math.floor(hours / 24)
  const rest = Math.round(hours % 24)

  return rest > 0 ? `${days}d ${rest}h` : `${days}d`
}

function getProductName(item: any) {
  const product = Array.isArray(item?.products) ? item.products[0] : item?.products
  return product?.name ?? 'Producto'
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
  const [collectingId, setCollectingId] = useState<string | null>(null)
  const [cashModalOrder, setCashModalOrder] = useState<OrderRow | null>(null)
  const [cashReceived, setCashReceived] = useState('')
  const [cashError, setCashError] = useState<string | null>(null)
  const [balancePaymentMethod, setBalancePaymentMethod] = useState('efectivo')
  const [statusFilter, setStatusFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [whatsappNotice, setWhatsappNotice] = useState<string | null>(null)

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

    const res = await fetch('/api/production/orders', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setError(data?.error ?? 'No se pudieron cargar los pedidos de producción')
      setLoading(false)
      return
    }

    setRole(data?.profile?.role ?? '')
    setCampusId(data?.profile?.campus_id ?? null)
    setOrders((data?.orders ?? []) as OrderRow[])
    setCampuses((data?.campuses ?? []) as CampusRow[])
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

  const canSeeProductionMetrics = role === 'admin' || role === 'super_admin'

  const metrics = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const productionItems = filtered.flatMap((order) =>
      (order.order_items ?? [])
        .filter((item: any) => item.fulfillment_type === 'production')
        .map((item: any) => ({ ...item, order })),
    )

    const openProductionItems = productionItems.filter(
      (item: any) => !item.delivered_at,
    )

    const todayProductionItems = openProductionItems.filter((item: any) => {
      const referenceDate =
        item.production_started_at ||
        item.order?.created_at ||
        new Date().toISOString()

      return new Date(referenceDate).getTime() >= today.getTime()
    })

    const readyPickupOrders = filtered.filter(
      (order) => order.production_status === 'ready_pickup',
    ).length

    const productionHours = productionItems
      .map((item: any) =>
        getHoursBetween(
          item.production_started_at,
          item.ready_pickup_at || item.delivered_at,
        ),
      )
      .filter((value): value is number => value !== null)

    const averageProductionHours =
      productionHours.length > 0
        ? Math.round(
            (productionHours.reduce((sum, value) => sum + value, 0) /
              productionHours.length) *
              10,
          ) / 10
        : null

    const campusCounter = new Map<string, number>()
    productionItems.forEach((item: any) => {
      const order = item.order as OrderRow
      const campus = order.pickup_campus_id || order.campus_id || 'sin-campus'
      campusCounter.set(campus, (campusCounter.get(campus) ?? 0) + Number(item.quantity ?? 0))
    })

    const topCampus = Array.from(campusCounter.entries()).sort(
      (a, b) => b[1] - a[1],
    )[0]

    const productCounter = new Map<string, number>()
    productionItems.forEach((item: any) => {
      const name = getProductName(item)
      productCounter.set(name, (productCounter.get(name) ?? 0) + Number(item.quantity ?? 0))
    })

    const topProduct = Array.from(productCounter.entries()).sort(
      (a, b) => b[1] - a[1],
    )[0]

    return {
      ok: filtered.filter((o) => getSlaInfo(o).level === 'ok').length,
      warning: filtered.filter((o) => getSlaInfo(o).level === 'warning').length,
      late: filtered.filter((o) => getSlaInfo(o).level === 'late').length,
      critical: filtered.filter((o) => getSlaInfo(o).level === 'critical').length,
      productionToday: todayProductionItems.reduce(
        (sum: number, item: any) => sum + Number(item.quantity ?? 0),
        0,
      ),
      averageProductionHours,
      topCampusId: topCampus?.[0] ?? null,
      topCampusQuantity: topCampus?.[1] ?? 0,
      topProductName: topProduct?.[0] ?? 'Sin datos',
      topProductQuantity: topProduct?.[1] ?? 0,
      readyPickupOrders,
    }
  }, [filtered])


  const cashReceivedAmount = useMemo(() => {
    const digits = cashReceived.replace(/\D/g, '')
    return Number(digits || 0)
  }, [cashReceived])

  const pendingBalanceToCollect = Number(cashModalOrder?.balance_due ?? 0)
  const cashChange = Math.max(0, cashReceivedAmount - pendingBalanceToCollect)
  const cashMissing = Math.max(0, pendingBalanceToCollect - cashReceivedAmount)

  function openCollectBalanceModal(order: OrderRow) {
    setCashModalOrder(order)
    setCashReceived('')
    setCashError(null)
    setBalancePaymentMethod('efectivo')
  }

  async function collectBalance() {
    if (!cashModalOrder) return

    const pendingBalance = Number(cashModalOrder.balance_due ?? 0)

    if (pendingBalance <= 0) {
      setCashError('Esta orden no tiene saldo pendiente.')
      return
    }

    if (balancePaymentMethod === 'efectivo' && cashReceivedAmount < pendingBalance) {
      setCashError(`El efectivo recibido debe cubrir el saldo pendiente (${fmt(pendingBalance)}).`)
      return
    }

    setCollectingId(cashModalOrder.id)
    setCashError(null)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`/api/orders/${cashModalOrder.id}/collect-balance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        payment_method: balancePaymentMethod,
        amount_received: balancePaymentMethod === 'efectivo' ? cashReceivedAmount : pendingBalance,
      }),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setCashError(data?.error ?? 'No se pudo cobrar el saldo pendiente.')
      setCollectingId(null)
      return
    }

    setCashModalOrder(null)
    setCashReceived('')
    setCollectingId(null)
    await load()
  }

  async function updateStatus(order: OrderRow) {
    const current = String(order.production_status ?? 'pending_production')
    const next = NEXT_STATUS[current]

    if (!next) return

    setUpdatingId(order.id)
    setError(null)
    setWhatsappNotice(null)

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
    } else {
      // Feedback de WhatsApp cuando se marca listo para retiro
      if (next === 'ready_pickup' && data?.whatsapp_sent) {
        setWhatsappNotice(`✅ WhatsApp enviado al cliente (Orden #${order.order_number})`)
        setTimeout(() => setWhatsappNotice(null), 6000)
      } else if (next === 'ready_pickup' && data?.whatsapp_result?.error) {
        setWhatsappNotice(`⚠️ No se pudo enviar WhatsApp: ${data.whatsapp_result.error}`)
        setTimeout(() => setWhatsappNotice(null), 8000)
      }
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

      {canSeeProductionMetrics ? (
        <>
          <div className="grid gap-4 md:grid-cols-5">
            <MetricCard
              title="Productos por producir hoy"
              value={metrics.productionToday}
              color="text-violet-300"
              icon={<Shirt size={18} />}
            />

            <MetricCard
              title="Tiempo prom. producción"
              value={formatHours(metrics.averageProductionHours)}
              color="text-blue-300"
              icon={<Timer size={18} />}
            />

            <MetricCard
              title="Campus con más producción"
              value={
                metrics.topCampusId
                  ? campusMap.get(metrics.topCampusId) ?? 'Sin campus'
                  : 'Sin datos'
              }
              detail={
                metrics.topCampusQuantity
                  ? `${metrics.topCampusQuantity} productos`
                  : undefined
              }
              color="text-amber-300"
              icon={<Building2 size={18} />}
            />

            <MetricCard
              title="Producto más producido"
              value={metrics.topProductName}
              detail={
                metrics.topProductQuantity
                  ? `${metrics.topProductQuantity} unidades`
                  : undefined
              }
              color="text-green-300"
              icon={<Trophy size={18} />}
            />

            <MetricCard
              title="Listos para retiro"
              value={metrics.readyPickupOrders}
              color="text-emerald-300"
              icon={<PackageCheck size={18} />}
            />
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
        </>
      ) : (
        <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-blue-300">
                Vista operacional limitada
              </p>
              <h2 className="mt-2 text-xl font-black text-white">
                Perfil voluntario
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">
                Puedes revisar pedidos, abrir el tracking del cliente y apoyar el flujo de entrega.
                Las métricas globales están disponibles para administradores de campus y super administradores.
              </p>
            </div>

            <div className="rounded-2xl bg-black/20 px-4 py-3 text-sm font-bold text-blue-200">
              {filtered.length} pedido{filtered.length === 1 ? '' : 's'} visibles
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {whatsappNotice && (
        <div className={`rounded-2xl border p-4 text-sm font-semibold ${
          whatsappNotice.startsWith('✅')
            ? 'border-green-500/30 bg-green-500/10 text-green-300'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
        }`}>
          {whatsappNotice}
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

            const productionItems = (order.order_items ?? []).filter(
              (item: any) => item.fulfillment_type === 'production'
            )

            const immediateItems = (order.order_items ?? []).filter(
              (item: any) => item.fulfillment_type !== 'production'
            )

            const hasStartedProduction = productionItems.some(
              (item: any) => item.production_started_at
            )

            const hasReadyPickup = productionItems.some(
              (item: any) => item.ready_pickup_at
            )

            const hasDelivered =
              productionItems.length > 0 &&
              productionItems.every(
                (item: any) => item.delivered_at
              )

            let workflowStatus =
              order.production_status ?? 'pending_production'

            if (hasDelivered) {
              workflowStatus = 'delivered'
            } else if (hasReadyPickup) {
              workflowStatus = 'ready_pickup'
            } else if (hasStartedProduction) {
              workflowStatus = 'in_production'
            }

            const deliveryItems =
              workflowStatus === 'ready_pickup' && productionItems.length === 0
                ? (order.order_items ?? [])
                : productionItems

            const next = NEXT_STATUS[workflowStatus]

            const hasPendingBalance =
              Number(order.balance_due ?? 0) > 0

            const canDeliver =
              !hasPendingBalance &&
              (
                role === 'super_admin' ||
                campusId === pickupCampus
              )

            const canMove =
              next === 'delivered'
                ? canDeliver
                : role === 'super_admin'

            const sla = getSlaInfo({
              ...order,
              production_status: workflowStatus,
            })

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
                        {STATUS_LABEL[workflowStatus] ?? workflowStatus}
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
                        label="Total pedido"
                        value={fmt(Number(order.total ?? 0))}
                        highlight
                      />

                      {Number(order.amount_paid ?? 0) > 0 && (
                        <Info
                          label="Abonado"
                          value={fmt(Number(order.amount_paid ?? 0))}
                        />
                      )}

                      {Number(order.balance_due ?? 0) > 0 && (
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-widest text-amber-300">
                            Saldo pendiente
                          </p>

                          <p className="mt-1 text-sm font-black text-amber-200">
                            {fmt(Number(order.balance_due ?? 0))}
                          </p>

                          <p className="mt-1 text-xs text-zinc-400">
                            Debe pagarse antes de marcar entregado.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 space-y-4">
                      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-xs font-black uppercase tracking-widest text-violet-300">
                            {workflowStatus === 'ready_pickup' ? 'Productos para entregar' : 'Productos a producir'}
                          </p>

                          <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-black text-violet-200">
                            {deliveryItems.length} item{deliveryItems.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        {deliveryItems.length === 0 ? (
                          <p className="text-sm text-zinc-500">
                            {workflowStatus === 'ready_pickup' ? 'No hay productos asociados para entregar. Revisa que la orden tenga items guardados.' : 'Esta orden no tiene productos marcados para producción.'}
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {deliveryItems.map((item: any, idx: number) => {
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

                                  <div className="flex flex-col items-end gap-1">
                                    <span className="rounded-full bg-violet-500/20 px-2.5 py-1 text-xs font-black text-violet-200">
                                      x{item.quantity}
                                    </span>

                                    {item.production_started_at && (
                                      <span className="text-[10px] font-semibold text-zinc-500">
                                        Inicio: {formatDate(item.production_started_at)}
                                      </span>
                                    )}

                                    {item.ready_pickup_at && (
                                      <span className="text-[10px] font-semibold text-emerald-300">
                                        Listo: {formatDate(item.ready_pickup_at)}
                                      </span>
                                    )}
                                  </div>
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

                    {workflowStatus === 'ready_pickup' &&
                      Number(order.balance_due ?? 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => openCollectBalanceModal(order)}
                          className="inline-flex items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-black text-amber-300 hover:bg-amber-500/15"
                        >
                          Cobrar saldo pendiente · {fmt(Number(order.balance_due ?? 0))}
                        </button>
                      )}

                    {next && !canMove && next === 'delivered' && Number(order.balance_due ?? 0) > 0 && (
                      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">
                        No se puede entregar. Primero debe pagar el saldo pendiente.
                      </div>
                    )}

                    {next && canMove && (
                      <button
                        onClick={() => updateStatus(order)}
                        disabled={updatingId === order.id}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-black hover:bg-amber-400 disabled:opacity-50"
                      >
                        {updatingId === order.id
                          ? 'Actualizando...'
                          : NEXT_LABEL[workflowStatus]}
                      </button>
                    )}

                    {workflowStatus === 'delivered' && (
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
      {cashModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-700 bg-zinc-900 p-7 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-amber-500/25 bg-amber-500/10 text-3xl">
              💵
            </div>

            <h2 className="mb-2 text-xl font-black text-white">
              Cobrar saldo pendiente
            </h2>

            <p className="mb-5 text-sm leading-relaxed text-zinc-400">
              Orden #{cashModalOrder.order_number}. El saldo debe quedar pagado antes de entregar.
            </p>

            <div className="mb-5 space-y-3 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-4 text-left">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Saldo a cobrar</span>
                <span className="text-base font-black text-amber-400">
                  {fmt(pendingBalanceToCollect)}
                </span>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Medio de pago
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'efectivo', label: 'Efectivo' },
                    { key: 'transferencia', label: 'Transferencia' },
                    { key: 'sumup', label: 'SumUp SOLO' },
                    { key: 'link', label: 'Link pago' },
                  ].map((method) => (
                    <button
                      key={method.key}
                      type="button"
                      onClick={() => {
                        setBalancePaymentMethod(method.key)
                        setCashError(null)
                      }}
                      className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                        balancePaymentMethod === method.key
                          ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                          : 'border-white/8 bg-white/[0.04] text-zinc-300 hover:border-amber-500/30'
                      }`}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>
              </div>

              {balancePaymentMethod === 'efectivo' ? (
                <>
                  <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Efectivo recibido
                </label>

                <input
                  autoFocus
                  inputMode="numeric"
                  value={cashReceived ? Number(cashReceived).toLocaleString('es-CL') : '0'}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '')
                    setCashReceived(digits === '' ? '0' : String(Number(digits)))
                    setCashError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && cashReceivedAmount >= pendingBalanceToCollect) {
                      e.preventDefault()
                      collectBalance()
                    }
                  }}
                  placeholder="0"
                  className="w-full rounded-2xl border border-white/8 bg-black/25 px-4 py-3 text-center text-2xl font-black text-white placeholder-zinc-700 outline-none transition focus:border-amber-500/40"
                />

                <div className="mt-3 grid grid-cols-4 gap-2">
                  {[
                    { label: 'Exacto', value: pendingBalanceToCollect },
                    { label: '+1K', value: pendingBalanceToCollect + 1000 },
                    { label: '+5K', value: pendingBalanceToCollect + 5000 },
                    { label: '+10K', value: pendingBalanceToCollect + 10000 },
                  ].map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => {
                        setCashReceived(String(option.value))
                        setCashError(null)
                      }}
                      className="rounded-xl border border-white/8 bg-white/[0.04] px-2 py-2 text-xs font-bold text-zinc-300 transition hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-300"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/25 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Recibido</span>
                  <span className="font-bold text-white">
                    {fmt(cashReceivedAmount)}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-white/6 pt-3">
                  <span className="text-sm font-bold text-zinc-300">
                    {cashReceivedAmount >= pendingBalanceToCollect
                      ? 'Vuelto a entregar'
                      : 'Falta por recibir'}
                  </span>

                  <span
                    className={`text-2xl font-black ${
                      cashReceivedAmount >= pendingBalanceToCollect
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}
                  >
                    {cashReceivedAmount >= pendingBalanceToCollect
                      ? fmt(cashChange)
                      : fmt(cashMissing)}
                  </span>
                </div>
              </div>
                </>
              ) : (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-left">
                  <p className="text-xs font-black uppercase tracking-widest text-emerald-300">
                    Confirmación manual
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    Confirma este saldo solo después de validar el pago por <span className="font-black text-emerald-300">{balancePaymentMethod === 'transferencia' ? 'Transferencia' : balancePaymentMethod === 'sumup' ? 'SumUp SOLO' : 'Link de pago'}</span>.
                  </p>
                </div>
              )}

            </div>

            {cashError && (
              <p className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {cashError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setCashModalOrder(null)
                  setCashReceived('')
                  setCashError(null)
                }}
                className="rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.08]"
              >
                Cancelar
              </button>

              <button
                onClick={collectBalance}
                disabled={
                  collectingId === cashModalOrder.id ||
                  (balancePaymentMethod === 'efectivo' &&
                    cashReceivedAmount < pendingBalanceToCollect)
                }
                className="rounded-2xl bg-amber-500 py-3 text-sm font-black text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {collectingId === cashModalOrder.id ? 'Registrando...' : balancePaymentMethod === 'efectivo' ? 'Confirmar efectivo' : 'Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function MetricCard({
  title,
  value,
  color,
  detail,
  icon,
}: {
  title: string
  value: number | string
  color: string
  detail?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          {title}
        </p>

        {icon && <div className={`${color}`}>{icon}</div>}
      </div>

      <p className={`mt-3 truncate text-2xl font-black ${color}`}>
        {value}
      </p>

      {detail && (
        <p className="mt-2 text-xs font-semibold text-zinc-500">
          {detail}
        </p>
      )}
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