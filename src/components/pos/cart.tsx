'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useCart, type Promotion, type CartItem } from '@/lib/hooks/use-cart'
import {
  ShoppingCart,
  Trash2,
  CreditCard,
  Landmark,
  Banknote,
  Wallet,
  X,
  Receipt,
  Minus,
  Plus,
} from 'lucide-react'
import SaleSuccessModal from '@/components/pos/sale-success-modal'

// ─── helpers ───────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n)

// ─── componente principal ───────────────────────────────────────────────────

export default function Cart() {
  const supabase = createClient()
  const {
    items,
    paymentMethod,
    setPaymentMethod,
    setGlobalDiscount,
    clientName,
    clientEmail,
    notes,
    setClientName,
    setClientEmail,
    setNotes,
    updateQuantity,
    removeItem,
    setItemDiscount,
    clearCart,
    subtotal,
    promoDiscount,
    total,
    itemCount,
  } = useCart()

  // ── UI state ──
  const [showNotes, setShowNotes] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const [createdOrder, setCreatedOrder] = useState<{
    id: string; number: number | string; total: number; emailSent?: boolean
  } | null>(null)

  const canSubmit = useMemo(
    () => items.length > 0 && clientName.trim().length > 0 && !submitting,
    [items.length, clientName, submitting]
  )

  const paymentOptions = [
    { key: 'efectivo', label: 'Efectivo', icon: Banknote },
    { key: 'transferencia', label: 'Transfer.', icon: Landmark },
    { key: 'debito', label: 'Débito', icon: CreditCard },
    { key: 'credito', label: 'Crédito', icon: Wallet },
  ]

  // ── confirmar venta ──
  async function handleConfirmSale() {
    if (!canSubmit) return
    setSubmitting(true)

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) throw new Error('Sesión expirada.')

      const { data: profile } = await supabase
        .from('profiles')
        .select('campus_id')
        .eq('id', session.user.id)
        .single()

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          campus_id: profile?.campus_id ?? null,
          items: items.map((i) => ({
            product_id: i.product.id,
            quantity: i.quantity,
            unit_price: i.unit_price,
            discount_pct: i.discount_pct,
          })),
          client_name: clientName.trim(),
          client_email: clientEmail.trim() || null,
          payment_method: paymentMethod,
          discount: 0,
          notes: notes.trim() || null,
        }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Error al registrar la venta.')

      setCreatedOrder({
        id: data.order_id,
        number: data.order_number ?? data.order_id,
        total: total(),
        emailSent: data.email_sent,
      })
      setSuccessOpen(true)
      clearCart()
    } catch (err: any) {
      alert(err?.message || 'Error inesperado')
    } finally {
      setSubmitting(false)
    }
  }

  // ── atajos de teclado ──
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      if (e.key === '1') setPaymentMethod('efectivo')
      if (e.key === '2') setPaymentMethod('transferencia')
      if (e.key === '3') setPaymentMethod('debito')
      if (e.key === '4') setPaymentMethod('credito')
      if (e.key === 'Enter' && canSubmit) { e.preventDefault(); handleConfirmSale() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canSubmit, paymentMethod, items.length, clientName])


  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <>
      <aside className="flex h-full flex-col bg-[#0e0f14] text-white">

        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-white/6 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <ShoppingCart size={19} className="text-zinc-300" />
              <AnimatePresence>
                {itemCount() > 0 && (
                  <motion.span
                    key="badge"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-black"
                  >
                    {itemCount()}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <h2 className="text-[17px] font-bold tracking-tight">Carrito</h2>
          </div>

          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
            >
              Vaciar
            </button>
          )}
        </div>

        {/* SCROLL AREA */}
        <div className="flex-1 overflow-y-auto">

          {/* ITEMS */}
          <div className="px-4 py-4">
            <AnimatePresence mode="popLayout">
              {items.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex min-h-[200px] flex-col items-center justify-center text-center"
                >
                  <ShoppingCart size={48} className="text-zinc-800" />
                  <p className="mt-3 text-sm text-zinc-600">
                    Selecciona productos del catálogo
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-2.5">
                  {items.map((item) => (
                    <CartItemRow
                      key={item.product.id}
                      item={item}
                      onUpdateQty={(qty) => updateQuantity(item.product.id, qty)}
                      onRemove={() => removeItem(item.product.id)}
                      onDiscountChange={(pct) => setItemDiscount(item.product.id, pct)}
                    />
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>

          {items.length > 0 && (
            <div className="space-y-4 px-4 pb-6">

              {/* DATOS DEL CLIENTE */}
              <div className="space-y-2.5">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Cliente <span className="text-red-400">*</span>
                </label>
                <input
                  placeholder="Nombre del cliente"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-amber-500/40"
                />
                <input
                  placeholder="Email (voucher por correo)"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-amber-500/40"
                />
              </div>

              {/* NOTAS */}
              <div>
                <button
                  onClick={() => setShowNotes((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300"
                >
                  <Receipt size={12} />
                  {showNotes ? 'Ocultar notas' : 'Agregar nota a la venta'}
                </button>

                <AnimatePresence>
                  {showNotes && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ej: Cliente recoge mañana..."
                        rows={2}
                        className="mt-2 w-full resize-none rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-amber-500/40"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* MÉTODO DE PAGO */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Método de pago
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {paymentOptions.map((option, i) => (
                    <PaymentPill
                      key={option.key}
                      option={option}
                      active={paymentMethod === option.key}
                      onClick={() => setPaymentMethod(option.key)}
                      shortcut={String(i + 1)}
                    />
                  ))}
                </div>
              </div>

              {/* RESUMEN TOTAL */}
              <div className="rounded-2xl border border-white/6 bg-white/[0.025] p-4 space-y-2">
                <div className="flex justify-between text-sm text-zinc-400">
                  <span>Subtotal ({itemCount()} {itemCount() === 1 ? 'ítem' : 'ítems'})</span>
                  <span>{fmt(subtotal())}</span>
                </div>

                )}

                )}

                <div className="border-t border-white/6 pt-2 flex items-end justify-between">
                  <span className="text-zinc-300 text-sm">Total a cobrar</span>
                  <motion.span
                    key={total()}
                    initial={{ scale: 1.08 }}
                    animate={{ scale: 1 }}
                    className="text-[26px] font-black tracking-tight text-white"
                  >
                    {fmt(total())}
                  </motion.span>
                </div>
              </div>

              {/* BOTÓN CONFIRMAR */}
              <motion.button
                whileHover={{ scale: canSubmit ? 1.01 : 1 }}
                whileTap={{ scale: canSubmit ? 0.98 : 1 }}
                onClick={handleConfirmSale}
                disabled={!canSubmit}
                className="relative w-full overflow-hidden rounded-3xl py-4 text-[17px] font-black text-black transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: canSubmit ? '#d97706' : '#555' }}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    Procesando...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <CreditCard size={18} />
                    Confirmar venta · {fmt(total())}
                  </span>
                )}
              </motion.button>

              <p className="text-center text-[10px] text-zinc-600">
                Presiona <kbd className="rounded bg-white/8 px-1 font-mono">Enter</kbd> para confirmar rápido
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* MODAL ÉXITO */}
      {createdOrder && (
        <SaleSuccessModal
          open={successOpen}
          orderId={createdOrder.id}
          orderNumber={createdOrder.number}
          total={createdOrder.total}
          emailSent={createdOrder.emailSent}
          onNewSale={() => setSuccessOpen(false)}
        />
      )}
    </>
  )
}
