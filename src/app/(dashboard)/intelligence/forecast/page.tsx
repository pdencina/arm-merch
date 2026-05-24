'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Telescope,
  RefreshCw,
  TrendingUp,
  CreditCard,
  Package,
  Truck,
  AlertTriangle,
  Building2,
  ShoppingBag,
  Wallet,
} from 'lucide-react'

type Period = 'today' | '7d' | 'month' | '30d'

const fmt = (value: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const numberFmt = (value: number) =>
  new Intl.NumberFormat('es-CL').format(Number(value || 0))

const periodOptions: Array<{ value: Period; label: string }> = [
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: '7 días' },
  { value: 'month', label: 'Mes actual' },
  { value: '30d', label: '30 días' },
]

function KpiCard({
  title,
  value,
  detail,
  icon: Icon,
  color = 'amber',
}: {
  title: string
  value: string
  detail: string
  icon: any
  color?: 'amber' | 'blue' | 'green' | 'red' | 'purple'
}) {
  const styles = {
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    blue: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
    green: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    red: 'border-red-500/20 bg-red-500/10 text-red-300',
    purple: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
  }[color]

  return (
    <div className="rounded-[28px] border border-zinc-800 bg-zinc-900 p-5">
      <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border ${styles}`}>
        <Icon size={19} />
      </div>
      <p className="text-xs font-black uppercase tracking-widest text-zinc-500">{title}</p>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{detail}</p>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4 text-sm text-zinc-600">
      {label}
    </div>
  )
}

export default function ForecastPage() {
  const [period, setPeriod] = useState<Period>('month')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function load(nextPeriod: Period = period) {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setError('Sesión no disponible')
        return
      }

      const res = await fetch(`/api/ai/pastoral-dashboard?period=${nextPeriod}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: 'no-store',
      })

      const json = await res.json().catch(() => null)

      if (!res.ok) {
        setError(json?.error || 'No se pudo cargar Forecast')
        return
      }

      setData(json)
    } catch (err: any) {
      setError(err?.message || 'Error cargando Forecast')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(period)
  }, [])

  const summary = data?.summary || data || {}

  const executiveText = useMemo(() => {
    return (
      data?.ai_summary ||
      data?.executive_summary ||
      data?.recommendation ||
      summary?.ai_summary ||
      summary?.executive_summary ||
      summary?.recommendation ||
      'Sin recomendación generada para este período.'
    )
  }, [data, summary])

  const topProducts = summary?.top_products || []
  const campusBreakdown = summary?.campus_breakdown || []
  const paymentBreakdown = summary?.payment_breakdown || []
  const criticalStock = summary?.critical_stock || []

  return (
    <div className="space-y-5 text-white">
      <div className="relative overflow-hidden rounded-[32px] border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-6">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-blue-300">
              <Telescope size={14} />
              Forecast
            </div>

            <h1 className="text-3xl font-black tracking-tight">Proyección ejecutiva</h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Lectura predictiva basada en ventas confirmadas, pagos pendientes, stock crítico, campus y productos.
            </p>
          </div>

          <div className="flex gap-2">
            <select
              value={period}
              onChange={(e) => {
                const next = e.target.value as Period
                setPeriod(next)
                load(next)
              }}
              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-bold text-zinc-300 outline-none transition focus:border-blue-500"
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => load(period)}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-black text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-[28px] border border-zinc-800 bg-zinc-900" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
          <div className="flex items-center gap-2 font-black">
            <AlertTriangle size={16} />
            No se pudo cargar Forecast
          </div>
          <p className="mt-2 text-red-200/80">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Resumen ejecutivo</p>
            <p className="mt-3 text-sm leading-7 text-zinc-300">{executiveText}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Ventas confirmadas"
              value={fmt(summary?.paid_sales || summary?.gross_sales || 0)}
              detail={`${numberFmt(summary?.paid_orders_count || summary?.orders_count || 0)} órdenes pagadas.`}
              icon={TrendingUp}
              color="green"
            />

            <KpiCard
              title="Ticket promedio"
              value={fmt(summary?.avg_ticket || 0)}
              detail="Promedio por orden pagada del período."
              icon={Wallet}
              color="amber"
            />

            <KpiCard
              title="Pagos pendientes"
              value={fmt(summary?.pending_payment_total || 0)}
              detail={`${numberFmt(summary?.pending_payment_orders || 0)} órdenes pendientes.`}
              icon={CreditCard}
              color={summary?.pending_payment_orders > 0 ? 'red' : 'blue'}
            />

            <KpiCard
              title="Stock crítico"
              value={numberFmt(summary?.critical_stock_count || criticalStock.length || 0)}
              detail="Productos que requieren revisión o reposición."
              icon={Package}
              color={criticalStock.length > 0 ? 'red' : 'green'}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-[28px] border border-zinc-800 bg-zinc-900 p-5">
              <div className="mb-4 flex items-center gap-2">
                <ShoppingBag size={17} className="text-amber-400" />
                <p className="text-sm font-black text-white">Productos top</p>
              </div>

              {topProducts.length === 0 ? (
                <EmptyState label="Sin productos vendidos en este período." />
              ) : (
                <div className="space-y-3">
                  {topProducts.slice(0, 6).map((product: any, index: number) => (
                    <div key={`${product.name}-${index}`} className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/50 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-zinc-200">{product.name}</p>
                        <p className="text-xs text-zinc-600">{numberFmt(product.quantity || product.qty || 0)} unidades</p>
                      </div>
                      <p className="text-sm font-black text-amber-400">{fmt(product.total || product.revenue || 0)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-zinc-800 bg-zinc-900 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Building2 size={17} className="text-blue-400" />
                <p className="text-sm font-black text-white">Campus</p>
              </div>

              {campusBreakdown.length === 0 ? (
                <EmptyState label="Sin ventas por campus en este período." />
              ) : (
                <div className="space-y-3">
                  {campusBreakdown.slice(0, 6).map((campus: any, index: number) => (
                    <div key={`${campus.name}-${index}`} className="rounded-2xl border border-zinc-800 bg-zinc-950/50 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-zinc-200">{campus.name}</p>
                        <p className="text-sm font-black text-blue-400">{fmt(campus.total || 0)}</p>
                      </div>
                      <p className="mt-1 text-xs text-zinc-600">
                        {numberFmt(campus.orders || 0)} órdenes · {numberFmt(campus.units || 0)} unidades
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-zinc-800 bg-zinc-900 p-5">
              <div className="mb-4 flex items-center gap-2">
                <CreditCard size={17} className="text-violet-400" />
                <p className="text-sm font-black text-white">Métodos de pago</p>
              </div>

              {paymentBreakdown.length === 0 ? (
                <EmptyState label="Sin pagos confirmados en este período." />
              ) : (
                <div className="space-y-3">
                  {paymentBreakdown.slice(0, 6).map((payment: any, index: number) => (
                    <div key={`${payment.method}-${index}`} className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/50 px-4 py-3">
                      <div>
                        <p className="text-sm font-bold text-zinc-200">{payment.method}</p>
                        <p className="text-xs text-zinc-600">{numberFmt(payment.orders || 0)} órdenes</p>
                      </div>
                      <p className="text-sm font-black text-violet-400">{fmt(payment.total || 0)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {criticalStock.length > 0 && (
            <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-5">
              <div className="mb-4 flex items-center gap-2 text-red-300">
                <AlertTriangle size={17} />
                <p className="text-sm font-black">Stock crítico detectado</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {criticalStock.slice(0, 12).map((product: any) => (
                  <span key={product.id || product.name} className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-200">
                    {product.name} · {numberFmt(product.stock || 0)} uds.
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
