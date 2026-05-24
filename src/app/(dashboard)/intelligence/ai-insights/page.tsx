'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Sparkles,
  RefreshCw,
  TrendingUp,
  Package,
  Truck,
  AlertTriangle,
  CheckCircle2,
  ShoppingBag,
} from 'lucide-react'

const fmt = (value: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const severityStyles: Record<string, string> = {
  success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  danger: 'border-red-500/20 bg-red-500/10 text-red-300',
  info: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
}

function getIcon(title: string) {
  const t = String(title || '').toLowerCase()
  if (t.includes('venta')) return TrendingUp
  if (t.includes('producto')) return ShoppingBag
  if (t.includes('stock')) return Package
  if (t.includes('pedido')) return Truck
  return Sparkles
}

export default function AiInsightsPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
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

      const res = await fetch('/api/ai/pastoral-insights', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: 'no-store',
      })

      const json = await res.json().catch(() => null)

      if (!res.ok) {
        setError(json?.error || 'No se pudieron cargar los insights')
        return
      }

      setData(json)
    } catch (err: any) {
      setError(err?.message || 'Error cargando IA Insights')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const insights = useMemo(() => {
    return data?.insights || data?.summary?.insights || []
  }, [data])

  const recommendation = data?.ai_recommendation || data?.recommendation || data?.summary?.recommendation

  return (
    <div className="space-y-5 text-white">
      <div className="relative overflow-hidden rounded-[32px] border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-6">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-violet-300">
              <Sparkles size={14} />
              IA Insights
            </div>

            <h1 className="text-3xl font-black tracking-tight">Lectura ejecutiva IA</h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Recomendaciones automáticas para leer ventas, stock, productos y operación con enfoque ejecutivo.
            </p>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-black text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {loading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-[28px] border border-zinc-800 bg-zinc-900" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
          <div className="flex items-center gap-2 font-black">
            <AlertTriangle size={16} />
            No se pudo cargar IA Insights
          </div>
          <p className="mt-2 text-red-200/80">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {insights.map((item: any, index: number) => {
              const Icon = getIcon(item.title)
              const style = severityStyles[item.severity] || severityStyles.info

              return (
                <div key={index} className="rounded-[28px] border border-zinc-800 bg-zinc-900 p-5">
                  <div className="mb-5 flex items-start justify-between">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${style}`}>
                      <Icon size={19} />
                    </div>

                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${style}`}>
                      {item.severity || 'info'}
                    </span>
                  </div>

                  <p className="text-xs font-black uppercase tracking-widest text-zinc-500">{item.title}</p>
                  <p className="mt-3 text-2xl font-black text-white">{item.value}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">{item.detail}</p>
                </div>
              )
            })}
          </div>

          {recommendation && (
            <div className="rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-6">
              <div className="mb-3 flex items-center gap-2 text-amber-300">
                <CheckCircle2 size={18} />
                <p className="text-xs font-black uppercase tracking-widest">Recomendación ejecutiva</p>
              </div>

              <p className="text-sm leading-7 text-amber-50">{recommendation}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
