'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Telescope, RefreshCw } from 'lucide-react'

export default function ForecastPage() {
  const [period, setPeriod] = useState('month')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function load(nextPeriod = period) {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setError('Sesión no disponible')
        setLoading(false)
        return
      }

      const res = await fetch(`/api/ai/pastoral-dashboard?period=${nextPeriod}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const json = await res.json().catch(() => null)

      if (!res.ok) {
        setError(json?.error || 'No se pudo cargar Forecast')
        setLoading(false)
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

  return (
    <div className="space-y-5 text-white">
      <div className="flex flex-col gap-4 rounded-[28px] border border-zinc-800 bg-zinc-900 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-blue-300">
            <Telescope size={14} />
            Forecast
          </div>
          <h1 className="text-3xl font-black">Proyección ejecutiva</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Vista predictiva basada en ventas, stock, campus y pedidos pendientes.
          </p>
        </div>

        <div className="flex gap-2">
          <select
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value)
              load(e.target.value)
            }}
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-bold text-zinc-300 outline-none"
          >
            <option value="today">Hoy</option>
            <option value="7d">7 días</option>
            <option value="month">Mes actual</option>
            <option value="30d">30 días</option>
          </select>

          <button
            onClick={() => load(period)}
            disabled={loading}
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-black text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="rounded-[28px] border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-500">
          Cargando forecast...
        </div>
      )}

      {error && (
        <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-4">
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Resumen ejecutivo</p>
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              {data?.ai_summary || data?.executive_summary || data?.recommendation || 'Forecast cargado correctamente.'}
            </p>
          </div>

          <pre className="max-h-[520px] overflow-auto rounded-[28px] border border-zinc-800 bg-zinc-950 p-5 text-xs text-zinc-400">
            {JSON.stringify(data?.summary || data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
