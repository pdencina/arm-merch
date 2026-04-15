'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

type CashSession = {
  id: string
  opened_at: string
  closed_at?: string | null
  opening_amount: number
  closing_amount_declared?: number | null
  sales_total: number
  orders_count: number
  difference: number
  status: 'open' | 'closed'
  notes?: string | null
}

function fmt(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

export default function CloseDayPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<CashSession | null>(null)
  const [openingAmount, setOpeningAmount] = useState(0)
  const [closingAmount, setClosingAmount] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadSession() {
    setLoading(true)

    const {
      data: { session: authSession },
    } = await supabase.auth.getSession()

    if (!authSession?.access_token) {
      toast.error('No autenticado')
      setLoading(false)
      return
    }

    const res = await fetch('/api/cash-session', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authSession.access_token}`,
      },
    })

    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error ?? 'No se pudo cargar caja')
      setLoading(false)
      return
    }

    setSession(data.session ?? null)
    setLoading(false)
  }

  useEffect(() => {
    loadSession()
  }, [])

  async function openCash() {
    setSaving(true)

    const {
      data: { session: authSession },
    } = await supabase.auth.getSession()

    if (!authSession?.access_token) {
      toast.error('No autenticado')
      setSaving(false)
      return
    }

    const res = await fetch('/api/cash-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authSession.access_token}`,
      },
      body: JSON.stringify({
        action: 'open',
        opening_amount: Number(openingAmount),
        notes: notes || null,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error ?? 'No se pudo abrir caja')
      setSaving(false)
      return
    }

    toast.success('Caja abierta correctamente')
    setNotes('')
    setOpeningAmount(0)
    setSession(data.session)
    setSaving(false)
  }

  async function closeCash() {
    setSaving(true)

    const {
      data: { session: authSession },
    } = await supabase.auth.getSession()

    if (!authSession?.access_token) {
      toast.error('No autenticado')
      setSaving(false)
      return
    }

    const res = await fetch('/api/cash-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authSession.access_token}`,
      },
      body: JSON.stringify({
        action: 'close',
        closing_amount_declared: Number(closingAmount),
        notes: notes || null,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error ?? 'No se pudo cerrar caja')
      setSaving(false)
      return
    }

    toast.success('Caja cerrada correctamente')
    setSession(null)
    setNotes('')
    setClosingAmount(0)
    setSaving(false)
  }

  if (loading) {
    return <div className="text-white">Cargando cierre de caja...</div>
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Cierre de caja</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Abre o cierra la caja del campus actual.
        </p>
      </div>

      {!session ? (
        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
          <h2 className="text-lg font-semibold text-white">Abrir caja</h2>

          <div className="mt-5 grid gap-4">
            <div>
              <label className="mb-1 block text-sm text-zinc-400">
                Monto inicial
              </label>
              <input
                type="number"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(Number(e.target.value))}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-zinc-400">
                Nota
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black"
              />
            </div>

            <button
              onClick={openCash}
              disabled={saving}
              className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-60"
            >
              {saving ? 'Abriendo...' : 'Abrir caja'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
            <h2 className="text-lg font-semibold text-white">Caja abierta</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-zinc-950/50 p-4">
                <p className="text-xs text-zinc-500">Abierta desde</p>
                <p className="mt-1 text-white">
                  {new Date(session.opened_at).toLocaleString('es-CL')}
                </p>
              </div>

              <div className="rounded-xl bg-zinc-950/50 p-4">
                <p className="text-xs text-zinc-500">Monto inicial</p>
                <p className="mt-1 text-white">{fmt(session.opening_amount)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
            <h2 className="text-lg font-semibold text-white">Cerrar caja</h2>

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-1 block text-sm text-zinc-400">
                  Monto contado al cierre
                </label>
                <input
                  type="number"
                  value={closingAmount}
                  onChange={(e) => setClosingAmount(Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-zinc-400">
                  Nota
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black"
                />
              </div>

              <button
                onClick={closeCash}
                disabled={saving}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {saving ? 'Cerrando...' : 'Cerrar caja'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}