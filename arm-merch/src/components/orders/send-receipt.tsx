'use client'

import { useState } from 'react'

export default function SendReceipt({ orderId }: { orderId: string }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSend() {
    if (!email) {
      alert('Ingresa un correo')
      return
    }

    setLoading(true)

    const res = await fetch('/api/orders/send-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, email }),
    })

    const data = await res.json()

    if (!res.ok) {
      alert(data.error)
    } else {
      alert('Comprobante enviado 🚀')
      setEmail('')
    }

    setLoading(false)
  }

  return (
    <div className="mt-4 flex gap-2">
      <input
        type="email"
        placeholder="Correo cliente"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
      />

      <button
        onClick={handleSend}
        disabled={loading}
        className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white"
      >
        {loading ? 'Enviando...' : 'Enviar comprobante'}
      </button>
    </div>
  )
}