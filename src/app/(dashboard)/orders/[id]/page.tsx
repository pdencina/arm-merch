'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, RotateCcw } from 'lucide-react'
import SendReceipt from '@/components/orders/send-receipt'
import ResendVoucherButton from '@/components/orders/resend-voucher-button'
import RefundModal from '@/components/orders/refund-modal'

type OrderRow = {
  id: string
  order_number: number | string
  campus_id: string | null
  payment_method: string | null
  total: number
  discount?: number | null
  amount_paid?: number | null
  balance_due?: number | null
  payment_type?: string | null
  payment_status?: string | null
  created_at: string
  status?: string | null
  notes?: string | null
  tracking_token?: string | null
}

type CampusRow = {
  id: string
  name: string
}

type ItemRow = {
  id: string
  quantity: number
  unit_price: number
  products:
    | {
        name?: string | null
        sku?: string | null
      }
    | Array<{
        name?: string | null
        sku?: string | null
      }>
    | null
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-CL')
}

function getStatusLabel(status?: string | null) {
  const value = String(status ?? '').toLowerCase()

  const labels: Record<string, string> = {
    paid: 'Pagado',
    pending: 'Pendiente pago',
    pending_transfer: 'Transferencia pendiente',
    rejected: 'Rechazada',
    cancelled: 'Cancelada',
    refunded: 'Reembolsada',
  }

  return labels[value] ?? (status || '—')
}

function getStatusClass(status?: string | null) {
  const value = String(status ?? '').toLowerCase()

  if (value === 'paid') {
    return 'border-green-500/20 bg-green-500/10 text-green-300'
  }

  if (value === 'pending_transfer') {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-300'
  }

  if (value === 'pending') {
    return 'border-blue-500/20 bg-blue-500/10 text-blue-300'
  }

  if (value === 'rejected' || value === 'cancelled') {
    return 'border-red-500/20 bg-red-500/10 text-red-300'
  }

  return 'border-zinc-700 bg-zinc-800 text-zinc-300'
}

function getPaymentLabel(payment?: string | null) {
  const value = String(payment ?? '').toLowerCase()

  const labels: Record<string, string> = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    sumup: 'SumUp',
    solo: 'SumUp Solo',
    link: 'Link de pago',
    card: 'Tarjeta',
  }

  return labels[value] ?? (payment || 'Sin definir')
}

