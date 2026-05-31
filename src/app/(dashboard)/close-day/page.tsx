'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NotifyModal, useNotify } from '@/components/ui/notify-modal'
import {
  Banknote, Lock, LockOpen, TrendingUp, ShoppingBag,
  RefreshCw, CheckCircle2, AlertCircle, Clock,
  ChevronDown, ChevronUp, Building2, Calendar,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
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

type PaymentSummary = { method: string; total: number }

type CampusOverview = {
  campus_id: string
  campus_name: string
  session: CashSession | null
  sales_today: number
  orders_today: number
  payment_summary: PaymentSummary[]
  history: CashSession[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0)

function getSessionExpectedCash(session: any) {
  return Number(session?.opening_amount ?? 0) + Number(session?.sales_total ?? 0)
}

function numberInputValue(value: number | string | null | undefined) {
  const n = Number(value ?? 0)
  return n === 0 ? '' : String(value)
}

function formatSessionDuration(openedAt?: string | null, closedAt?: string | null) {
  if (!openedAt) return '—'

  const start = new Date(openedAt).getTime()
  const end = closedAt ? new Date(closedAt).getTime() : Date.now()

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return '—'
  }

  const diffMs = end - start
  const totalMinutes = Math.floor(diffMs / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

const fmtDate = (v: string) =>
  new Date(v).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

const PM_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  cash: 'Efectivo',
  transferencia: 'Transferencia',
  debito: 'Débito',
  credito: 'Crédito',
  solo: 'SumUp SOLO',
  link: 'Link de pago',
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function DiffBadge({ value }: { value: number }) {
  if (value === 0) return <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] font-bold text-zinc-300">Sin diferencia</span>
  if (value > 0)  return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">+{fmt(value)}</span>
  return <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">{fmt(value)}</span>
}

function StatusPill({ status }: { status: 'open' | 'closed' }) {
  return status === 'open'
    ? <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />Abierta</span>
    : <span className="flex items-center gap-1 rounded-full bg-zinc-700/60 px-2.5 py-1 text-[11px] font-bold text-zinc-400"><Lock size={10} />Cerrada</span>
}

// ──────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN VIEW — overview de todos los campus
// ──────────────────────────────────────────────────────────────────────────────
function SuperAdminView({ campuses }: { campuses: CampusOverview[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const totalSales   = campuses.reduce((s, c) => s + c.sales_today, 0)
  const totalOrders  = campuses.reduce((s, c) => s + c.orders_today, 0)
  const openCount    = campuses.filter(c => c.session?.status === 'open').length

  return (
    <div className="space-y-5">

      {/* Header stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Ventas totales hoy',   value: fmt(totalSales),       icon: TrendingUp,  color: 'text-amber-400',   bg: 'bg-amber-500/10'  },
          { label: 'Órdenes totales hoy',  value: String(totalOrders),   icon: ShoppingBag, color: 'text-blue-400',    bg: 'bg-blue-500/10'   },
          { label: 'Cajas abiertas',        value: `${openCount} / ${campuses.length}`, icon: LockOpen, color: openCount > 0 ? 'text-amber-400' : 'text-zinc-400', bg: openCount > 0 ? 'bg-amber-500/10' : 'bg-zinc-800' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.bg}`}>
                <Icon size={16} className={s.color} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{s.label}</p>
                <p className={`mt-0.5 text-xl font-black ${s.color}`}>{s.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Campus cards */}
      <div className="space-y-3">
        {campuses.map(c => {
          const isOpen   = c.session?.status === 'open'
          const isExpand = expanded === c.campus_id
          const payTotal = c.payment_summary.reduce((s, p) => s + p.total, 0)

          return (
            <div key={c.campus_id} className={`overflow-hidden rounded-2xl border transition ${
              isOpen ? 'border-amber-500/25 bg-zinc-900' : 'border-zinc-800 bg-zinc-900/60'
            }`}>

              {/* Main row */}
              <button
                onClick={() => setExpanded(isExpand ? null : c.campus_id)}
                className="flex w-full items-center gap-4 p-4 text-left"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isOpen ? 'bg-amber-500/15' : 'bg-zinc-800'}`}>
                  <Building2 size={16} className={isOpen ? 'text-amber-400' : 'text-zinc-500'} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <p className="font-semibold text-white">{c.campus_name}</p>
                    <StatusPill status={isOpen ? 'open' : 'closed'} />
                  </div>
                  {c.session && (
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {isOpen
                        ? `Abierta ${fmtDate(c.session.opened_at)}`
                        : `Cerrada ${c.session.closed_at ? fmtDate(c.session.closed_at) : '—'}`}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <p className="text-lg font-black text-white">{fmt(c.sales_today)}</p>
                  <p className="text-[10px] text-zinc-500">{c.orders_today} órdenes hoy</p>
                </div>

                {isExpand ? <ChevronUp size={15} className="text-zinc-500 shrink-0" /> : <ChevronDown size={15} className="text-zinc-500 shrink-0" />}
              </button>

              {/* Expanded detail */}
              {isExpand && (
                <div className="border-t border-zinc-800 px-4 pb-4 pt-3 space-y-4">

                  {/* Caja actual */}
                  {c.session ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                      {[
                        { label: 'Apertura', value: fmt(c.session.opening_amount) },
                        { label: 'Ventas sesión', value: fmt(c.session.sales_total) },
                        { label: 'Órdenes', value: String(c.session.orders_count) },
                        { label: 'Diferencia', value: <DiffBadge value={c.session.difference} /> },
                      ].map(item => (
                        <div key={item.label} className="rounded-xl bg-zinc-800/50 p-3">
                          <p className="text-[10px] uppercase tracking-wider text-zinc-600">{item.label}</p>
                          <div className="mt-1 text-sm font-semibold text-white">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-600 italic">Sin sesión de caja activa ni reciente.</p>
                  )}

                  {/* Desglose por método de pago */}
                  {c.payment_summary.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Ventas hoy por método</p>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        {c.payment_summary.map(pm => (
                          <div key={pm.method} className="flex items-center justify-between rounded-xl bg-zinc-800/40 px-3 py-2">
                            <span className="text-xs capitalize text-zinc-400">{PM_LABELS[pm.method] ?? pm.method}</span>
                            <span className="text-xs font-bold text-white">{fmt(pm.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Historial últimos 3 cierres */}
                  {c.history.filter(h => h.status === 'closed').length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Últimos cierres</p>
                      <div className="space-y-1.5">
                        {c.history.filter(h => h.status === 'closed').slice(0, 3).map(h => (
                          <div key={h.id} className="flex items-center justify-between rounded-xl bg-zinc-800/30 px-3 py-2">
                            <div>
                              <p className="text-xs text-zinc-300">{fmtDate(h.opened_at)}</p>
                              <p className="text-[10px] text-zinc-600">{h.orders_count} órdenes · {fmt(h.sales_total)} ventas</p>
                            </div>
                            <DiffBadge value={h.difference} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-zinc-700 pb-2">
        Solo los Admin de cada campus pueden abrir y cerrar su propia caja.
      </p>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// ADMIN VIEW — operación de su propia caja
// ──────────────────────────────────────────────────────────────────────────────
function AdminView({
  session, history, dailySalesTotal, dailyOrdersCount,
  paymentSummary, onRefresh,
}: {
  session: CashSession | null
  history: CashSession[]
  dailySalesTotal: number
  dailyOrdersCount: number
  paymentSummary: PaymentSummary[]
  onRefresh: () => void
}) {
  const [openingAmount, setOpeningAmount] = useState(0)
  const [closingAmount, setClosingAmount] = useState(0)
  const [notes, setNotes] = useState('')
  const { notify, success, error, close } = useNotify()
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const cashSalesTotal = useMemo(() => {
    return paymentSummary
      .filter((pm) => ['efectivo', 'cash'].includes(String(pm.method ?? '').toLowerCase()))
      .reduce((sum, pm) => sum + Number(pm.total ?? 0), 0)
  }, [paymentSummary])

  const digitalSalesTotal = useMemo(() => {
    return Math.max(0, Number(dailySalesTotal ?? 0) - cashSalesTotal)
  }, [dailySalesTotal, cashSalesTotal])

  const expectedCash = useMemo(() =>
    !session ? 0 : Number(session.opening_amount ?? 0) + cashSalesTotal,
    [session, cashSalesTotal]
  )

  const projectedDiff = useMemo(() =>
    !session ? 0 : Number(closingAmount || 0) - expectedCash,
    [closingAmount, expectedCash, session]
  )

  async function getToken() {
    const { data: { session: s } } = await supabase.auth.getSession()
    return s?.access_token ?? null
  }

  async function openCash() {
    setSaving(true)
    const token = await getToken()
    if (!token) { error('Sin sesión'); setSaving(false); return }

    const res = await fetch('/api/cash-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'open', opening_amount: Number(openingAmount), notes: notes || null }),
    })
    const data = await res.json()
    if (!res.ok) { error('Error', data.error); setSaving(false); return }
    success('Caja abierta', undefined, '💰')
    setNotes(''); setOpeningAmount(0)
    onRefresh(); setSaving(false)
  }

  async function closeCash() {
    setSaving(true)
    const token = await getToken()
    if (!token) { error('Sin sesión'); setSaving(false); return }

    const res = await fetch('/api/cash-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'close', closing_amount_declared: Number(closingAmount), notes: notes || null }),
    })
    const data = await res.json()
    if (!res.ok) { error('Error', data.error); setSaving(false); return }
    success('Caja cerrada', 'El arqueo fue registrado correctamente', '🔒')
    setNotes(''); setClosingAmount(0)
    onRefresh(); setSaving(false)
  }

  return (
    <div className="space-y-5">
      <NotifyModal notify={notify} onClose={close} />

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Ventas totales hoy', value: fmt(dailySalesTotal), color: 'text-amber-400', icon: TrendingUp },
          { label: 'Ventas efectivo', value: fmt(cashSalesTotal), color: 'text-emerald-400', icon: Banknote },
          { label: 'Ventas digitales', value: fmt(digitalSalesTotal), color: 'text-blue-400', icon: ShoppingBag },
          { label: 'Estado caja', value: session ? 'Abierta' : 'Cerrada',
            color: session ? 'text-amber-400' : 'text-zinc-400', icon: session ? LockOpen : Lock },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <Icon size={18} className={s.color} />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">{s.label}</p>
                <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4">

          {/* Open or Close form */}
          {!session ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15">
                  <LockOpen size={15} className="text-amber-400" />
                </div>
                <h2 className="font-semibold text-white">Abrir caja</h2>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Monto inicial físico en caja</label>
                  <input
                    type="number" min={0} value={numberInputValue(openingAmount)}
                    onChange={e => setOpeningAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-500/40"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Nota (opcional)</label>
                  <textarea
                    value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                    className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-500/40"
                    placeholder="Ej: Turno mañana..."
                  />
                </div>
                <button
                  onClick={openCash} disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3.5 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-50"
                >
                  {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" /> : <LockOpen size={16} />}
                  {saving ? 'Abriendo...' : 'Abrir caja'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Session info */}
              <div className="rounded-2xl border border-amber-500/20 bg-zinc-900 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15">
                      <Clock size={15} className="text-amber-400" />
                    </div>
                    <h2 className="font-semibold text-white">Caja abierta</h2>
                  </div>
                  <StatusPill status="open" />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                  {[
                    { label: 'Caja abierta desde', value: fmtDate(session.opened_at) },
                    { label: 'Duración sesión', value: formatSessionDuration(session.opened_at, session.closed_at ?? null) },
                    { label: 'Monto inicial', value: fmt(session.opening_amount) },
                    { label: 'Ventas efectivo de esta sesión', value: fmt(cashSalesTotal) },
                    { label: 'Ventas digitales informativas', value: fmt(digitalSalesTotal) },
                    { label: 'Caja esperada físico físico', value: fmt(expectedCash) },
                  ].map(item => (
                    <div key={item.label} className="rounded-xl bg-zinc-800/50 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-600">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 rounded-xl border border-amber-500/15 bg-amber-500/5 px-3 py-2">
                  <p className="text-[11px] leading-5 text-amber-200/80">
                    Resumen de arqueo: la caja esperada físico se calcula con monto inicial + ventas en efectivo de esta sesión.
                    SumUp, Link de Pago y Transferencia se muestran como ventas digitales informativas, pero no se suman al dinero físico contado.
                  </p>
                </div>
              </div>

              {/* Close form */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="mb-4 flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15">
                    <Lock size={15} className="text-blue-400" />
                  </div>
                  <h2 className="font-semibold text-white">Cerrar caja</h2>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Monto contado al cierre</label>
                    <input
                      type="number" min={0} value={numberInputValue(closingAmount)}
                      onChange={e => setClosingAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500/40"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-zinc-800/50 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-600">Caja esperada físico</p>
                      <p className="mt-1 text-sm font-semibold text-white">{fmt(expectedCash)}</p>
                    </div>
                    <div className="rounded-xl bg-zinc-800/50 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-600">Diferencia proyectada</p>
                      <p className={`mt-1 text-sm font-bold ${
                        projectedDiff === 0 ? 'text-zinc-300' : projectedDiff > 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>{fmt(projectedDiff)}</p>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Nota (opcional)</label>
                    <textarea
                      value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                      className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500/40"
                      placeholder="Observaciones del cierre..."
                    />
                  </div>

                  <button
                    onClick={closeCash} disabled={saving}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white transition hover:bg-blue-500 disabled:opacity-50"
                  >
                    {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" /> : <Lock size={16} />}
                    {saving ? 'Cerrando...' : 'Cerrar caja'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Payment breakdown */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h3 className="mb-3 text-sm font-semibold text-white">Desglose por método hoy</h3>
            {paymentSummary.length === 0 ? (
              <p className="text-xs text-zinc-600">Sin ventas hoy.</p>
            ) : (
              <div className="space-y-2">
                {paymentSummary.map(pm => {
                  const total = paymentSummary.reduce((s, p) => s + p.total, 0)
                  const pct = total > 0 ? (pm.total / total) * 100 : 0
                  return (
                    <div key={pm.method}>
                      <div className="flex justify-between text-xs">
                        <span className="capitalize text-zinc-400">{PM_LABELS[pm.method] ?? pm.method}</span>
                        <span className="font-bold text-white">{fmt(pm.total)}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                        <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* History */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h3 className="mb-1 text-sm font-semibold text-white">Historial de cierres</h3>
            <p className="mb-3 text-[11px] leading-5 text-zinc-500">
              Cada cierre corresponde a una sesión de caja. Puede incluir ventas de más de un día si la caja quedó abierta.
            </p>
            {history.filter(h => h.status === 'closed').length === 0 ? (
              <p className="text-xs text-zinc-600">Sin historial aún.</p>
            ) : (
              <div className="space-y-2">
                {history.filter(h => h.status === 'closed' && Number(h.difference ?? 0) > -10000).slice(0, 5).map(h => (
                  <div key={h.id} className="rounded-xl border border-zinc-800 bg-zinc-800/30 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-zinc-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={11} />
                          <span>Apertura: {fmtDate(h.opened_at)}</span>
                        </div>
                        {h.closed_at && (
                          <p className="mt-0.5 pl-4 text-[10px] text-zinc-600">
                            Cierre: {fmtDate(h.closed_at)}
                          </p>
                        )}
                      </div>
                      <DiffBadge value={h.difference} />
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="rounded-lg bg-zinc-950/40 px-3 py-2">
                        <p className="text-[9px] uppercase tracking-wider text-zinc-600">Duración sesión</p>
                        <p className="mt-1 text-xs text-zinc-300">
                          {formatSessionDuration(h.opened_at, h.closed_at)}
                        </p>
                      </div>

                      <div className="rounded-lg bg-zinc-950/40 px-3 py-2">
                        <p className="text-[9px] uppercase tracking-wider text-zinc-600">Monto inicial</p>
                        <p className="mt-1 text-xs text-zinc-300">{fmt(h.opening_amount)}</p>
                      </div>

                      <div className="rounded-lg bg-zinc-950/40 px-3 py-2">
                        <p className="text-[9px] uppercase tracking-wider text-zinc-600">Ventas efectivo</p>
                        <p className="mt-1 text-xs text-emerald-300">{fmt(h.sales_total)}</p>
                      </div>

                      <div className="rounded-lg bg-zinc-950/40 px-3 py-2">
                        <p className="text-[9px] uppercase tracking-wider text-zinc-600">Caja esperada</p>
                        <p className="mt-1 text-xs text-amber-300">{fmt(getSessionExpectedCash(h))}</p>
                      </div>
                    </div>

                    <p className="mt-2 text-[11px] text-zinc-600">
                      {h.orders_count ?? 0} órdenes de efectivo consideradas en este cierre
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ──────────────────────────────────────────────────────────────────────────────
export default function CloseDayPage() {
  const supabase = createClient()

  const [role, setRole]             = useState<string>('')
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Admin state
  const [session, setSession]               = useState<CashSession | null>(null)
  const [history, setHistory]               = useState<CashSession[]>([])
  const [dailySalesTotal, setDailySalesTotal] = useState(0)
  const [dailyCashSalesTotal, setDailyCashSalesTotal] = useState(0)
  const [dailyOrdersCount, setDailyOrdersCount] = useState(0)
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary[]>([])

  // Super admin state
  const [campusOverviews, setCampusOverviews] = useState<CampusOverview[]>([])

  async function load(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const { data: { session: auth } } = await supabase.auth.getSession()
    if (!auth) { setLoading(false); setRefreshing(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, campus_id')
      .eq('id', auth.user.id)
      .single()

    setRole(profile?.role ?? '')

    if (profile?.role === 'super_admin') {
      // Load all campuses and their sessions
      const { data: campuses } = await supabase
        .from('campus')
        .select('id, name')
        .eq('active', true)
        .order('name')

      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

      const overviews: CampusOverview[] = await Promise.all(
        (campuses ?? []).map(async (c: any) => {
          const [{ data: sessions }, { data: orders }] = await Promise.all([
            supabase.from('cash_sessions').select('*').eq('campus_id', c.id)
              .order('opened_at', { ascending: false }).limit(10),
            supabase.from('orders').select('total, payment_method')
              .eq('campus_id', c.id)
              .eq('status', 'paid')
              .gte('created_at', todayStart.toISOString()),
          ])

          const openSession = (sessions ?? []).find((s: any) => s.status === 'open') ?? null
          const salesTotal  = (orders ?? []).reduce((s: number, o: any) => s + Number(o.total ?? 0), 0)
          const pmMap: Record<string, number> = {}
          ;(orders ?? []).forEach((o: any) => { pmMap[o.payment_method] = (pmMap[o.payment_method] || 0) + Number(o.total ?? 0) })

          return {
            campus_id:       c.id,
            campus_name:     c.name,
            session:         openSession,
            sales_today:     salesTotal,
            orders_today:    (orders ?? []).length,
            payment_summary: Object.entries(pmMap).map(([method, total]) => ({ method, total })),
            history:         sessions ?? [],
          }
        })
      )

      setCampusOverviews(overviews)
    } else {
      // Admin — use existing API
      const res = await fetch('/api/cash-session', {
        headers: { Authorization: `Bearer ${auth.access_token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setSession(data.session ?? null)
        setHistory(data.history ?? [])
        setDailySalesTotal(Number(data.daily_summary?.sales_total ?? 0))
        setDailyCashSalesTotal(Number(data.daily_summary?.cash_sales_total ?? 0))
        setDailyOrdersCount(Number(data.daily_summary?.orders_count ?? 0))
        setPaymentSummary(data.daily_summary?.payment_summary ?? [])
      } else {
        console.error('Error cargando caja:', data.error)
      }
    }

    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-500" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">
            {role === 'super_admin' ? 'Arqueo de cajas' : 'Cierre de caja'}
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            {role === 'super_admin'
              ? 'Vista global del estado de caja por campus'
              : 'Apertura, cierre e historial de tu campus'}
          </p>
        </div>
        <button
          onClick={() => load(true)} disabled={refreshing}
          className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-400 transition hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {role === 'super_admin' ? (
        <SuperAdminView campuses={campusOverviews} />
      ) : (
        <AdminView
          session={session}
          history={history}
          dailySalesTotal={dailySalesTotal}
          dailyOrdersCount={dailyOrdersCount}
          paymentSummary={paymentSummary}
          onRefresh={() => load(true)}
        />
      )}
    </div>
  )
}
