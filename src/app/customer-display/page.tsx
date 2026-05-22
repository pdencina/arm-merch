'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Clock3,
  Heart,
  Loader2,
  PackageOpen,
  QrCode,
  ShoppingBag,
  XCircle,
} from 'lucide-react'

type CustomerDisplayItem = {
  id?: string
  name: string
  variant?: string | null
  image_url?: string | null
  quantity: number
  unit_price: number
  subtotal?: number
}

type DisplayStatus =
  | 'idle'
  | 'cart'
  | 'awaiting_payment'
  | 'awaiting_link'
  | 'paid'
  | 'rejected'
  | 'cancelled'

type CustomerDisplayState = {
  status: DisplayStatus
  items: CustomerDisplayItem[]
  total: number
  payment_method?: string | null
  payment_url?: string | null
  order_number?: string | number | null
  message?: string | null
  updated_at?: string
}

const EMPTY_STATE: CustomerDisplayState = {
  status: 'idle',
  items: [],
  total: 0,
  payment_method: null,
  payment_url: null,
  order_number: null,
  message: null,
}

const STORAGE_KEY = 'arm_merch_customer_display_state'
const CHANNEL_NAME = 'arm-merch-customer-display'

function formatCLP(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function normalizeItemSubtotal(item: CustomerDisplayItem) {
  return Number(item.subtotal ?? Number(item.unit_price || 0) * Number(item.quantity || 0))
}

function paymentLabel(method?: string | null) {
  const value = String(method ?? '').toLowerCase()

  if (value === 'solo' || value === 'sumup') return 'SumUp SOLO'
  if (value === 'link') return 'Link de pago / Wallet'
  if (value === 'cash' || value === 'efectivo') return 'Efectivo'
  if (value === 'transferencia' || value === 'transfer') return 'Transferencia'

  return 'Medio de pago'
}

function qrSrc(url?: string | null) {
  if (!url) return ''
  return `https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=12&data=${encodeURIComponent(url)}`
}

export default function CustomerDisplayPage() {
  const [state, setState] = useState<CustomerDisplayState>(EMPTY_STATE)

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)

    if (saved) {
      try {
        setState({ ...EMPTY_STATE, ...JSON.parse(saved) })
      } catch {
        setState(EMPTY_STATE)
      }
    }

    const channel = new BroadcastChannel(CHANNEL_NAME)

    channel.onmessage = (event) => {
      if (!event.data) return
      setState({ ...EMPTY_STATE, ...event.data })
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || !event.newValue) return

      try {
        setState({ ...EMPTY_STATE, ...JSON.parse(event.newValue) })
      } catch {
        setState(EMPTY_STATE)
      }
    }

    window.addEventListener('storage', handleStorage)

    return () => {
      channel.close()
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const total = useMemo(() => {
    if (state.total) return Number(state.total)
    return state.items.reduce((sum, item) => sum + normalizeItemSubtotal(item), 0)
  }, [state.items, state.total])

  const hasItems = state.items.length > 0
  const isPaid = state.status === 'paid'
  const isRejected = state.status === 'rejected' || state.status === 'cancelled'
  const isAwaitingLink = state.status === 'awaiting_link'
  const isAwaitingPayment = state.status === 'awaiting_payment'

  if (isPaid) {
    return (
      <main className="min-h-screen bg-[#F5F4EF] px-10 py-8 text-[#111111]">
        <Header />

        <section className="mx-auto mt-10 flex min-h-[72vh] max-w-6xl flex-col items-center justify-center rounded-[36px] border border-[#D8DDD2] bg-white/80 px-10 py-16 text-center shadow-[0_16px_50px_rgba(0,0,0,0.05)]">
          <div className="mb-8 flex h-36 w-36 items-center justify-center rounded-full bg-[#E7EDE3]">
            <CheckCircle2 className="h-24 w-24 text-[#7E9078]" />
          </div>

          <p className="mb-5 text-sm font-black uppercase tracking-[0.35em] text-[#7E9078]">
            Venta completada
          </p>

          <h1 className="max-w-4xl text-7xl font-black leading-[0.95] tracking-tight md:text-8xl">
            ¡Que tengas
            <span className="block text-[#8FA28A]">un lindo día! ♡</span>
          </h1>

          <div className="mt-10 rounded-full bg-[#EEF2EA] px-8 py-4 text-2xl font-black text-[#52604C]">
            Nos vemos pronto
          </div>

          <p className="mt-12 text-2xl font-bold text-[#111111]">
            Total pagado: {formatCLP(total)}
          </p>

          {state.order_number && (
            <p className="mt-2 text-sm font-semibold text-[#7E9078]">
              Orden #{state.order_number}
            </p>
          )}

          <p className="mt-12 max-w-xl text-lg leading-relaxed text-[#6B6B6B]">
            Gracias por apoyar lo que hacemos 💚
          </p>
        </section>
      </main>
    )
  }

  if (isRejected) {
    return (
      <main className="min-h-screen bg-[#F5F4EF] px-10 py-8 text-[#111111]">
        <Header />

        <section className="mx-auto mt-10 flex min-h-[72vh] max-w-6xl flex-col items-center justify-center rounded-[36px] border border-[#E8D9D9] bg-white/80 px-10 py-16 text-center shadow-[0_16px_50px_rgba(0,0,0,0.05)]">
          <div className="mb-8 flex h-36 w-36 items-center justify-center rounded-full bg-[#F4EAEA]">
            <XCircle className="h-24 w-24 text-[#B45D5D]" />
          </div>

          <p className="mb-5 text-sm font-black uppercase tracking-[0.35em] text-[#B45D5D]">
            Pago no confirmado
          </p>

          <h1 className="max-w-4xl text-6xl font-black leading-[0.95] tracking-tight md:text-7xl">
            No pudimos procesar
            <span className="block text-[#B45D5D]">este pago</span>
          </h1>

          <p className="mt-8 max-w-2xl text-2xl leading-relaxed text-[#6B6B6B]">
            Puedes intentarlo nuevamente con otro medio de pago.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F5F4EF] px-10 py-8 text-[#111111]">
      <Header />

      <section className="mx-auto mt-8 max-w-7xl">
        <div className="mb-8 text-center">
          <h1 className="text-7xl font-black leading-[0.95] tracking-tight md:text-8xl">
            Tu compra
            <span className="block text-[#8FA28A]">
              {hasItems ? 'en camino ♡' : 'comienza aquí'}
            </span>
          </h1>
          <p className="mt-5 text-2xl text-[#4F4F4F]">
            Gracias por apoyar lo que hacemos 💚
          </p>
        </div>

        {isAwaitingLink ? (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <CartPanel items={state.items} total={total} />

            <div className="rounded-[32px] border border-[#D8DDD2] bg-white/80 p-8 text-center shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#EEF2EA]">
                <QrCode className="h-10 w-10 text-[#7E9078]" />
              </div>

              <p className="text-sm font-black uppercase tracking-[0.25em] text-[#7E9078]">
                Escanea para pagar
              </p>

              <h2 className="mt-3 text-4xl font-black">
                {formatCLP(total)}
              </h2>

              <div className="mx-auto mt-8 flex h-[360px] w-[360px] items-center justify-center rounded-[28px] border border-[#D8DDD2] bg-white p-6 shadow-sm">
                {state.payment_url ? (
                  <img
                    src={qrSrc(state.payment_url)}
                    alt="QR de pago"
                    className="h-full w-full rounded-2xl object-contain"
                  />
                ) : (
                  <div className="text-center text-[#7E9078]">
                    <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin" />
                    Generando QR...
                  </div>
                )}
              </div>

              <p className="mt-6 text-lg font-bold text-[#52604C]">
                {paymentLabel(state.payment_method)}
              </p>

              <p className="mt-2 text-sm text-[#6B6B6B]">
                Cuando el pago sea confirmado, esta pantalla cambiará automáticamente.
              </p>
            </div>
          </div>
        ) : (
          <CartPanel items={state.items} total={total} awaiting={isAwaitingPayment} />
        )}
      </section>
    </main>
  )
}

function Header() {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
          <span className="text-2xl font-black">A</span>
        </div>
        <div>
          <p className="text-2xl font-black">ARM Merch</p>
          <p className="text-[#6B6B6B]">Productos oficiales ARM</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#D8DDD2] bg-white px-6 py-3 text-sm font-black text-[#52604C] shadow-sm">
        Pantalla cliente
      </div>
    </header>
  )
}

