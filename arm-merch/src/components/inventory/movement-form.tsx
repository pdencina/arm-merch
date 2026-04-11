'use client'

import { useState } from 'react'
import { X, TrendingUp, TrendingDown, RefreshCw, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Props {
  product: any
  campus: { id: string; name: string }[]
  onClose: () => void
  onSuccess: () => void
  userCampusId?: string | null
  isSuperAdmin?: boolean
}

type MovType = 'entrada' | 'salida' | 'ajuste'

const TYPES = [
  { value: 'entrada' as MovType, label: 'Entrada', icon: TrendingUp,   color: 'text-green-400 border-green-500/40 bg-green-500/10' },
  { value: 'salida'  as MovType, label: 'Salida',  icon: TrendingDown, color: 'text-red-400 border-red-500/40 bg-red-500/10'       },
  { value: 'ajuste'  as MovType, label: 'Ajuste',  icon: RefreshCw,    color: 'text-blue-400 border-blue-500/40 bg-blue-500/10'    },
]

export default function MovementForm({ product, campus, onClose, onSuccess, userCampusId, isSuperAdmin }: Props) {
  const [type, setType]         = useState<MovType>('entrada')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes]       = useState('')
  const [campusId, setCampusId] = useState(userCampusId ?? product.campus_id ?? '')
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

    setLoading(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      toast.error('Sesión expirada. Recarga la página.')
      setLoading(false)
      return
    }

    const { error: movError } = await supabase.from('inventory_movements').insert({
      product_id: product.id, type, quantity: qty,
      notes: notes.trim() || null, created_by: session.user.id,
    })

    if (movError) { toast.error(movError.message); setLoading(false); return }

    // Obtener el stock actual REAL del campus correcto desde la BD
    let realCurrentStock = currentStock
    if (campusId) {
      const { data: invRow } = await supabase.from('inventory')
        .select('stock').eq('product_id', product.id).eq('campus_id', campusId).single()
      if (invRow) realCurrentStock = invRow.stock ?? 0
    }

    const newStock = type === 'entrada' ? realCurrentStock + qty : realCurrentStock - qty

    // Actualizar SOLO el registro del campus correcto
    let invError = null
    if (campusId) {
      const { error } = await supabase.from('inventory')
        .update({
          stock: newStock,
          updated_by: session.user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('product_id', product.id)
        .eq('campus_id', campusId)
      invError = error
    } else {
      const { error } = await supabase.from('inventory')
        .update({ stock: newStock, updated_by: session.user.id, updated_at: new Date().toISOString() })
        .eq('product_id', product.id)
        .is('campus_id', null)
      invError = error
    }

    if (invError) { toast.error(invError.message); setLoading(false); return }

    const typeLabel = { entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste' }[type]
    toast.success(`${typeLabel} registrada — Stock actualizado a ${newStock} uds.`)
    onSuccess()
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

          <div>
            {isSuperAdmin ? (
            <>
              <label className="block text-xs text-zinc-500 mb-1.5">Asignar a campus</label>
              <select value={campusId} onChange={e => setCampusId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition">
                <option value="">Sin campus (inventario general)</option>
                {campus.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </>
          ) : null}
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-2">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setType(t.value)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-medium transition
                    ${type === t.value ? t.color : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300'}`}>
                  <t.icon size={13} />{t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Cantidad</label>
            <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)}
              placeholder="0" required
              className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600
                         rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition text-center text-lg font-bold" />
          </div>

          {qty > 0 && (
            <div className={`rounded-xl px-4 py-3 flex items-center justify-between border ${
              preview < 0 ? 'bg-red-500/10 border-red-500/20' :
              preview <= (product.low_stock_alert ?? 5) ? 'bg-orange-500/10 border-orange-500/20' :
              'bg-green-500/10 border-green-500/20'}`}>
              <span className="text-xs text-zinc-400">Stock resultante</span>
              <span className={`text-lg font-bold ${preview < 0 ? 'text-red-400' : preview <= (product.low_stock_alert ?? 5) ? 'text-orange-400' : 'text-green-400'}`}>
                {preview < 0 ? 'Insuficiente' : `${preview} uds.`}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Notas <span className="text-zinc-600">(opcional)</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Compra para evento, donación..." rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600
                         rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition resize-none" />
          </div>

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