export default function OrderDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()

  const orderId = String(params?.id ?? '')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [order, setOrder] = useState<OrderRow | null>(null)
  const [profile, setProfile] = useState<{ role: string; campus_id: string | null } | null>(null)
  const [campuses, setCampuses] = useState<CampusRow[]>([])
  const [items, setItems] = useState<ItemRow[]>([])
  const [confirmingTransfer, setConfirmingTransfer] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [showRefundModal, setShowRefundModal] = useState(false)

  useEffect(() => {
    async function load() {
      if (!orderId) {
        setError('ID de orden inválido')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        router.push('/login')
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role, campus_id')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profileData) {
        router.push('/login')
        return
      }

      const [
        { data: orderData, error: orderError },
        { data: itemsData, error: itemsError },
        { data: campusData, error: campusError },
      ] = await Promise.all([
        supabase
          .from('orders')
          .select(`
            id,
            order_number,
            campus_id,
            payment_method,
            total,
            discount,
            amount_paid,
            balance_due,
            payment_type,
            payment_status,
            created_at,
            status,
            notes,
            tracking_token
          `)
          .eq('id', orderId)
          .single(),

        supabase
          .from('order_items')
          .select(`
            id,
            quantity,
            unit_price,
            refunded_qty,
            products (
              name,
              sku
            )
          `)
          .eq('order_id', orderId),

        supabase.from('campus').select('id, name'),
      ])

      if (orderError || !orderData) {
        setError('No se pudo cargar la orden')
        setLoading(false)
        return
      }

      if (itemsError) {
        setError(itemsError.message)
        setLoading(false)
        return
      }

      if (campusError) {
        setError(campusError.message)
        setLoading(false)
        return
      }

      if (
        profileData.role !== 'super_admin' &&
        profileData.role !== 'adm_merch' &&
        profileData.campus_id !== orderData.campus_id
      ) {
        setError('No tienes acceso a esta orden')
        setLoading(false)
        return
      }

      setProfile(profileData)
      setOrder(orderData as OrderRow)
      setItems((itemsData ?? []) as ItemRow[])
      setCampuses((campusData ?? []) as CampusRow[])
      setLoading(false)
    }

    load()
  }, [orderId, router, supabase])

  const campusMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const campus of campuses) {
      map.set(campus.id, campus.name)
    }
    return map
  }, [campuses])

  const campusName = useMemo(() => {
    if (!order?.campus_id) return 'Sin campus'
    return campusMap.get(order.campus_id) ?? 'Sin campus'
  }, [campusMap, order])

  const safeItems = useMemo(() => {
    return items.map((item) => {
      const product = Array.isArray(item.products)
        ? item.products[0]
        : item.products

      return {
        id: item.id,
        quantity: Number(item.quantity ?? 0),
        unit_price: Number(item.unit_price ?? 0),
        name: product?.name ?? 'Producto',
        sku: product?.sku ?? '—',
        lineTotal: Number(item.quantity ?? 0) * Number(item.unit_price ?? 0),
      }
    })
  }, [items])

  const subtotal = useMemo(() => {
    return safeItems.reduce((sum, item) => sum + item.lineTotal, 0)
  }, [safeItems])

  const discount = Number(order?.discount ?? 0)
  const total = Number(order?.total ?? 0)


  async function confirmTransferPayment() {
    if (!order || order.status !== 'pending_transfer') return

    const confirmed = window.confirm(
      `¿Confirmar transferencia de la orden #${order.order_number}?\n\nEsto la marcará como pagada y aparecerá como venta confirmada en los dashboards.`
    )

    if (!confirmed) return

    setConfirmingTransfer(true)
    setActionMessage(null)

    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'paid',
          notes: order.notes
            ? `${order.notes} | Transferencia confirmada manualmente`
            : 'Transferencia confirmada manualmente',
        })
        .eq('id', order.id)
        .eq('status', 'pending_transfer')

      if (updateError) {
        throw new Error(updateError.message)
      }

      setOrder({
        ...order,
        status: 'paid',
        notes: order.notes
          ? `${order.notes} | Transferencia confirmada manualmente`
          : 'Transferencia confirmada manualmente',
      })

      setActionMessage('Transferencia confirmada correctamente.')
    } catch (err: any) {
      setActionMessage(err?.message || 'No se pudo confirmar la transferencia.')
    } finally {
      setConfirmingTransfer(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-6 text-red-200">
          <p className="text-sm font-medium">No se pudo cargar el producto</p>
          <p className="mt-2 text-sm text-red-300/80">
            {error ?? 'Producto no encontrado'}
          </p>
        </div>

        <Link
          href="/orders"
          className="inline-flex items-center justify-center rounded-xl bg-zinc-800 px-4 py-2.5 text-sm text-white hover:bg-zinc-700"
        >
          Volver a órdenes
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-zinc-500">Detalle de orden</p>
          <h1 className="text-2xl font-bold text-white">
            #{order.order_number}
          </h1>
        </div>

        {actionMessage && (
          <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
            actionMessage.includes('correctamente')
              ? 'border-green-500/20 bg-green-500/10 text-green-200'
              : 'border-red-500/20 bg-red-500/10 text-red-200'
          }`}>
            {actionMessage}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {order.status === 'pending_transfer' && (
            <button
              type="button"
              onClick={confirmTransferPayment}
              disabled={confirmingTransfer}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-2.5 text-sm font-black text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2 size={16} />
              {confirmingTransfer ? 'Confirmando...' : 'Confirmar transferencia'}
            </button>
          )}

          <Link
            href="/orders"
            className="inline-flex items-center justify-center rounded-xl bg-zinc-800 px-4 py-2.5 text-sm text-white hover:bg-zinc-700"
          >
            Volver
          </Link>

          <Link
            href={`/orders/${order.id}/print`}
            target="_blank"
            className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-400"
          >
            Imprimir
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm text-zinc-400">Fecha</p>
          <p className="mt-1 text-white">{formatDate(order.created_at)}</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm text-zinc-400">Campus</p>
          <p className="mt-1 text-white">{campusName}</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm text-zinc-400">Método de pago</p>
          <p className="mt-1 text-white">
            {getPaymentLabel(order.payment_method)}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm text-zinc-400">Estado</p>
          <p className="mt-2">
            <span className={`inline-flex rounded-lg border px-3 py-1 text-sm font-semibold ${getStatusClass(order.status)}`}>
              {getStatusLabel(order.status)}
            </span>
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-4 text-lg font-semibold text-white">Productos</h2>

        <div className="space-y-4">
          {safeItems.length === 0 ? (
            <p className="text-sm text-zinc-500">No hay productos en esta orden.</p>
          ) : (
            safeItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between border-b border-zinc-800 pb-3"
              >
                <div>
                  <p className="font-medium text-white">{item.name}</p>
                  <p className="text-xs text-zinc-500">SKU: {item.sku}</p>
                  <p className="text-sm text-zinc-400">
                    {item.quantity} × {formatCurrency(item.unit_price)}
                  </p>
                </div>

                <p className="font-semibold text-white">
                  {formatCurrency(item.lineTotal)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-2">
        <div className="flex justify-between text-zinc-400">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>

        <div className="flex justify-between text-zinc-400">
          <span>Descuento</span>
          <span>{formatCurrency(discount)}</span>
        </div>

        <div className="flex justify-between text-xl font-bold text-white">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>

        {order.payment_type === 'deposit_50' && (
          <>
            <div className="border-t border-zinc-700 pt-3 mt-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-green-400 font-semibold">Pagado (50% abono)</span>
                <span className="text-lg font-bold text-green-400">
                  {formatCurrency(Number(order.amount_paid ?? 0))}
                </span>
              </div>
              {Number(order.balance_due ?? 0) > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-amber-400 font-semibold">Saldo pendiente</span>
                  <span className="text-lg font-bold text-amber-400">
                    {formatCurrency(Number(order.balance_due ?? 0))}
                  </span>
                </div>
              )}
              {Number(order.balance_due ?? 0) === 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-green-400 font-semibold">Saldo</span>
                  <span className="text-sm font-bold text-green-400">Completamente pagado ✓</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {order.notes && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-2 text-lg font-semibold text-white">Nota</h2>
          <p className="text-zinc-300">{order.notes}</p>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-3 text-lg font-semibold text-white">Acciones</h2>

        {actionMessage && (
          <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
            actionMessage.includes('correctamente')
              ? 'border-green-500/20 bg-green-500/10 text-green-200'
              : 'border-red-500/20 bg-red-500/10 text-red-200'
          }`}>
            {actionMessage}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {order.status === 'pending_transfer' && (
            <button
              type="button"
              onClick={confirmTransferPayment}
              disabled={confirmingTransfer}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-2.5 text-sm font-black text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2 size={16} />
              {confirmingTransfer ? 'Confirmando...' : 'Confirmar transferencia'}
            </button>
          )}

          <Link
            href={`/orders/${order.id}/print`}
            target="_blank"
            className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-400"
          >
            Imprimir ticket
          </Link>

          <ResendVoucherButton orderId={order.id} />

          {order.status === 'paid' && profile?.role !== 'voluntario' && (
            <button
              type="button"
              onClick={() => setShowRefundModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20"
            >
              <RotateCcw size={14} />
              Devolución
            </button>
          )}

          {order.tracking_token && (
            <Link
              href={`/track/${order.tracking_token}`}
              target="_blank"
              className="inline-flex items-center justify-center rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Ver tracking cliente
            </Link>
          )}
        </div>

        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-white">
            Enviar comprobante por correo
          </h3>
          <SendReceipt orderId={order.id} />
        </div>
      </div>

      {/* Refund Modal */}
      {showRefundModal && (
        <RefundModal
          orderId={order.id}
          orderNumber={order.order_number}
          items={items.map((item) => {
            const p = Array.isArray(item.products) ? item.products[0] : item.products
            return {
              id: item.id,
              product_id: '',
              quantity: item.quantity,
              unit_price: item.unit_price,
              refunded_qty: (item as any).refunded_qty ?? 0,
              products: p ?? { name: 'Producto', sku: null, image_url: null },
            }
          })}
          onClose={() => setShowRefundModal(false)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </div>
  )
}