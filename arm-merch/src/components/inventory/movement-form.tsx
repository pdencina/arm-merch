'use client'

import { useState } from 'react'
import { X, TrendingUp, TrendingDown, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

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
  {
    value: 'entrada' as MovType,
    label: 'Entrada',
    icon: TrendingUp,
    color: 'text-green-400 border-green-500/40 bg-green-500/10',
  },
  {
    value: 'salida' as MovType,
    label: 'Salida',
    icon: TrendingDown,
    color: 'text-red-400 border-red-500/40 bg-red-500/10',
  },
  {
    value: 'ajuste' as MovType,
    label: 'Ajuste',
    icon: RefreshCw,
    color: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  },
]

export default function MovementForm({
  product,
  onClose,
  onSuccess,
  userCampusId,
}: Props) {
  const [type, setType] = useState<MovType>('entrada')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const currentStock = product.stock ?? 0
  const qty = parseInt(quantity) || 0

  const preview =
    type === 'entrada'
      ? currentStock + qty
      : type === 'salida'
        ? currentStock - qty
        : qty

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!qty || qty < 0) {
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

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      setLoading(false)
      toast.error('Sesión expirada')
      return
    }

    let campusId = userCampusId ?? product.campus_id ?? null

    if (!campusId) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('campus_id')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile?.campus_id) {
        setLoading(false)
        toast.error('No se pudo resolver el campus del usuario')
        return
      }

      campusId = profile.campus_id
    }

    const newStock =
      type === 'entrada'
        ? currentStock + qty
        : type === 'salida'
          ? currentStock - qty
          : qty

    if (newStock < 0) {
      setLoading(false)
      toast.error('El stock no puede quedar negativo')
      return
    }

    const { error: updateError } = await supabase
      .from('inventory')
      .update({
        stock: newStock,
        updated_by: session.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', product.inventory_id)

    if (updateError) {
      setLoading(false)
      toast.error(updateError.message || 'Error al actualizar inventario')
      return
    }

    const movementQuantity =
      type === 'ajuste' ? Math.abs(newStock - currentStock) : qty

    const { error: movementError } = await supabase
      .from('inventory_movements')
      .insert({
        product_id: product.id,
        campus_id: campusId,
        type,
        quantity: movementQuantity,
        notes: notes.trim() || null,
        created_by: session.user.id,
      })

    setLoading(false)

    if (movementError) {
      toast.error(movementError.message || 'Error al registrar movimiento')
      return
    }

    toast.success(
      type === 'ajuste'
        ? `Stock ajustado a ${newStock} uds.`
        : 'Movimiento registrado correctamente'
    )

    onSuccess(newStock)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Movimiento de stock
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">{product.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 transition hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between rounded-xl bg-zinc-800 px-4 py-3">
            <span className="text-xs text-zinc-500">Stock actual</span>
            <span className="text-lg font-bold text-white">
              {currentStock} uds.
            </span>
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
            placeholder={type === 'ajuste' ? 'Nuevo stock total' : 'Cantidad'}
            required
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-center text-lg font-bold text-white placeholder-zinc-600 transition focus:border-amber-500 focus:outline-none"
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
            className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-600 transition focus:border-amber-500 focus:outline-none"
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
              type="submit"
              disabled={loading || preview < 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-40"
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