'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowRightLeft, Plus, Package, MapPin, Clock, Check, X, Truck } from 'lucide-react'
import { clsx } from 'clsx'

interface Transfer {
  id: string
  quantity: number
  status: string
  notes: string | null
  requested_at: string
  approved_at: string | null
  received_at: string | null
  product: { id: string; name: string; sku: string | null; image_url: string | null }
  from_campus: { id: string; name: string }
  to_campus: { id: string; name: string }
  requester: { id: string; full_name: string } | null
  approver: { id: string; full_name: string } | null
  receiver: { id: string; full_name: string } | null
}

interface Campus {
  id: string
  name: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pendiente', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', icon: <Clock size={12} /> },
  in_transit: { label: 'En tránsito', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: <Truck size={12} /> },
  received: { label: 'Recibida', color: 'bg-green-500/10 text-green-400 border-green-500/20', icon: <Check size={12} /> },
  cancelled: { label: 'Cancelada', color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: <X size={12} /> },
}

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [campusList, setCampusList] = useState<Campus[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [profile, setProfile] = useState<any>(null)

  // Form state
  const [formData, setFormData] = useState({
    from_campus_id: '',
    to_campus_id: '',
    product_id: '',
    quantity: 1,
    notes: '',
  })
  const [products, setProducts] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [filter])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Load profile
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, role, campus_id')
      .eq('id', session.user.id)
      .single()
    setProfile(prof)

    // Load transfers
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('status', filter)

    const res = await fetch(`/api/transfers?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const data = await res.json()
    setTransfers(data.transfers ?? [])

    // Load campus list
    const { data: campuses } = await supabase
      .from('campus')
      .select('id, name')
      .eq('active', true)
      .order('name')
    setCampusList(campuses ?? [])

    setLoading(false)
  }

  async function loadProducts(campusId: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('inventory')
      .select('product_id, stock, product:products(id, name, sku)')
      .eq('campus_id', campusId)
      .gt('stock', 0)
      .order('stock', { ascending: false })

    setProducts(data ?? [])
  }

  async function handleSubmit() {
    setError('')
    if (!formData.from_campus_id || !formData.to_campus_id || !formData.product_id || formData.quantity < 1) {
      setError('Completa todos los campos')
      return
    }

    setSubmitting(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const res = await fetch('/api/transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(formData),
    })

    const result = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(result.error ?? 'Error al crear transferencia')
      return
    }

    setShowForm(false)
    setFormData({ from_campus_id: '', to_campus_id: '', product_id: '', quantity: 1, notes: '' })
    loadData()
  }

  async function handleAction(transferId: string, action: string) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    await fetch('/api/transfers', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ transfer_id: transferId, action }),
    })

    loadData()
  }

  const canCreate = profile?.role === 'super_admin' || profile?.role === 'adm_merch' || profile?.role === 'admin'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <ArrowRightLeft size={20} className="text-amber-400" />
            Transferencias entre campus
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Gestiona el movimiento de productos entre puntos de venta
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-amber-400"
          >
            <Plus size={16} />
            Nueva transferencia
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {['all', 'pending', 'in_transit', 'received', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={clsx(
              'rounded-xl px-3 py-1.5 text-xs font-medium transition',
              filter === s
                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700 hover:bg-zinc-800'
            )}
          >
            {s === 'all' ? 'Todas' : STATUS_CONFIG[s]?.label ?? s}
          </button>
        ))}
      </div>

      {/* Transfer List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        </div>
      ) : transfers.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
          <ArrowRightLeft size={32} className="mx-auto text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-500">No hay transferencias</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transfers.map((t) => {
            const config = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.pending

            return (
              <div
                key={t.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 transition hover:border-zinc-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                      <Package size={18} className="text-zinc-400" />
                    </div>

                    <div>
                      <p className="font-semibold text-white">{t.product?.name}</p>
                      <p className="text-xs text-zinc-500">
                        {t.product?.sku && <span className="mr-2">SKU: {t.product.sku}</span>}
                        Cantidad: <span className="font-bold text-zinc-300">{t.quantity}</span>
                      </p>

                      <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                        <MapPin size={12} />
                        <span className="font-medium text-zinc-300">{t.from_campus?.name}</span>
                        <ArrowRightLeft size={12} className="text-amber-400" />
                        <span className="font-medium text-zinc-300">{t.to_campus?.name}</span>
                      </div>

                      {t.requester && (
                        <p className="mt-1 text-[10px] text-zinc-500">
                          Solicitado por {t.requester.full_name} · {new Date(t.requested_at).toLocaleDateString('es-CL')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className={clsx('flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold', config.color)}>
                      {config.icon}
                      {config.label}
                    </span>

                    {/* Action buttons */}
                    <div className="flex gap-1">
                      {t.status === 'pending' && (profile?.role === 'super_admin' || profile?.role === 'adm_merch') && (
                        <>
                          <button
                            onClick={() => handleAction(t.id, 'approve')}
                            className="rounded-lg bg-green-500/10 px-2 py-1 text-[10px] font-bold text-green-400 transition hover:bg-green-500/20"
                          >
                            Aprobar
                          </button>
                          <button
                            onClick={() => handleAction(t.id, 'cancel')}
                            className="rounded-lg bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-400 transition hover:bg-red-500/20"
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                      {t.status === 'in_transit' && (
                        <button
                          onClick={() => handleAction(t.id, 'receive')}
                          className="rounded-lg bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-400 transition hover:bg-blue-500/20"
                        >
                          Confirmar recepción
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Transfer Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-zinc-700 bg-zinc-900 p-6">
            <h2 className="text-lg font-bold text-white">Nueva transferencia</h2>
            <p className="mt-1 text-sm text-zinc-400">Mover productos entre campus</p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-400">Campus origen</label>
                <select
                  value={formData.from_campus_id}
                  onChange={(e) => {
                    setFormData({ ...formData, from_campus_id: e.target.value, product_id: '' })
                    if (e.target.value) loadProducts(e.target.value)
                  }}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white"
                >
                  <option value="">Seleccionar...</option>
                  {campusList.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400">Campus destino</label>
                <select
                  value={formData.to_campus_id}
                  onChange={(e) => setFormData({ ...formData, to_campus_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white"
                >
                  <option value="">Seleccionar...</option>
                  {campusList
                    .filter((c) => c.id !== formData.from_campus_id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400">Producto</label>
                <select
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white"
                  disabled={!formData.from_campus_id}
                >
                  <option value="">Seleccionar producto...</option>
                  {products.map((p: any) => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.product?.name} (Stock: {p.stock})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400">Cantidad</label>
                <input
                  type="number"
                  min={1}
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400">Notas (opcional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white"
                  rows={2}
                />
              </div>

              {error && <p className="text-xs font-medium text-red-400">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-50"
                >
                  {submitting ? 'Creando...' : 'Crear transferencia'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
