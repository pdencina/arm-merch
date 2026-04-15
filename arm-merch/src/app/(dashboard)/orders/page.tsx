'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

export default function OrdersPage() {
  const supabase = createClient()

  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadOrders() {
      setLoading(true)

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        setError('No autenticado')
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, campus_id')
        .eq('id', session.user.id)
        .single()

      let query = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          payment_method,
          subtotal,
          discount,
          total,
          notes,
          created_at,
          campus_id,
          seller_id,
          seller:profiles!orders_seller_id_fkey(full_name, email),
          campus:campus!orders_campus_id_fkey(name)
        `)
        .order('created_at', { ascending: false })

      if (profile?.role !== 'super_admin' && profile?.campus_id) {
        query = query.eq('campus_id', profile.campus_id)
      }

      const { data, error } = await query

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      setOrders(data ?? [])
      setLoading(false)
    }

    loadOrders()
  }, [supabase])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
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
          Historial de ventas con fecha y hora.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
        {orders.length === 0 ? (
          <p className="text-sm text-zinc-500">No hay órdenes registradas.</p>
        ) : (
          <div className="space-y-3">
            {orders.map((order: any) => {
              const sellerRaw = order.seller
              const sellerName = Array.isArray(sellerRaw)
                ? sellerRaw[0]?.full_name
                : sellerRaw?.full_name

              const campusRaw = order.campus
              const campusName = Array.isArray(campusRaw)
                ? campusRaw[0]?.name
                : campusRaw?.name

              return (
                <div
                  key={order.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-lg bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                          Orden #{order.order_number ?? order.id?.slice(0, 8)}
                        </span>
                        <span className="rounded-lg bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                          {order.payment_method || 'Sin método'}
                        </span>
                        <span className="rounded-lg bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                          {order.status || 'Sin estado'}
                        </span>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="rounded-lg bg-zinc-900 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                            Fecha y hora venta
                          </p>
                          <p className="mt-1 text-sm text-white">
                            {formatDateTime(order.created_at)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-zinc-900 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                            Vendedor
                          </p>
                          <p className="mt-1 text-sm text-white">
                            {sellerName || '—'}
                          </p>
                        </div>

                        <div className="rounded-lg bg-zinc-900 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                            Campus
                          </p>
                          <p className="mt-1 text-sm text-white">
                            {campusName || '—'}
                          </p>
                        </div>

                        <div className="rounded-lg bg-zinc-900 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                            Total
                          </p>
                          <p className="mt-1 text-sm font-medium text-amber-400">
                            {formatCurrency(Number(order.total ?? 0))}
                          </p>
                        </div>
                      </div>

                      {order.notes && (
                        <p className="text-xs text-zinc-500">
                          Nota: {order.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}