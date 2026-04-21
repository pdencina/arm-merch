'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Search } from 'lucide-react'

type OrderRow = {
  id: string
  order_number: number | string
  campus_id: string | null
  seller_id?: string | null
  payment_method: string | null
  total: number
  discount?: number | null
  created_at: string
  status?: string | null
  notes?: string | null
}

type CampusRow = {
  id: string
  name: string
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

export default function OrdersPage() {
  const supabase = createClient()

  const [orders, setOrders] = useState<OrderRow[]>([])
  const [campuses, setCampuses] = useState<CampusRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        setError('No autenticado')
        setLoading(false)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, campus_id')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile) {
        setError(profileError?.message ?? 'No se pudo cargar el perfil')
        setLoading(false)
        return
      }

      let ordersQuery = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          campus_id,
          seller_id,
          payment_method,
          total,
          discount,
          created_at,
          status,
          notes
        `)
        .order('created_at', { ascending: false })

      if (profile.role !== 'super_admin' && profile.campus_id) {
        ordersQuery = ordersQuery.eq('campus_id', profile.campus_id)
      }

      const [
        { data: ordersData, error: ordersError },
        { data: campusData, error: campusError },
      ] = await Promise.all([
        ordersQuery,
        supabase
          .from('campus')
          .select('id, name')
          .order('name'),
      ])

      if (ordersError) {
        setError(ordersError.message)
        setLoading(false)
        return
      }

      if (campusError) {
        setError(campusError.message)
        setLoading(false)
        return
      }

      setOrders((ordersData ?? []) as OrderRow[])
      setCampuses((campusData ?? []) as CampusRow[])
      setLoading(false)
    }

    load()
  }, [supabase])

  const campusMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const campus of campuses) {
      map.set(campus.id, campus.name)
    }
    return map
  }, [campuses])

  const statusOptions = useMemo(() => {
    return Array.from(
      new Set(orders.map((o) => o.status).filter(Boolean))
    ) as string[]
  }, [orders])

  const paymentOptions = useMemo(() => {
    return Array.from(
      new Set(orders.map((o) => o.payment_method).filter(Boolean))
    ) as string[]
  }, [orders])

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const text = search.toLowerCase().trim()
      const campusName = order.campus_id ? campusMap.get(order.campus_id) ?? '' : ''

      const matchesSearch =
        !text ||
        String(order.order_number).toLowerCase().includes(text) ||
        (order.payment_method ?? '').toLowerCase().includes(text) ||
        (order.status ?? '').toLowerCase().includes(text) ||
        campusName.toLowerCase().includes(text)

      const matchesStatus =
        !statusFilter || order.status === statusFilter

      const matchesPayment =
        !paymentFilter || order.payment_method === paymentFilter

      return matchesSearch && matchesStatus && matchesPayment
    })
  }, [orders, search, statusFilter, paymentFilter, campusMap])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-6 text-red-200">
        <p className="text-sm font-medium">Error cargando órdenes</p>
        <p className="mt-2 text-sm text-red-300/80">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Órdenes</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {filteredOrders.length} órdenes encontradas
        </p>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            type="text"
            placeholder="Buscar por número, estado, pago o campus..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-12 py-3 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
        >
          <option value="">Todos los estados</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
        >
          <option value="">Todos los pagos</option>
          {paymentOptions.map((payment) => (
            <option key={payment} value={payment}>
              {payment}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-zinc-700/60 bg-zinc-900/50 xl:block">
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_180px] gap-4 border-b border-zinc-800 px-6 py-4 text-sm text-zinc-400">
          <div>N° Orden</div>
          <div>Campus</div>
          <div>Método pago</div>
          <div>Total</div>
          <div>Estado</div>
          <div>Fecha</div>
          <div>Acción</div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="px-6 py-10 text-sm text-zinc-500">
            No hay órdenes para mostrar.
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_180px] gap-4 border-b border-zinc-800/70 px-6 py-4 last:border-b-0"
            >
              <div className="font-medium text-white">
                #{order.order_number}
              </div>

              <div className="text-zinc-300">
                {order.campus_id ? campusMap.get(order.campus_id) ?? 'Sin campus' : 'Sin campus'}
              </div>

              <div className="text-zinc-300">
                {order.payment_method ?? 'Sin definir'}
              </div>

              <div className="font-semibold text-amber-400">
                {formatCurrency(Number(order.total ?? 0))}
              </div>

              <div>
                <span className="rounded-lg bg-zinc-800 px-3 py-1 text-sm text-zinc-300">
                  {order.status ?? '—'}
                </span>
              </div>

              <div className="text-zinc-400">
                {formatDate(order.created_at)}
              </div>

              <div>
                <Link
                  href={`/orders/${order.id}`}
                  className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  Ver detalle
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:hidden">
        {filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5 text-sm text-zinc-500">
            No hay órdenes para mostrar.
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-white">#{order.order_number}</p>
                <span className="rounded-lg bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                  {order.status ?? '—'}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-zinc-950/50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">Campus</p>
                  <p className="mt-1 text-white">
                    {order.campus_id ? campusMap.get(order.campus_id) ?? 'Sin campus' : 'Sin campus'}
                  </p>
                </div>

                <div className="rounded-xl bg-zinc-950/50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">Pago</p>
                  <p className="mt-1 text-white">{order.payment_method ?? 'Sin definir'}</p>
                </div>

                <div className="rounded-xl bg-zinc-950/50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">Total</p>
                  <p className="mt-1 font-semibold text-amber-400">
                    {formatCurrency(Number(order.total ?? 0))}
                  </p>
                </div>

                <div className="rounded-xl bg-zinc-950/50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">Fecha</p>
                  <p className="mt-1 text-white">{formatDate(order.created_at)}</p>
                </div>
              </div>

              <div className="mt-4">
                <Link
                  href={`/orders/${order.id}`}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  Ver detalle
                </Link>
              </div>

              {order.notes && (
                <div className="mt-3 rounded-xl bg-zinc-950/50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">Nota</p>
                  <p className="mt-1 text-sm text-zinc-300">{order.notes}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}