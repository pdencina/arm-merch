'use client'

import { useState } from 'react'
import { X, Loader2, Receipt, Mail, User, CreditCard } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/lib/hooks/use-cart'
import { toast } from 'sonner'
import ConfirmActionModal from '@/components/ui/confirm-action-modal'
import SaleSuccessModal from '@/components/pos/sale-success-modal'

interface Props {
  clientName: string
  clientEmail?: string
  onClose: () => void
  onNewSale: () => void
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n)

export default function CheckoutModal({
  clientName,
  clientEmail,
  onClose,
  onNewSale,
}: Props) {
  const supabase = createClient()

  const {
    items,
    paymentMethod,
    clearCart,
    subtotal,
    total,
    discount,
  } = useCart()

  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [successOpen, setSuccessOpen] = useState(false)
  const [createdOrderId, setCreatedOrderId] = useState('')
  const [createdOrderNumber, setCreatedOrderNumber] = useState<number | string>('')
  const [createdOrderTotal, setCreatedOrderTotal] = useState(0)
  const [emailSent, setEmailSent] = useState<boolean | null>(null)

  const [sumupPendingOpen, setSumupPendingOpen] = useState(false)

  const isCardPayment =
    paymentMethod === 'debito' ||
    paymentMethod === 'credito' ||
    paymentMethod === 'card'

  const canConfirm =
    items.length > 0 &&
    clientName.trim().length > 0 &&
    paymentMethod

  async function handleConfirmSale() {
    setConfirmOpen(false)
    setLoading(true)

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        toast.error('No autenticado')
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('campus_id')
        .eq('id', session.user.id)
        .single()

      const finalTotal = total()

      if (isCardPayment) {
        setSumupPendingOpen(true)
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          campus_id: profile?.campus_id ?? null,
          client_name: clientName.trim(),
          client_email: clientEmail?.trim() || null,
          payment_method: paymentMethod,
          discount: Number(discount ?? 0),
          notes: null,
          items: items.map((item: any) => ({
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.product.price,
          })),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSumupPendingOpen(false)
        toast.error(data.error ?? 'No se pudo registrar la venta')
        setLoading(false)
        return
      }

      setCreatedOrderId(data.order_id)
      setCreatedOrderNumber(data.order_number)
      setCreatedOrderTotal(finalTotal)
      setEmailSent(data.email_sent ?? false)

      clearCart()
      setSumupPendingOpen(false)
      onClose()
      setSuccessOpen(true)

      toast.success(`Venta registrada correctamente (#${data.order_number})`)
      setLoading(false)
    } catch (error: any) {
      setSumupPendingOpen(false)
      toast.error(error?.message ?? 'Error inesperado al registrar la venta')
      setLoading(false)
    }
  }

  return (
    <>
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-md overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500" />

            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
                  <Receipt size={16} className="text-amber-400" />
                </div>

                <div>
                  <h2 className="text-base font-bold text-white">
                    Confirmar venta
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Revisa el resumen antes de finalizar
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-zinc-500 transition hover:bg-zinc-900 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="mb-3 flex items-center gap-2 text-zinc-400">
                  <User size={14} />
                  <span className="text-[11px] uppercase tracking-[0.18em]">
                    Cliente
                  </span>
                </div>

                <p className="text-sm font-semibold text-white">{clientName}</p>

                {clientEmail ? (
                  <div className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
                    <Mail size={13} />
                    <span>{clientEmail}</span>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-zinc-600">
                    Sin correo registrado
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                  Resumen de productos
                </p>

                <div className="space-y-2">
                  {items.map((item: any) => (
                    <motion.div
                      key={item.product.id}
                      className="flex items-center justify-between gap-3 rounded-xl px-1 py-1 text-sm"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {item.quantity} × {fmt(item.product.price)}
                        </p>
                      </div>
                      <div className="shrink-0 font-semibold text-amber-400">
                        {fmt(item.quantity * item.product.price)}
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-4 space-y-1 border-t border-zinc-800 pt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Subtotal</span>
                    <span className="text-zinc-300">{fmt(subtotal())}</span>
                  </div>

                  {discount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-400">Descuento</span>
                      <span className="text-green-400">−{fmt(discount)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-semibold text-white">Total</span>
                    <span className="text-2xl font-black tracking-tight text-white">
                      {fmt(total())}
                    </span>
                  </div>

                  <div className="pt-2 text-xs text-zinc-500">
                    Método de pago:{' '}
                    <span className="capitalize text-zinc-300">
                      {paymentMethod || 'No definido'}
                    </span>
                  </div>
                </div>
              </div>

              {!canConfirm && (
                <p className="text-center text-xs font-medium text-amber-500/90">
                  Debes completar cliente, productos y método de pago.
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-60"
                >
                  Volver
                </button>

                <button
                  type="button"
                  disabled={!canConfirm || loading}
                  onClick={() => setConfirmOpen(true)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-amber-400 active:scale-[0.99] disabled:opacity-40"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {loading ? 'Procesando...' : 'Finalizar venta'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <ConfirmActionModal
        open={confirmOpen}
        title="¿Confirmar esta venta?"
        description="Se registrará la venta, se descontará el stock, se enviará el comprobante al cliente y quedará listo el voucher para impresión."
        confirmText="Sí, confirmar venta"
        cancelText="Revisar otra vez"
        loading={loading}
        tone="warning"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmSale}
      />

      <SaleSuccessModal
        open={successOpen}
        orderId={createdOrderId}
        orderNumber={createdOrderNumber}
        total={createdOrderTotal}
        clientName={clientName}
        clientEmail={clientEmail}
        emailSent={emailSent}
        onNewSale={() => {
          setSuccessOpen(false)
          onNewSale()
        }}
      />

      <AnimatePresence>
        {sumupPendingOpen && (
          <motion.div
            className="fixed inset-0 z-[125] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-md rounded-3xl border border-zinc-700 bg-zinc-950 p-6 text-center shadow-2xl"
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 10 }}
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
                <CreditCard size={30} className="text-blue-400" />
              </div>

              <h3 className="text-xl font-bold text-white">
                Esperando confirmación del POS
              </h3>

              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Estamos procesando el pago con tarjeta. En la siguiente fase este paso quedará conectado directamente con SumUp Solo.
              </p>

              <div className="mt-5 flex items-center justify-center gap-2 text-blue-400">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm font-medium">Procesando transacción...</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}