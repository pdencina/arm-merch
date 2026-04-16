'use client'

import { useState } from 'react'
import { toast } from 'sonner'

export default function SendReceipt({ orderId }: { orderId: string }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSend() {
    if (!email.trim()) {
      toast.error('Ingresa un correo')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/orders/send-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          email: email.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo enviar el comprobante')
        setLoading(false)
        return
      }

      toast.success('Comprobante enviado correctamente')
      setEmail('')
      setLoading(false)
    } catch (error: any) {
      toast.error(error?.message ?? 'Error inesperado al enviar comprobante')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400">
        Envía este comprobante al correo del cliente.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          placeholder="cliente@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={loading}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
        >
          {loading ? 'Enviando...' : 'Enviar comprobante'}
        </button>
      </div>
    </div>
  )
}