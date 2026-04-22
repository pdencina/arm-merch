'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/lib/hooks/use-cart'
import FeedbackModal from '@/components/ui/feedback-modal'
import {
  ShoppingCart,
  Trash2,
  CreditCard,
  Landmark,
  Banknote,
  Wallet,
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
  const [submitting, setSubmitting] = useState(false)

  const paymentOptions = [
    { key: 'efectivo', label: 'Efectivo', icon: Banknote },
    { key: 'transferencia', label: 'Transfer.', icon: Landmark },
    { key: 'debito', label: 'Débito', icon: CreditCard },
    { key: 'credito', label: 'Crédito', icon: Wallet },
  ]

  const canSubmit = useMemo(() => {
    return items.length > 0 && clientName.trim().length > 0 && !submitting
  }, [items.length, clientName, submitting])

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
      setModalDesc('Ingresa el nombre del cliente para continuar.')
      setModalOpen(true)
      return
    }

    try {
      setSubmitting(true)
      setModalType('loading')
      setModalTitle('Procesando venta...')
      setModalDesc('Registrando la venta...')
      setModalOpen(true)

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        throw new Error('Sesión expirada. Debes iniciar sesión nuevamente.')
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('campus_id')
        .eq('id', session.user.id)
        .single()

      if (profileError) {
        throw new Error(profileError.message || 'No se pudo cargar el perfil')
      }

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
          discount: 0,
          notes: null,
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            'No se pudo registrar la venta. Intenta nuevamente.'
        )
      }

      setModalType('success')
      setModalTitle('Venta completada')
      setModalDesc(
        data?.email_sent
          ? 'La venta se registró y el voucher fue enviado correctamente.'
          : 'La venta se registró correctamente.'
      )

      clearCart()
      setClientName('')
      setClientEmail('')
    } catch (error: any) {
      setModalType('error')
      setModalTitle('Error en la venta')
      setModalDesc(error?.message || 'Ocurrió un error inesperado.')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()

      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return

      if (e.key === '1') setPaymentMethod('efectivo')
      if (e.key === '2') setPaymentMethod('transferencia')
      if (e.key === '3') setPaymentMethod('debito')
      if (e.key === '4') setPaymentMethod('credito')

      if (e.key === 'Enter' && canSubmit) {
        e.preventDefault()
        handleConfirmSale()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canSubmit, paymentMethod, items.length, clientName])

  return (
    <aside className="flex h-full flex-col bg-[#121319] text-white">
      <div className="flex items-center gap-3 border-b border-white/6 px-6 py-5">
        <ShoppingCart size={20} className="text-zinc-300" />
        <h2 className="text-[18px] font-bold tracking-tight">Carrito</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex h-full min-h-[260px] flex-col items-center justify-center border-b border-white/6 px-6 text-center">
            <ShoppingCart size={54} className="text-zinc-700" />
            <p className="mt-4 text-[15px] leading-7 text-zinc-500">
              Selecciona productos
              <br />
              del catálogo
            </p>
          </div>
        ) : (
          <div className="space-y-3 border-b border-white/6 px-5 py-5">
            {items.map((item) => (
              <div
                key={item.product.id}
                className="rounded-2xl border border-white/6 bg-white/[0.03] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {item.product.name}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {fmt(item.product.price)} c/u
                    </p>
                  </div>

                  <button
                    onClick={() => removeItem(item.product.id)}
                    className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-red-400"
                    aria-label="Quitar producto"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 rounded-xl bg-black/20 px-2 py-1.5">
                    <button
                      onClick={() =>
                        updateQuantity(item.product.id, item.quantity - 1)
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-sm font-bold text-white transition hover:bg-white/10"
                    >
                      −
                    </button>

                    <span className="w-6 text-center text-sm font-bold text-white">
                      {item.quantity}
                    </span>

                    <button
                      onClick={() =>
                        updateQuantity(item.product.id, item.quantity + 1)
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-sm font-bold text-white transition hover:bg-white/10"
                    >
                      +
                    </button>
                  </div>

                  <span className="text-sm font-bold text-white">
                    {fmt(item.product.price * item.quantity)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-5 px-6 py-6">
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Nombre del cliente <span className="text-red-400">*</span>
            </label>
            <input
              placeholder="Ej: Juan Pérez"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder-zinc-500 outline-none transition focus:border-amber-500/50"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Email (voucher por correo)
            </label>
            <input
              placeholder="juan@ejemplo.com"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder-zinc-500 outline-none transition focus:border-amber-500/50"
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            {paymentOptions.map((option) => {
              const active = paymentMethod === option.key

              return (
                <button
                  key={option.key}
                  onClick={() => setPaymentMethod(option.key)}
                  className={`rounded-2xl border px-2 py-3 text-sm font-semibold transition ${
                    active
                      ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
                      : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          <div className="flex items-end justify-between gap-3 pt-1">
            <span className="text-[16px] text-zinc-400">Total a cobrar</span>
            <span className="text-[24px] font-black tracking-tight text-white">
              {fmt(total())}
            </span>
          </div>

          <button
            onClick={handleConfirmSale}
            disabled={!canSubmit}
            className="w-full rounded-3xl bg-[#8A5E12] py-4 text-[18px] font-black text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirmar venta
          </button>
        </div>
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