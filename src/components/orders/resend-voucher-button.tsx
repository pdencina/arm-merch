'use client'

import { useState } from 'react'
import { NotifyModal, useNotify } from '@/components/ui/notify-modal'

export default function ResendVoucherButton({
  orderId,
}: {
  orderId: string
}) {
  const [loading, setLoading] = useState(false)
  const { notify, success, error: notifyError, close } = useNotify()

  async function handleResend() {
    try {
      setLoading(true)
      const { data: { session } } = await (await import('@/lib/supabase/client')).createClient().auth.getSession()

      const res = await fetch('/api/orders/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ order_id: orderId }),
      })
      const data = await res.json()

      if (!res.ok) {
        notifyError('Error', data.error ?? 'No se pudo reenviar el voucher')
      } else {
        success('Voucher enviado', 'El comprobante fue reenviado al correo del cliente', '📧')
      }
    } catch (err: any) {
      notifyError('Error inesperado', err?.message ?? 'Intenta de nuevo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <NotifyModal notify={notify} onClose={close} />
      <button
        onClick={handleResend}
        disabled={loading}
        className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {loading ? '...' : '📧 Reenviar voucher'}
      </button>
    </>
  )
}
