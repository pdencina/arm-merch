'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/lib/hooks/use-cart'
import FeedbackModal from '@/components/ui/feedback-modal'
import {
  ShoppingCart,
  Trash2,
  User,
  Mail,
  Wallet,
  CreditCard,
  Landmark,
  Banknote,
} from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n)

export default function Cart() {
  const supabase = createClient()

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

  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'success' | 'error' | 'loading'>('loading')
  const [modalTitle, setModalTitle] = useState('')
  const [modalDesc, setModalDesc] = useState('')

  const paymentOptions = [
    { key: 'efectivo', label: 'Efectivo', icon: Banknote },
    { key: 'transferencia', label: 'Transfer.', icon: Landmark },
    { key: 'debito', label: 'Débito', icon: CreditCard },
    { key: 'credito', label: 'Crédito', icon: Wallet },
  ]

  async function handleConfirmSale() {
    if (items.length === 0) {
      setModalType('error')
      setModalTitle('Carrito vacío')
      setModalDesc('Agrega al menos un producto antes de confirmar la venta.')
      setModalOpen(true)
      return
    }

    if (!clientName.trim()) {
      setModalType('error')
      setModalTitle('Falta el nombre del cliente')
      setModalDesc('Ingresa el nombre del cliente.')
      setModalOpen(true)
      return
    }

    try {
      setModalType('loading')
      setModalTitle('Procesando venta...')
      setModalDesc('Registrando la venta...')
      setModalOpen(true)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      const { data: profile } = await supabase
        .from('profiles')
        .select('campus_id')
        .eq('id', session?.user.id)
        .single()

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          campus_id: profile?.campus_id,
          items: items.map((i) => ({
            product_id: i.product.id,
            quantity: i.quantity,
            unit_price: i.product.price,
          })),
          client_name: clientName,
          client_email: clientEmail || null,
          payment_method: paymentMethod,
          discount: 0,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Error en la venta')
      }

      setModalType('success')
      setModalTitle('Venta completada')
      setModalDesc('Venta registrada correctamente')

      clearCart()
      setClientName('')
      setClientEmail('')
    } catch (error: any) {
      setModalType('error')
      setModalTitle('Error en la venta')
      setModalDesc(error.message)
    }
  }

  return (
    <aside className="flex h-full flex-col bg-zinc-950">

      {/* HEADER */}
      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <ShoppingCart size={18} className="text-slate-300" />
          <h2 className="text-lg font-bold text-white">Carrito</h2>
        </div>
        <p className="text-xs text-zinc-500 mt-1">
          {itemCount()} productos
        </p>
      </div>

      {/* ITEMS SCROLL */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-center text-zinc-500 text-sm mt-4">
            Carrito vacío
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.product.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"
            >
              <div className="flex justify-between">
                <p className="text-sm font-semibold text-white">
                  {item.product.name}
                </p>
                <button
                  onClick={() => removeItem(item.product.id)}
                  className="text-zinc-500 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="flex justify-between items-center mt-2">
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() =>
                      updateQuantity(item.product.id, item.quantity - 1)
                    }
                    className="px-2 bg-zinc-800 rounded"
                  >
                    -
                  </button>
                  <span className="text-white">{item.quantity}</span>
                  <button
                    onClick={() =>
                      updateQuantity(item.product.id, item.quantity + 1)
                    }
                    className="px-2 bg-zinc-800 rounded"
                  >
                    +
                  </button>
                </div>

                <span className="text-sm font-bold text-white">
                  {fmt(item.product.price * item.quantity)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FOOTER FIJO */}
      <div className="sticky bottom-0 border-t border-zinc-800 bg-zinc-950 px-4 py-4 space-y-3">

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

        {/* MÉTODO PAGO */}
        <div className="grid grid-cols-2 gap-2">
          {paymentOptions.map((p) => {
            const Icon = p.icon
            return (
              <button
                key={p.key}
                onClick={() => setPaymentMethod(p.key)}
                className={`p-2 rounded text-xs ${
                  paymentMethod === p.key
                    ? 'bg-slate-200 text-black'
                    : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                <Icon size={14} />
                {p.label}
              </button>
            )
          })}
        </div>

        <div className="flex justify-between text-sm text-zinc-400">
          <span>Total</span>
          <span className="text-white font-bold">{fmt(total())}</span>
        </div>

        <button
          onClick={handleConfirmSale}
          className="w-full bg-slate-200 text-black py-3 rounded-xl font-bold"
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