'use client'

import { useState } from 'react'
import { X, TrendingUp, TrendingDown, RefreshCw, Loader2 } from 'lucide-react'
import { registerMovement } from '@/lib/actions/inventory'
import type { Product } from '@/types'

type MovType = 'entrada' | 'salida' | 'ajuste'

interface Props {
  product: Product
  onClose: () => void
  onSuccess: () => void
}

const TYPES: { value: MovType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'entrada', label: 'Entrada', icon: <TrendingUp size={14} />, color: 'text-green-400 border-green-500/40 bg-green-500/10' },
  { value: 'salida',  label: 'Salida',  icon: <TrendingDown size={14} />, color: 'text-red-400 border-red-500/40 bg-red-500/10' },
  { value: 'ajuste',  label: 'Ajuste',  icon: <RefreshCw size={14} />, color: 'text-blue-400 border-blue-500/40 bg-blue-500/10' },
]

export default function MovementForm({ product, onClose, onSuccess }: Props) {
  const [type, setType]         = useState<MovType>('entrada')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const currentStock = product.stock ?? 0
  const qty = parseInt(quantity) || 0

  const preview =
    type === 'entrada' ? currentStock + qty :
    type === 'salida'  ? currentStock - qty :
    currentStock - qty

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!qty || qty <= 0) { setError('Ingresa una cantidad válida'); return }
    if (type === 'salida' && qty > currentStock) {
      setError(`No puedes sacar más de lo que hay (${currentStock} uds.)`); return
    }

    setLoading(true)
    setError('')

    const result = await registerMovement({
      product_id: product.id,
      type,
      quantity: qty,
      notes: notes.trim() || undefined,
    })

    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    onSuccess()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
               display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm mx-4">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold text-white">Movimiento de stock</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{product.name}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">

          {/* Stock actual */}
          <div className="bg-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-zinc-500">Stock actual</span>
            <span className="text-lg font-bold text-white">{currentStock} uds.</span>
          </div>

          {/* Tipo de movimiento */}
          <div>
            <label className="block text-xs text-zinc-500 mb-2">Tipo de movimiento</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-medium transition
                    ${type === t.value ? t.color : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300'}`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cantidad */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Cantidad</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={e => { setQuantity(e.target.value); setError('') }}
              placeholder="0"
              required
              className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600
                         rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition
                         text-center text-lg font-bold"
            />
          </div>

          {/* Preview stock resultante */}
          {qty > 0 && (
            <div className={`rounded-xl px-4 py-3 flex items-center justify-between border
              ${preview < 0
                ? 'bg-red-500/10 border-red-500/20'
                : preview <= (product.low_stock_alert ?? 5)
                  ? 'bg-orange-500/10 border-orange-500/20'
                  : 'bg-green-500/10 border-green-500/20'}`}
            >
              <span className="text-xs text-zinc-400">Stock resultante</span>
              <span className={`text-lg font-bold ${
                preview < 0 ? 'text-red-400' :
                preview <= (product.low_stock_alert ?? 5) ? 'text-orange-400' :
                'text-green-400'
              }`}>
                {preview < 0 ? 'Insuficiente' : `${preview} uds.`}
              </span>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Notas <span className="text-zinc-600">(opcional)</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Compra de bodega, donación, inventario físico..."
              rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600
                         rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition resize-none"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium
                         rounded-xl py-2.5 text-sm transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || preview < 0}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed
                         text-zinc-950 font-bold rounded-xl py-2.5 text-sm transition flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Guardando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
