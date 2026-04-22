'use client'

import { useEffect, useMemo, useState } from 'react'
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
  Keyboard,
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
      setModalDesc('Ingresa el nombre del cliente.')
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
          campus_id: profile?.campus_id,
          items: items.map((i) => ({
            product_id: i.product.id,
            quantity: i.quantity,
            unit_price: i.product.price,
          })),
          client_name: clientName.trim(),
          client_email: clientEmail.trim() || null,
          payment_method: paymentMethod,
          discount: 0,
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Error en la venta')
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

      if (e.key === 'Enter' && canSubmit) {
        e.preventDefault()
        handleConfirmSale()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canSubmit, items, clientName, clientEmail, paymentMethod])

  return (
    <aside className="flex h-full flex-col bg-zinc-950">
      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-200/10">
            <ShoppingCart size={18} className="text-slate-300" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Carrito</h2>
            <p className="text-xs text-zinc-500">
              {itemCount()} producto{itemCount() === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">
              Total actual
            </span>
            <div className="flex items-center gap-1 text-zinc-500">
              <Keyboard size={13} />
              <span className="text-[11px]">Enter</span>
            </div>
          </div>

          <div className="mt-2 flex items-end justify-between">
            <span className="text-3xl font-black tracking-tight text-white">
              {fmt(total())}
            </span>
            <span className="text-xs text-zinc-500">
              {itemCount()} ítem{itemCount() === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {items.length === 0 ? (
          <div className="mt-2 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900">
              <ShoppingCart size={22} className="text-zinc-600" />
            </div>
            <p className="mt-3 text-sm font-semibold text-zinc-300">
              Carrito vacío
            </p>
            <p className="mt-1 text-xs leading-6 text-zinc-500">
              Agrega productos desde la grilla para comenzar una venta.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.product.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"
            >
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {item.product.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-300">
                    {fmt(item.product.price)} c/u
                  </p>
                </div>

                <button
                  onClick={() => removeItem(item.product.id)}
                  className="text-zinc-500 transition hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2 rounded-lg bg-zinc-950 px-2 py-1.5">
                  <button
                    onClick={() =>
                      updateQuantity(item.product.id, item.quantity - 1)
                    }
                    className="flex h-7 w-7 items-center justify-center rounded bg-zinc-800 text-sm font-bold text-white transition hover:bg-zinc-700"
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
                    className="flex h-7 w-7 items-center justify-center rounded bg-zinc-800 text-sm font-bold text-white transition hover:bg-zinc-700"
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

      <div className="border-t border-zinc-800 bg-zinc-950 px-4 py-4">
        <div className="space-y-3">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              <User size={12} />
              Nombre del cliente
            </span>
            <input
              placeholder="Ej: Pablo Encina"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-slate-400"
            />
          </label>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              <Mail size={12} />
              Email voucher por correo
            </span>
            <input
              placeholder="cliente@email.com"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-slate-400"
            />
          </label>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Método de pago
            </p>

            <div className="grid grid-cols-2 gap-2">
              {paymentOptions.map((option) => {
                const Icon = option.icon
                const active = paymentMethod === option.key

                return (
                  <button
                    key={option.key}
                    onClick={() => setPaymentMethod(option.key)}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                      active
                        ? 'border-slate-300 bg-slate-200 text-black'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800'
                    }`}
                  >
                    <Icon size={13} />
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
            <div className="flex items-center justify-between text-sm text-zinc-400">
              <span>Subtotal</span>
              <span>{fmt(subtotal())}</span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">
                Total a cobrar
              </span>
              <span className="text-xl font-black tracking-tight text-white">
                {fmt(total())}
              </span>
            </div>
          </div>

          <button
            onClick={handleConfirmSale}
            disabled={!canSubmit}
            className="w-full rounded-xl bg-slate-200 py-3 font-bold text-black transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Procesando...' : 'Confirmar venta'}
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