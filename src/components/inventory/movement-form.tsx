'use client'

import { useState } from 'react'
import { X, TrendingUp, TrendingDown, RefreshCw, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import ConfirmActionModal from '@/components/ui/confirm-action-modal'

interface Props {
  product: any
  campus: any[]
  onClose: () => void
  onSuccess: (newStock: number) => void
  userCampusId?: string | null
  isSuperAdmin?: boolean
}

type MovType = 'entrada' | 'salida' | 'ajuste'

const TYPES = [
  { value: 'entrada' as MovType, label: 'Entrada', icon: TrendingUp, color: 'text-green-400 border-green-500/40 bg-green-500/10' },
  { value: 'salida' as MovType, label: 'Salida', icon: TrendingDown, color: 'text-red-400 border-red-500/40 bg-red-500/10' },
  { value: 'ajuste' as MovType, label: 'Ajuste', icon: RefreshCw, color: 'text-blue-400 border-blue-500/40 bg-blue-500/10' },
]

export default function MovementForm({ product, onClose, onSuccess }: Props) {
  const [type, setType] = useState<MovType>('entrada')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const currentStock = product.stock ?? 0
  const qty = parseInt(quantity) || 0
  const preview =
    type === 'entrada'
      ? currentStock + qty
      : type === 'ajuste'
        ? qty
        : currentStock - qty

  async function executeSubmit() {
    setConfirmOpen(false)

    if (qty === null || qty === undefined || qty < 0) {
      toast.error('Ingresa una cantidad válida')
      return
    }

    if (type === 'salida' && qty > currentStock) {
      toast.error(`Stock insuficiente (${currentStock} disponibles)`)
      return
    }

    if (!product.inventory_id) {
      toast.error('Sin registro de inventario para este campus')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      toast.error('Sesión expirada')
      setLoading(false)
      return
    }

    const newStock =
      type === 'entrada'
        ? currentStock + qty
        : type === 'ajuste'
          ? qty
          : currentStock - qty

    await supabase.from('inventory_movements').insert({
      product_id: product.id,
      campus_id: product.campus_id,
      type,
      quantity: type === 'ajuste' ? Math.abs(newStock - currentStock) : qty,
      notes: notes.trim() || null,
      created_by: session.user.id,
    })

    const res = await fetch('/api/inventory', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        inventory_id: product.inventory_id,
        stock: newStock,
      }),
    })

    const result = await res.json()
    setLoading(false)

    if (!res.ok) {
      toast.error(result.error ?? 'Error al actualizar stock')
      return
    }

    toast.success(`Stock actualizado: ${newStock} uds.`)
    onSuccess(newStock)
  }

  function getConfirmDescription() {
    if (type === 'entrada') {
      return `Se sumarán ${qty} unidades al stock actual. El stock pasará de ${currentStock} a ${preview}.`
    }

    if (type === 'salida') {
      return `Se descontarán ${qty} unidades del stock actual. El stock pasará de ${currentStock} a ${preview}.`
    }

    return `Se ajustará el stock manualmente. El stock quedará fijado en ${preview}.`
  }

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 mx-4">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Movimiento de stock</h2>
              <p className="mt-0.5 text-xs text-zinc-500">{product.name}</p>
            </div>
            <button onClick={onClose} className="text-zinc-500 transition hover:text-white">
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between rounded-xl bg-zinc-800 px-4 py-3">
              <span className="text-xs text-zinc-500">Stock actual</span>
              <span className="text-lg font-bold text-white">{currentStock} uds.</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition ${
                    type === t.value
                      ? t.color
                      : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <t.icon size={13} />
                  {t.label}
                </button>
              ))}
            </div>

            <input
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={type === 'ajuste' ? 'Nuevo stock' : 'Cantidad'}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-center text-lg font-bold text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
            />

            {qty >= 0 && quantity !== '' && (
              <div
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  preview < 0
                    ? 'border-red-500/20 bg-red-500/10'
                    : preview <= 5
                      ? 'border-orange-500/20 bg-orange-500/10'
                      : 'border-green-500/20 bg-green-500/10'
                }`}
              >
                <span className="text-xs text-zinc-400">Stock resultante</span>
                <span
                  className={`text-lg font-bold ${
                    preview < 0
                      ? 'text-red-400'
                      : preview <= 5
                        ? 'text-orange-400'
                        : 'text-green-400'
                  }`}
                >
                  {preview < 0 ? 'Insuficiente' : `${preview} uds.`}
                </span>
              </div>
            )}

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas opcionales..."
              rows={2}
              className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loading || preview < 0 || quantity === ''}
                onClick={() => setConfirmOpen(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-40"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmActionModal
        open={confirmOpen}
        title="¿Confirmar movimiento de stock?"
        description={getConfirmDescription()}
        confirmText="Sí, registrar movimiento"
        cancelText="Cancelar"
        loading={loading}
        tone={type === 'salida' ? 'danger' : 'warning'}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={executeSubmit}
      />
    </>
  )
}