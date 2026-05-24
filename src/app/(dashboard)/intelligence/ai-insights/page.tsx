'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Sparkles, RefreshCw } from 'lucide-react'

export default function AiInsightsPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Sesión no disponible')
        return
      }

      const res = await fetch('/api/ai/pastoral-insights', {
        headers: { Authorization: `Bearer ${session.access_token}` },
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

  useEffect(() => { load() }, [])

  const insights = data?.insights || data?.summary?.insights || []

  return (
    <div className="space-y-5 text-white">
      <div className="flex items-center justify-between rounded-[28px] border border-zinc-800 bg-zinc-900 p-6">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-violet-300">
            <Sparkles size={14} /> IA Insights
          </div>
          <h1 className="text-3xl font-black">Lectura ejecutiva IA</h1>
          <p className="mt-2 text-sm text-zinc-500">Recomendaciones automáticas para decisiones comerciales y operativas.</p>
        </div>
        <button onClick={load} disabled={loading} className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-black text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && <div className="rounded-[28px] border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-500">Cargando insights...</div>}
      {error && <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">{error}</div>}

      {!loading && !error && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {insights.map((item: any, index: number) => (
            <div key={index} className="rounded-[28px] border border-zinc-800 bg-zinc-900 p-5">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-500">{item.title}</p>
              <p className="mt-3 text-2xl font-black text-white">{item.value}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{item.detail}</p>
            </div>
          ))}

          {(data?.recommendation || data?.ai_recommendation) && (
            <div className="rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-5 md:col-span-2 xl:col-span-3">
              <p className="text-xs font-black uppercase tracking-widest text-amber-300">Recomendación</p>
              <p className="mt-3 text-sm leading-7 text-amber-100">{data?.ai_recommendation || data?.recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
