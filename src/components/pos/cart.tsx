'use client'

import { useState } from 'react'
import FeedbackModal from '@/components/ui/feedback-modal'

type Product = {
  id: string
  name: string
  price: number
}

export default function Cart() {
  const [cart, setCart] = useState<Product[]>([])
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [selectedPayment, setSelectedPayment] = useState('debito')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'success' | 'error' | 'loading'>('loading')
  const [modalTitle, setModalTitle] = useState('')
  const [modalDesc, setModalDesc] = useState('')

  const total = cart.reduce((sum, item) => sum + item.price, 0)

  const handleConfirmSale = async () => {
    try {
      setModalType('loading')
      setModalTitle('Procesando venta...')
      setModalDesc('Esperando confirmación del sistema')
      setModalOpen(true)

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          client_name: clientName,
          client_email: clientEmail,
          payment_method: selectedPayment,
        }),
      })

      if (!res.ok) throw new Error('Error en venta')

      setModalType('success')
      setModalTitle('Venta realizada correctamente')
      setModalDesc('El comprobante fue enviado al cliente')

      setCart([])
      setClientName('')
      setClientEmail('')
    } catch (error) {
      setModalType('error')
      setModalTitle('Error en la venta')
      setModalDesc('Intenta nuevamente')
    }
  }

  return (
    <div className="p-4 space-y-4">

      {/* CLIENTE */}
      <input
        placeholder="Nombre del cliente"
        value={clientName}
        onChange={(e) => setClientName(e.target.value)}
        className="w-full rounded-xl bg-zinc-800 p-3 text-white"
      />

      <input
        placeholder="Email"
        value={clientEmail}
        onChange={(e) => setClientEmail(e.target.value)}
        className="w-full rounded-xl bg-zinc-800 p-3 text-white"
      />

      {/* TOTAL */}
      <div className="text-white text-xl font-bold">
        Total: ${total}
      </div>

      {/* BOTÓN */}
      <button
        onClick={handleConfirmSale}
        className="w-full rounded-xl bg-amber-500 py-3 font-semibold text-black hover:bg-amber-400 transition active:scale-95"
      >
        Confirmar venta
      </button>

      {/* MODAL */}
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