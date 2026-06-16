'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RotateCcw, Package, Check, AlertTriangle, X } from 'lucide-react'
import { clsx } from 'clsx'
import { toast } from 'sonner'

interface OrderItem {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  refunded_qty: number
  products: { name: string; sku: string | null; image_url: string | null } | any
}

interface RefundModalProps {
  orderId: string
  orderNumber: number | string
  items: OrderItem[]
  onClose: () => void
  onSuccess: () => void
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

export default function RefundModal({ orderId, orderNumber, items, onClose, onSuccess }: RefundModalProps) {
  const [selectedItems, setSelectedItems] = useState<Record<string, { qty: number; restock: boolean }>>({})
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function getProduct(item: OrderItem) {
    const p = Array.isArray(item.products) ? item.products[0] : item.products
    return p ?? { name: 'Producto', sku: null, image_url: null }
  }

  function toggleItem(itemId: string, maxQty: number) {
    setSelectedItems(prev => {
      if (prev[itemId]) {
        const next = { ...prev }
        delete next[itemId]
        return next
      }
      return { ...prev, [itemId]: { qty: maxQty, restock: true } }
    })
  }

  function updateQty(itemId: string, qty: number) {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], qty: Math.max(1, qty) },
    }))
  }

  function toggleRestock(itemId: string) {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], restock: !prev[itemId]?.restock },
    }))
  }

  const selectedCount = Object.keys(selectedItems).length
  const totalRefund = Object.entries(selectedItems).reduce((sum, [itemId, { qty }]) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return sum
    return sum + item.unit_price * qty
  }, 0)

  async function handleSubmit() {
    if (selectedCount === 0) return

    setSubmitting(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSubmitting(false); return }

    const refundItems = Object.entries(selectedItems).map(([order_item_id, { qty, restock }]) => ({
      order_item_id,
      quantity: qty,
      restock,
    }))

    try {
      const res = await fetch(`/api/orders/${orderId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ items: refundItems, reason, notes }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Error al procesar devolución')
        setSubmitting(false)
        return
      }

      toast.success(
        data.refund?.type === 'full'
          ? 'Devolución total procesada'
          : `Devolución parcial de ${fmt(data.refund?.total_refunded ?? 0)} procesada`
      )
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err?.message ?? 'Error inesperado')
    }

    setSubmitting(false)
  }

  const REASONS = [
    'Producto defectuoso',
    'Talla incorrecta',
    'Cliente cambió de opinión',
    'Error del vendedor',
    'Producto duplicado',
    'Otro',
  ]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
              <RotateCcw size={18} className="text-red-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Devolución — Orden #{orderNumber}</h2>
              <p className="text-[10px] text-zinc-500">Selecciona los productos a devolver</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* Items */}
        <div className="max-h-[50vh] overflow-y-auto p-5 space-y-3">
          {items.map(item => {
            const product = getProduct(item)
            const available = item.quantity - (item.refunded_qty ?? 0)
            const isSelected = Boolean(selectedItems[item.id])
            const alreadyFullyRefunded = available <= 0

            return (
              <div
                key={item.id}
                className={clsx(
                  'rounded-2xl border p-3 transition-all',
                  alreadyFullyRefunded
                    ? 'border-zinc-800 bg-zinc-800/30 opacity-50'
                    : isSelected
                      ? 'border-red-500/30 bg-red-500/5'
                      : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => !alreadyFullyRefunded && toggleItem(item.id, available)}
                    disabled={alreadyFullyRefunded}
                    className={clsx(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition',
                      isSelected
                        ? 'border-red-500 bg-red-500'
                        : 'border-zinc-600 bg-zinc-800'
                    )}
                  >
                    {isSelected && <Check size={12} className="text-white" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{product.name}</p>
                    <p className="text-[10px] text-zinc-500">
                      {fmt(item.unit_price)} × {item.quantity} compradas
                      {item.refunded_qty > 0 && (
                        <span className="ml-1 text-amber-400">({item.refunded_qty} ya devueltas)</span>
                      )}
                    </p>

                    {alreadyFullyRefunded && (
                      <p className="mt-1 text-[10px] font-bold text-zinc-500">Completamente devuelto</p>
                    )}

                    {/* Quantity selector */}
                    {isSelected && (
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] text-zinc-400">Cantidad:</label>
                          <input
                            type="number"
                            min={1}
                            max={available}
                            value={selectedItems[item.id]?.qty ?? 1}
                            onChange={(e) => updateQty(item.id, Math.min(available, Number(e.target.value)))}
                            className="w-14 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-center text-xs text-white"
                          />
                          <span className="text-[10px] text-zinc-600">/ {available}</span>
                        </div>

                        <button
                          onClick={() => toggleRestock(item.id)}
                          className={clsx(
                            'flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition',
                            selectedItems[item.id]?.restock
                              ? 'bg-green-500/10 text-green-400'
                              : 'bg-zinc-800 text-zinc-500'
                          )}
                        >
                          <Package size={10} />
                          {selectedItems[item.id]?.restock ? 'Reintegrar stock' : 'Sin restock'}
                        </button>
                      </div>
                    )}
                  </div>

                  <span className="text-xs font-bold text-zinc-400">{fmt(item.unit_price * available)}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Reason + summary */}
        <div className="border-t border-zinc-800 px-5 py-4 space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Motivo</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {REASONS.map(r => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={clsx(
                    'rounded-lg px-2.5 py-1 text-[10px] font-medium transition',
                    reason === r
                      ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas adicionales (opcional)"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-500"
          />

          {/* Summary */}
          {selectedCount > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
              <div>
                <p className="text-xs font-bold text-red-300">{selectedCount} item{selectedCount > 1 ? 's' : ''} a devolver</p>
                <p className="text-[10px] text-red-400/70">El monto se reembolsará al cliente</p>
              </div>
              <p className="text-lg font-black text-red-400">{fmt(totalRefund)}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || selectedCount === 0 || !reason}
              className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white transition hover:bg-red-400 disabled:opacity-40"
            >
              {submitting ? 'Procesando...' : `Devolver ${fmt(totalRefund)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