function CartPanel({
  items,
  total,
  awaiting = false,
}: {
  items: CustomerDisplayItem[]
  total: number
  awaiting?: boolean
}) {
  return (
    <div className="rounded-[32px] border border-[#D8DDD2] bg-white/80 p-8 shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
      <div className="mb-7 flex items-center justify-between border-b border-[#E1E3DD] pb-6">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-[#7E9078]">
            Tu carrito
          </p>
          <h2 className="mt-2 text-4xl font-black">Resumen de tu compra</h2>
        </div>

        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF2EA]">
          <ShoppingBag className="h-8 w-8 text-[#7E9078]" />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
          <PackageOpen className="mb-5 h-20 w-20 text-[#A8B5A2]" />
          <p className="text-4xl font-black">Tu carrito está listo</p>
          <p className="mt-3 text-xl text-[#6B6B6B]">
            Los productos aparecerán aquí mientras se agregan a la venta.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#E1E3DD]">
          {items.map((item, index) => (
            <div key={`${item.id ?? item.name}-${index}`} className="grid grid-cols-[110px_1fr_150px_180px] items-center gap-5 py-4">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-[#F0EFEA]">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <ShoppingBag className="h-10 w-10 text-[#7E9078]" />
                )}
              </div>

              <div>
                <p className="text-2xl font-black">{item.name}</p>
                {item.variant && (
                  <p className="mt-1 text-xl text-[#4F4F4F]">{item.variant}</p>
                )}
              </div>

              <div className="justify-self-center rounded-2xl bg-[#EEF2EA] px-6 py-3 text-xl font-black text-[#111111]">
                {item.quantity} <span className="text-base font-medium text-[#52604C]">und</span>
              </div>

              <p className="justify-self-end text-2xl font-black">
                {formatCLP(normalizeItemSubtotal(item))}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-7 grid grid-cols-[1fr_auto] items-center gap-6 rounded-[28px] border border-[#D8DDD2] bg-[#FCFCFA] p-7">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-[#7E9078]">
            Total a pagar
          </p>
          <p className="mt-2 text-6xl font-black tracking-tight">
            {formatCLP(total)}
          </p>
        </div>

        <div className="hidden rounded-3xl bg-[#EEF2EA] px-7 py-5 text-left lg:block">
          {awaiting ? (
            <div className="flex items-center gap-4">
              <Clock3 className="h-9 w-9 text-[#7E9078]" />
              <div>
                <p className="text-xl font-black text-[#52604C]">Esperando confirmación</p>
                <p className="text-[#6B6B6B]">Estamos validando el pago</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Heart className="h-9 w-9 text-[#7E9078]" />
              <div>
                <p className="text-xl font-black text-[#52604C]">Gracias por tu compra</p>
                <p className="text-[#6B6B6B]">Compra simple, segura y cercana</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
