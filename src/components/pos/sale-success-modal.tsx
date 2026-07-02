'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { QRCodeCanvas } from 'qrcode.react'
import {
  CheckCircle2,
  Printer,
  Receipt,
  Plus,
  Mail,
  X,
  MessageCircle,
} from 'lucide-react'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function playSuccessSound() {
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext

    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()

    osc1.type = 'triangle'
    osc1.frequency.setValueAtTime(880, now)
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.16)

    gain1.gain.setValueAtTime(0.0001, now)
    gain1.gain.exponentialRampToValueAtTime(0.06, now + 0.03)
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)

    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1320, now + 0.06)
    osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.18)

    gain2.gain.setValueAtTime(0.0001, now + 0.06)
    gain2.gain.exponentialRampToValueAtTime(0.05, now + 0.08)
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)

    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)

    osc1.start(now)
    osc1.stop(now + 0.2)
    osc2.start(now + 0.06)
    osc2.stop(now + 0.22)
  } catch {}
}

interface Props {
  open: boolean
  orderId: string
  orderNumber: number | string
  total: number
  clientName?: string
  clientEmail?: string
  emailSent?: boolean | null
  paymentDetail?: string
  onNewSale: () => void
  onClose: () => void
}

export default function SaleSuccessModal({
  open,
  orderId,
  orderNumber,
  total,
  clientName,
  clientEmail,
  emailSent,
  paymentDetail,
  onNewSale,
  onClose,
}: Props) {
  useEffect(() => {
    if (open) playSuccessSound()
  }, [open])

  // WhatsApp QR: número de ARM Merch (env var en build time via NEXT_PUBLIC)
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''
  const whatsappMessage = encodeURIComponent(
    `Hola ARM Merch 👋 Acabo de comprar (Orden #${orderNumber}). Quiero recibir notificaciones por aquí.`
  )
  const whatsappLink = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${whatsappMessage}`
    : ''

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl"
            initial={{ scale: 0.92, opacity: 0, y: 18 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-green-400 via-emerald-300 to-green-500" />

            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-xl p-2 text-zinc-500 transition hover:bg-zinc-900 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="px-6 pb-6 pt-7">
              <div className="text-center">
                <motion.div
                  className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-green-500/10 ring-1 ring-green-500/20"
                  initial={{ scale: 0.7, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                >
                  <CheckCircle2 size={52} className="text-green-400" />
                </motion.div>

                <h2 className="text-3xl font-bold tracking-tight text-white">
                  Venta realizada con éxito
                </h2>

                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-400">
                  La orden fue registrada correctamente. Puedes imprimir el
                  voucher, revisar la orden o comenzar una nueva venta.
                </p>
              </div>

              <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-zinc-950/70 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      Orden
                    </p>

                    <p className="mt-2 text-xl font-bold text-white">
                      #{orderNumber}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-zinc-950/70 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      Total
                    </p>

                    <p className="mt-2 text-xl font-bold text-amber-400">
                      {formatCurrency(total)}
                    </p>
                  </div>
                </div>

                {paymentDetail && (
                  <div className="mt-4 rounded-2xl bg-zinc-950/70 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      Pago
                    </p>

                    <p className="mt-2 text-sm font-bold text-white">
                      {paymentDetail}
                    </p>
                  </div>
                )}

                {(clientName || clientEmail) && (
                  <div className="mt-4 rounded-2xl bg-zinc-950/70 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      Cliente
                    </p>

                    <p className="mt-2 text-sm font-semibold text-white">
                      {clientName || 'Cliente'}
                    </p>

                    {clientEmail && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
                        <Mail size={14} />
                        <span>{clientEmail}</span>
                      </div>
                    )}

                    {emailSent !== null && emailSent !== undefined && (
                      <div className="mt-3 text-xs font-medium">
                        {emailSent ? (
                          <span className="text-green-400">
                            ✔ Voucher enviado correctamente
                          </span>
                        ) : (
                          <span className="text-amber-400">
                            ⚠ No se pudo enviar el correo
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* WhatsApp QR — para que el cliente escriba y abrir ventana de 24h */}
              {whatsappNumber && (
                <div className="mt-5 rounded-2xl border border-green-500/20 bg-green-500/5 p-4">
                  <div className="flex items-center gap-2 text-green-400">
                    <MessageCircle size={16} />
                    <p className="text-xs font-bold uppercase tracking-wider">
                      WhatsApp ARM Merch
                    </p>
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-400">
                    Pídele al cliente que escanee este QR para recibir notificaciones por WhatsApp.
                  </p>
                  <div className="mt-3 flex justify-center">
                    <div className="rounded-xl bg-white p-2.5">
                      <QRCodeCanvas
                        value={whatsappLink}
                        size={130}
                        bgColor="#ffffff"
                        fgColor="#000000"
                        level="M"
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-center text-[10px] text-zinc-600">
                    Se abrirá WhatsApp con un saludo a ARM Merch
                  </p>
                </div>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Link
                  href={`/orders/${orderId}/print`}
                  target="_blank"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-black transition hover:bg-amber-400 active:scale-[0.99]"
                >
                  <Printer size={16} />
                  Imprimir voucher
                </Link>

                <Link
                  href={`/orders/${orderId}`}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-800 px-4 py-3 text-sm font-bold text-white transition hover:bg-zinc-700 active:scale-[0.99]"
                >
                  <Receipt size={16} />
                  Ver orden
                </Link>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={onNewSale}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500 px-4 py-3 text-sm font-bold text-black transition hover:bg-amber-400 active:scale-[0.99]"
                >
                  <Plus size={16} />
                  Nueva venta
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-bold text-zinc-200 transition hover:bg-zinc-800 active:scale-[0.99]"
                >
                  <X size={16} />
                  Cerrar
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}