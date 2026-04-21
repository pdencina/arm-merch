'use client'

import { useState } from 'react'
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

  const paymentOptions = [
    { key: 'efectivo', label: 'Efectivo', icon: Banknote },
    { key: 'transferencia', label: 'Transfer.', icon: Landmark },
    { key: 'debito', label: 'Débito', icon: CreditCard },
    { key: 'credito', label: 'Crédito', icon: Wallet },
  ]

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
      setModalType('loading')
      setModalTitle('Procesando venta...')
      setModalDesc('Estamos registrando la venta y validando la operación.')
      setModalOpen(true)

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        setModalType('error')
        setModalTitle('Sesión no válida')
        setModalDesc('Debes iniciar sesión nuevamente para registrar ventas.')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('campus_id')
        .eq('id', session.user.id)
        .single()

      if (profileError) {
        setModalType('error')
        setModalTitle('No se pudo cargar tu perfil')
        setModalDesc(profileError.message || 'Intenta nuevamente.')
        return
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
        console.error('POST /api/orders error:', data)
        setModalType('error')
        setModalTitle('Error en la venta')
        setModalDesc(
          data?.error ||
            data?.message ||
            'No se pudo registrar la venta. Intenta nuevamente.'
        )
        return
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
      console.error('Cart handleConfirmSale error:', error)
      setModalType('error')
      setModalTitle('Error en la venta')
      setModalDesc(
        error?.message || 'Ocurrió un error inesperado. Intenta nuevamente.'
      )
    }
  }

  return (
    <aside className="w-[420px] shrink-0 border-l border-zinc-800 bg-gradient-to-b from-zinc-950 to-black flex flex-col">
      <div className="border-b border-zinc-800 px-5 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
              <ShoppingCart size={20} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white">
                Carrito
              </h2>
              <p className="text-sm text-zinc-500">
                {itemCount()} item{itemCount() === 1 ? '' : 's'} en la venta
              </p>
            </div>
          </div>

          {items.length > 0 && (
            <button
              onClick={() => clearCart()}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-red-500/40 hover:text-red-400"
            >
              Vaciar
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {items.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900">
              <ShoppingCart size={28} className="text-zinc-600" />
            </div>
            <p className="mt-4 text-lg font-semibold text-zinc-300">
              Tu carrito está vacío
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Agrega productos desde la grilla para comenzar una venta.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.product.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-white">
                    {item.product.name}
                  </p>
                  <p className="mt-1 text-sm font-medium text-amber-400">
                    {fmt(item.product.price)} c/u
                  </p>
                </div>

                <button
                  onClick={() => removeItem(item.product.id)}
                  className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-red-400"
                  aria-label="Quitar producto"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 rounded-xl bg-zinc-950 px-2 py-2">
                  <button
                    onClick={() =>
                      updateQuantity(item.product.id, item.quantity - 1)
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-lg font-bold text-white transition hover:bg-zinc-700"
                  >
                    −
                  </button>

                  <span className="w-8 text-center text-base font-bold text-white">
                    {item.quantity}
                  </span>

                  <button
                    onClick={() =>
                      updateQuantity(item.product.id, item.quantity + 1)
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-lg font-bold text-white transition hover:bg-zinc-700"
                  >
                    +
                  </button>
                </div>

                <p className="text-lg font-bold text-white">
                  {fmt(item.product.price * item.quantity)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-zinc-800 px-5 py-5 space-y-4 bg-zinc-950/90">
        <div className="space-y-3">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              <User size={12} />
              Nombre del cliente
            </span>
            <input
              placeholder="Ej: Pablo Encina"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-lg text-white placeholder-zinc-500 outline-none transition focus:border-amber-500"
            />
          </label>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              <Mail size={12} />
              Email voucher por correo
            </span>
            <input
              placeholder="cliente@email.com"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-lg text-white placeholder-zinc-500 outline-none transition focus:border-amber-500"
            />
          </label>
        </div>

        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
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
                  className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-bold transition ${
                    active
                      ? 'border-amber-500 bg-amber-500 text-black shadow-lg shadow-amber-500/10'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800'
                  }`}
                >
                  <Icon size={15} />
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="flex items-center justify-between text-sm text-zinc-400">
            <span>Subtotal</span>
            <span>{fmt(subtotal())}</span>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-lg font-semibold text-white">Total a cobrar</span>
            <span className="text-4xl font-black tracking-tight text-white">
              {fmt(total())}
            </span>
          </div>
        </div>

        <button
          onClick={handleConfirmSale}
          disabled={items.length === 0}
          className="w-full rounded-2xl bg-amber-500 py-4 text-lg font-black text-black transition hover:bg-amber-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
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