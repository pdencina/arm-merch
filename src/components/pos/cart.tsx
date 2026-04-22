'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCart } from '@/lib/hooks/use-cart'
import FeedbackModal from '@/components/ui/feedback-modal'
import {
  ShoppingCart,
  Trash2,
  CheckCircle,
} from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n)

export default function Cart() {
  const {
    items,
    subtotal,
    total,
    paymentMethod,
    setPaymentMethod,
    updateQuantity,
    removeItem,
    clearCart,
    itemCount,
  } = useCart()

  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'success' | 'error' | 'loading'>('loading')
  const [modalTitle, setModalTitle] = useState('')
  const [modalDesc, setModalDesc] = useState('')

  const canSubmit = useMemo(() => {
    return items.length > 0 && clientName.trim() !== '' && !submitting
  }, [items, clientName, submitting])

  async function handleConfirmSale() {
    if (!canSubmit) return

    setSubmitting(true)

    setModalType('loading')
    setModalTitle('Procesando venta...')
    setModalDesc('Espera un momento')
    setModalOpen(true)

    setTimeout(() => {
      setModalType('success')
      setModalTitle('Venta exitosa')
      setModalDesc('Todo salió perfecto')

      clearCart()
      setClientName('')
      setClientEmail('')
      setSubmitting(false)
    }, 1200)
  }

  return (
    <aside className="flex h-full flex-col bg-gradient-to-b from-zinc-950 to-black">

      {/* HEADER */}
      <div className="border-b border-zinc-800 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 backdrop-blur">
            <ShoppingCart size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Carrito</h2>
            <p className="text-xs text-zinc-500">
              {itemCount()} productos
            </p>
          </div>
        </div>
      </div>

      {/* TOTAL STICKY */}
      <div className="px-4 py-4 border-b border-zinc-800 bg-black/40 backdrop-blur sticky top-0 z-10">
        <div className="rounded-xl bg-zinc-900 p-4 shadow-inner">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Total</span>
            <span>{itemCount()} items</span>
          </div>

          <div className="text-3xl font-black text-white mt-2">
            {fmt(total())}
          </div>
        </div>
      </div>

      {/* ITEMS */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {items.length === 0 ? (
          <div className="text-center text-zinc-500 text-sm mt-10">
            Carrito vacío
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.product.id}
              className="rounded-xl bg-zinc-900 p-3 space-y-2 hover:bg-zinc-800 transition"
            >
              <div className="flex justify-between">
                <p className="text-sm text-white font-semibold">
                  {item.product.name}
                </p>

                <button
                  onClick={() => removeItem(item.product.id)}
                  className="text-zinc-500 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex gap-2 items-center bg-black/40 px-2 py-1 rounded">
                  <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                    −
                  </button>
                  <span>{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>
                    +
                  </button>
                </div>

                <span className="font-bold text-white">
                  {fmt(item.product.price * item.quantity)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FOOTER */}
      <div className="border-t border-zinc-800 px-4 py-4 space-y-4 bg-black/60 backdrop-blur">

        {/* CLIENTE */}
        <div className="space-y-2">
          <input
            placeholder="Nombre cliente"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full p-2 rounded bg-zinc-900 border border-zinc-700 text-white text-sm"
          />

          <input
            placeholder="Email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            className="w-full p-2 rounded bg-zinc-900 border border-zinc-700 text-white text-sm"
          />
        </div>

        {/* PAGO */}
        <div className="grid grid-cols-2 gap-2">
          {['efectivo', 'transferencia', 'debito', 'credito'].map((p) => (
            <button
              key={p}
              onClick={() => setPaymentMethod(p)}
              className={`p-2 rounded text-sm transition ${
                paymentMethod === p
                  ? 'bg-white text-black font-bold'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* BOTÓN */}
        <button
          onClick={handleConfirmSale}
          disabled={!canSubmit}
          className="w-full bg-white text-black py-3 rounded-xl font-bold hover:scale-[1.02] transition disabled:opacity-40"
        >
          Confirmar venta
        </button>
      </div>

      <FeedbackModal
        open={modalOpen}
        type={modalType}
        title={modalTitle}
        description={modalDesc}
        onClose={() => setModalOpen(false)}
      />
    </aside>
  )
}