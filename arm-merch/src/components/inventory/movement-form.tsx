'use client'

import { useState } from 'react'
import { X, TrendingUp, TrendingDown, RefreshCw, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Props {
  product: any  // debe tener inventory_id y stock
  campus: any[]
  onClose: () => void
  onSuccess: (newStock: number) => void
  userCampusId?: string | null
  isSuperAdmin?: boolean
}

type MovType = 'entrada' | 'salida' | 'ajuste'

const TYPES = [
  { value: 'entrada' as MovType, label: 'Entrada', icon: TrendingUp,   color: 'text-green-400 border-green-500/40 bg-green-500/10' },
  { value: 'salida'  as MovType, label: 'Salida',  icon: TrendingDown, color: 'text-red-400 border-red-500/40 bg-red-500/10'       },
  { value: 'ajuste'  as MovType, label: 'Ajuste',  icon: RefreshCw,    color: 'text-blue-400 border-blue-500/40 bg-blue-500/10'    },
]

export default function MovementForm({ product, onClose, onSuccess, userCampusId }: Props) {
  const [type, setType]         = useState<MovType>('entrada')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes]       = useState('')
  const [loading, setLoading]   = useState(false)

  const currentStock = product.stock ?? 0
  const qty          = parseInt(quantity) || 0
  const preview      = type === 'entrada' ? currentStock + qty : currentStock - qty

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!qty || qty <= 0) { toast.error('Ingresa una cantidad válida'); return }
    if (type !== 'entrada' && qty > currentStock) {
      toast.error(`Stock insuficiente (${currentStock} disponibles)`); return
    }
    if (!product.inventory_id) {
      toast.error('Sin registro de inventario para este campus'); return
    }

    setLoading(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { toast.error('Sesión expirada'); setLoading(false); return }

    const newStock = type === 'entrada' ? currentStock + qty : currentStock - qty

    // 1. Registrar movimiento
    await supabase.from('inventory_movements').insert({
      product_id: product.id,
      type, quantity: qty,
      notes: notes.trim() || null,
      created_by: session.user.id,
    })

    // 2. Actualizar stock via API Route (service role - bypasea RLS)
    const res = await fetch('/api/inventory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inventory_id: product.inventory_id,
        stock: newStock,
      })
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

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold text-white">Movimiento de stock</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{product.name}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="bg-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-zinc-500">Stock actual</span>
            <span className="text-lg font-bold text-white">{currentStock} uds.</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => setType(t.value)}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-medium transition
                  ${type === t.value ? t.color : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300'}`}>
                <t.icon size={13} />{t.label}
              </button>
            ))}
          </div>

          <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)}
            placeholder="Cantidad" required
            className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600
                       rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition text-center text-lg font-bold" />

          {qty > 0 && (
            <div className={`rounded-xl px-4 py-3 flex items-center justify-between border ${
              preview < 0 ? 'bg-red-500/10 border-red-500/20' :
              preview <= 5 ? 'bg-orange-500/10 border-orange-500/20' :
              'bg-green-500/10 border-green-500/20'}`}>
              <span className="text-xs text-zinc-400">Stock resultante</span>
              <span className={`text-lg font-bold ${preview < 0 ? 'text-red-400' : preview <= 5 ? 'text-orange-400' : 'text-green-400'}`}>
                {preview < 0 ? 'Insuficiente' : `${preview} uds.`}
              </span>
            </div>
          )}

          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Notas opcionales..." rows={2}
            className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600
                       rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition resize-none" />

          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl py-2.5 text-sm transition">
              Cancelar
            </button>
            <button type="submit" disabled={loading || preview < 0}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 font-bold rounded-xl py-2.5 text-sm transition flex items-center justify-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Guardando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
