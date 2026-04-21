'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/lib/hooks/use-cart'
import FeedbackModal from '@/components/ui/feedback-modal'

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
    { key: 'efectivo', label: 'Efectivo' },
    { key: 'transferencia', label: 'Transfer.' },
    { key: 'debito', label: 'Débito' },
    { key: 'credito', label: 'Crédito' },
  ]

  async function handleConfirmSale() {
    if (items.length === 0) return

    try {
      setModalType('loading')
      setModalTitle('Procesando venta...')
      setModalDesc('Registrando operación...')
      setModalOpen(true)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setModalType('error')
        setModalTitle('Sesión expirada')
        setModalDesc('Inicia sesión nuevamente')
        return
      }

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
            unit_price: i.product.price,
          })),
          client_name: clientName.trim(),
          client_email: clientEmail.trim() || null,
          payment_method: paymentMethod,
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        setModalType('error')
        setModalTitle('Error en la venta')
        setModalDesc(data?.error || 'Intenta nuevamente')
        return
      }

      setModalType('success')
      setModalTitle('Venta completada')
      setModalDesc('Operación registrada correctamente')

      clearCart()
      setClientName('')
      setClientEmail('')
    } catch (error: any) {
      setModalType('error')
      setModalTitle('Error en la venta')
      setModalDesc(error?.message || 'Error inesperado')
    }
  }

  return (
    <aside className="w-full h-full bg-zinc-950 border-l border-zinc-800 flex flex-col">
      {/* HEADER */}
      <div className="p-4 border-b border-zinc-800">
        <h2 className="text-xl font-bold text-white">Carrito</h2>
        <p className="text-xs text-zinc-500">
          {itemCount()} items
        </p>
      </div>

      {/* ITEMS */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.length === 0 && (
          <p className="text-zinc-600 text-sm text-center mt-10">
            Carrito vacío
          </p>
        )}

        {items.map((item) => (
          <div key={item.product.id} className="bg-zinc-900 p-3 rounded-xl">
            <div className="flex justify-between">
              <p className="text-sm font-semibold text-white">
                {item.product.name}
              </p>
              <button
                onClick={() => removeItem(item.product.id)}
                className="text-xs text-red-400"
              >
                x
              </button>
            </div>

            <div className="flex justify-between mt-2 items-center">
              <div className="flex gap-2">
                <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>-</button>
                <span>{item.quantity}</span>
                <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>+</button>
              </div>

              <p className="text-sm font-bold text-white">
                {fmt(item.product.price * item.quantity)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* FORM */}
      <div className="p-4 border-t border-zinc-800 space-y-3">
        <input
          placeholder="Nombre cliente"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          className="w-full bg-zinc-900 p-2 rounded-xl text-sm"
        />

        <input
          placeholder="Email"
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
          className="w-full bg-zinc-900 p-2 rounded-xl text-sm"
        />

        {/* PAGOS */}
        <div className="grid grid-cols-2 gap-2">
          {paymentOptions.map((p) => (
            <button
              key={p.key}
              onClick={() => setPaymentMethod(p.key)}
              className={`p-2 rounded-xl text-xs ${
                paymentMethod === p.key
                  ? 'bg-amber-500 text-black'
                  : 'bg-zinc-800 text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* TOTAL */}
        <div className="flex justify-between text-sm text-white">
          <span>Total</span>
          <span className="text-2xl font-bold">{fmt(total())}</span>
        </div>

        {/* BOTON */}
        <button
          onClick={handleConfirmSale}
          className="w-full bg-amber-500 py-3 rounded-xl font-bold"
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