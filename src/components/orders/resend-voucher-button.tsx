'use client'
import { useNotify, NotifyModal } from '@/components/ui/notify-modal'

import { useState } from 'react'

export default function ResendVoucherButton({
  const { notify, success, error: notifyError, close } = useNotify()
  orderId,
}: {
  orderId: string
}) {
  const [loading, setLoading] = useState(false)

  async function handleResend() {
    try {
      setLoading(true)

      const res = await fetch('/api/orders/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order_id: orderId }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'No se pudo reenviar el voucher')
        setLoading(false)
        return
      }

      success('Voucher enviado', 'El comprobante fue reenviado al correo del cliente', '📧')
      setLoading(false)
    } catch (error: any) {
      alert(error?.message || 'Error inesperado al reenviar')
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleResend}
      disabled={loading}
      className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
    >
      {loading ? 'Reenviando...' : 'Reenviar voucher'}
    </button>
  )
}