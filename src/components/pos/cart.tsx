'use client'

import { useState } from 'react'
import { useCart } from '@/lib/hooks/use-cart'
import FeedbackModal from '@/components/ui/feedback-modal'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
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
  } = useCart()

  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'success' | 'error' | 'loading'>('loading')
  const [modalTitle, setModalTitle] = useState('')
  const [modalDesc, setModalDesc] = useState('')

  async function handleConfirmSale() {
    if (items.length === 0) return

    try {
      setModalType('loading')
      setModalTitle('Procesando venta...')
      setModalDesc('Esperando confirmación del sistema')
      setModalOpen(true)

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            product_id: i.product.id,
            quantity: i.quantity,
            unit_price: i.product.price,
          })),
          client_name: clientName,
          client_email: clientEmail,
          payment_method: paymentMethod,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        console.error('POST /api/orders error:', data)
        setModalType('error')
        setModalTitle('Error en la venta')
        setModalDesc(data?.error || 'Intenta nuevamente')
        return
      }

      setModalType('success')
      setModalTitle('Venta completada')
      setModalDesc(
        data?.email_sent
          ? 'Voucher enviado correctamente'
          : 'Venta registrada correctamente'
      )

      clearCart()
      setClientName('')
      setClientEmail('')
    } catch (error: any) {
      console.error('Cart handleConfirmSale error:', error)
      setModalType('error')
      setModalTitle('Error en la venta')
      setModalDesc(error?.message || 'Intenta nuevamente')
    }
  }

  return (
    <div className="w-[360px] bg-zinc-950 border-l border-zinc-800 flex flex-col">
      <div className="p-4 border-b border-zinc-800">
        <h2 className="text-white font-semibold text-lg">Carrito</h2>
        <p className="text-xs text-zinc-500">
          {items.length} producto{items.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.length === 0 && (
          <p className="text-zinc-600 text-sm text-center mt-10">
            No hay productos en el carrito
          </p>
        )}

        {items.map((item) => (
          <div
            key={item.product.id}
            className="bg-zinc-900 rounded-xl p-3 border border-zinc-800"
          >
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {item.product.name}
                </p>
                <p className="text-amber-400 text-xs mt-1">
                  {fmt(item.product.price)}
                </p>
              </div>

              <button
                onClick={() => removeItem(item.product.id)}
                className="text-zinc-500 hover:text-red-400 text-xs transition"
              >
                Quitar
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    updateQuantity(item.product.id, item.quantity - 1)
                  }
                  className="h-8 w-8 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 transition"
                >
                  -
                </button>

                <span className="text-white text-sm w-6 text-center">
                  {item.quantity}
                </span>

                <button
                  onClick={() =>
                    updateQuantity(item.product.id, item.quantity + 1)
                  }
                  className="h-8 w-8 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 transition"
                >
                  +
                </button>
              </div>

              <p className="text-white font-semibold text-sm">
                {fmt(item.product.price * item.quantity)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-zinc-800 space-y-3">
        <input
          placeholder="Nombre cliente"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          className="w-full bg-zinc-800 p-3 rounded-xl text-white placeholder-zinc-500 outline-none border border-zinc-700 focus:border-amber-500 transition"
        />

        <input
          placeholder="Email"
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
          className="w-full bg-zinc-800 p-3 rounded-xl text-white placeholder-zinc-500 outline-none border border-zinc-700 focus:border-amber-500 transition"
        />

        <div className="grid grid-cols-2 gap-2">
          {[
            { key: 'efectivo', label: 'Efectivo' },
            { key: 'transferencia', label: 'Transfer.' },
            { key: 'debito', label: 'Débito' },
            { key: 'credito', label: 'Crédito' },
          ].map((m) => (
            <button
              key={m.key}
              onClick={() => setPaymentMethod(m.key)}
              className={`py-2.5 rounded-xl text-xs font-semibold border transition ${
                paymentMethod === m.key
                  ? 'bg-amber-500 text-black border-amber-500'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white hover:border-zinc-500'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="space-y-1 pt-2">
          <div className="flex justify-between text-sm text-zinc-400">
            <span>Subtotal</span>
            <span>{fmt(subtotal())}</span>
          </div>

          <div className="flex justify-between text-white font-bold text-xl">
            <span>Total</span>
            <span>{fmt(total())}</span>
          </div>
        </div>

        <button
          onClick={handleConfirmSale}
          disabled={items.length === 0}
          className="w-full bg-amber-500 py-3 rounded-xl text-black font-bold hover:bg-amber-400 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  )
}