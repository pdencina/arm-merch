'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  Heart,
  Loader2,
  PackageOpen,
  QrCode,
  ShoppingBag,
  XCircle,
  Banknote,
  Landmark,
  Wallet,
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
  if (value === 'link') return 'Link de pago'
  if (value === 'cash' || value === 'efectivo') return 'Efectivo'
  if (value === 'transferencia' || value === 'transfer') return 'Transferencia'
  return 'Medio de pago'
}

function PaymentIcon({ method }: { method?: string | null }) {
  const value = String(method ?? '').toLowerCase()
  if (value === 'solo' || value === 'sumup') return <CreditCard className="h-6 w-6" />
  if (value === 'efectivo' || value === 'cash') return <Banknote className="h-6 w-6" />
  if (value === 'transferencia' || value === 'transfer') return <Landmark className="h-6 w-6" />
  if (value === 'link') return <Wallet className="h-6 w-6" />
  return <CreditCard className="h-6 w-6" />
}

function qrSrc(url?: string | null) {
  if (!url) return ''
  return `https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=12&data=${encodeURIComponent(url)}`
}

export default function CustomerDisplayPage() {
  const [state, setState] = useState<CustomerDisplayState>(EMPTY_STATE)
  const [clock, setClock] = useState(new Date())
  const [itemCount, setItemCount] = useState(0)

  // Reloj
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { setState({ ...EMPTY_STATE, ...JSON.parse(saved) }) } catch { setState(EMPTY_STATE) }
    }

    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (event) => {
      if (!event.data) return
      setState({ ...EMPTY_STATE, ...event.data })
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || !event.newValue) return
      try { setState({ ...EMPTY_STATE, ...JSON.parse(event.newValue) }) } catch { setState(EMPTY_STATE) }
    }

    window.addEventListener('storage', handleStorage)
    return () => { channel.close(); window.removeEventListener('storage', handleStorage) }
  }, [])

  // Animación al agregar item
  useEffect(() => {
    const newCount = state.items.reduce((s, i) => s + i.quantity, 0)
    if (newCount > itemCount && itemCount > 0) {
      // Trigger animation
    }
    setItemCount(newCount)
  }, [state.items])

  const total = useMemo(() => {
    if (state.total) return Number(state.total)
    return state.items.reduce((sum, item) => sum + normalizeItemSubtotal(item), 0)
  }, [state.items, state.total])

  const hasItems = state.items.length > 0
  const isPaid = state.status === 'paid'
  const isRejected = state.status === 'rejected' || state.status === 'cancelled'
  const isAwaitingLink = state.status === 'awaiting_link'
  const isAwaitingPayment = state.status === 'awaiting_payment'

  // ── PAGADO ──
  if (isPaid) {
    return (
      <main className="flex min-h-screen flex-col bg-[#F5F4EF] px-10 py-8 text-[#111111]">
        <Header clock={clock} />
        <section className="mx-auto mt-8 flex flex-1 max-w-6xl flex-col items-center justify-center rounded-[36px] border border-[#D8DDD2] bg-white/80 px-10 py-16 text-center shadow-[0_16px_50px_rgba(0,0,0,0.05)]">
          <div className="mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-[#E7EDE3] animate-[bounce_1s_ease-in-out_2]">
            <CheckCircle2 className="h-20 w-20 text-[#7E9078]" />
          </div>
          <p className="mb-4 text-sm font-black uppercase tracking-[0.35em] text-[#7E9078]">Compra completada</p>
          <h1 className="max-w-4xl text-6xl font-black leading-[0.95] tracking-tight md:text-7xl">
            ¡Gracias por
            <span className="block text-[#8FA28A]">tu compra!</span>
          </h1>
          <div className="mt-8 rounded-full bg-[#EEF2EA] px-8 py-4 text-xl font-black text-[#52604C]">
            Total: {formatCLP(total)}
            {state.order_number && <span className="ml-3 text-base text-[#7E9078]">· Orden #{state.order_number}</span>}
          </div>
          <p className="mt-10 text-2xl font-bold text-[#6B6B6B]">
            Te esperamos pronto. ¡Bendiciones! ❤️
          </p>
        </section>
      </main>
    )
  }

  // ── RECHAZADO ──
  if (isRejected) {
    return (
      <main className="flex min-h-screen flex-col bg-[#F5F4EF] px-10 py-8 text-[#111111]">
        <Header clock={clock} />
        <section className="mx-auto mt-8 flex flex-1 max-w-6xl flex-col items-center justify-center rounded-[36px] border border-[#E8D9D9] bg-white/80 px-10 py-16 text-center shadow-[0_16px_50px_rgba(0,0,0,0.05)]">
          <div className="mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-[#F4EAEA]">
            <XCircle className="h-20 w-20 text-[#B45D5D]" />
          </div>
          <p className="mb-4 text-sm font-black uppercase tracking-[0.35em] text-[#B45D5D]">Pago no confirmado</p>
          <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-tight md:text-6xl">
            No se pudo procesar
            <span className="block text-[#B45D5D]">el pago</span>
          </h1>
          <p className="mt-8 max-w-2xl text-xl leading-relaxed text-[#6B6B6B]">
            Puedes intentarlo de nuevo con otro medio de pago.
          </p>
        </section>
      </main>
    )
  }

  // ── CARRITO / IDLE ──
  return (
    <main className="flex min-h-screen flex-col bg-[#F5F4EF] px-10 py-8 text-[#111111]">
      <Header clock={clock} />

      <section className="mx-auto mt-6 flex-1 w-full max-w-7xl">
        {!hasItems && !isAwaitingLink && !isAwaitingPayment ? (
          // Estado idle
          <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
            <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-3xl bg-[#EEF2EA]">
              <ShoppingBag className="h-14 w-14 text-[#7E9078]" />
            </div>
            <h1 className="text-6xl font-black tracking-tight md:text-7xl">
              Bienvenido a
              <span className="block text-[#8FA28A]">ARM Merch</span>
            </h1>
            <p className="mt-6 text-2xl text-[#6B6B6B]">
              Tu compra aparecerá aquí
            </p>
          </div>
        ) : isAwaitingLink ? (
          // Esperando link de pago con QR
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <CartPanel items={state.items} total={total} paymentMethod={state.payment_method} />
            <div className="rounded-[32px] border border-[#D8DDD2] bg-white/80 p-8 text-center shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#EEF2EA]">
                <QrCode className="h-10 w-10 text-[#7E9078]" />
              </div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-[#7E9078]">Escanea para pagar</p>
              <h2 className="mt-3 text-4xl font-black">{formatCLP(total)}</h2>
              <div className="mx-auto mt-6 flex h-[320px] w-[320px] items-center justify-center rounded-[28px] border border-[#D8DDD2] bg-white p-5 shadow-sm">
                {state.payment_url ? (
                  <img src={qrSrc(state.payment_url)} alt="QR de pago" className="h-full w-full rounded-2xl object-contain" />
                ) : (
                  <Loader2 className="h-10 w-10 animate-spin text-[#7E9078]" />
                )}
              </div>
              <p className="mt-5 text-lg font-bold text-[#52604C]">{paymentLabel(state.payment_method)}</p>
              <p className="mt-2 text-sm text-[#6B6B6B]">El pago se confirma automáticamente</p>
            </div>
          </div>
        ) : (
          // Carrito normal
          <CartPanel items={state.items} total={total} awaiting={isAwaitingPayment} paymentMethod={state.payment_method} />
        )}
      </section>
    </main>
  )
}

function Header({ clock }: { clock: Date }) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
          <span className="text-xl font-black">A</span>
        </div>
        <div>
          <p className="text-2xl font-black">ARM Merch</p>
          <p className="text-sm text-[#6B6B6B]">Productos oficiales</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="rounded-2xl border border-[#D8DDD2] bg-white px-5 py-2.5 text-center shadow-sm">
          <p className="text-2xl font-black tabular-nums text-[#111]">
            {clock.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-[10px] font-semibold uppercase text-[#6B6B6B]">
            {clock.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })}
          </p>
        </div>

        <div className="rounded-2xl border border-[#D8DDD2] bg-white px-4 py-2.5 text-sm font-black text-[#52604C] shadow-sm">
          Pantalla cliente
        </div>
      </div>
    </header>
  )
}

function CartPanel({
  items,
  total,
  awaiting = false,
  paymentMethod,
}: {
  items: CustomerDisplayItem[]
  total: number
  awaiting?: boolean
  paymentMethod?: string | null
}) {
  return (
    <div className="rounded-[32px] border border-[#D8DDD2] bg-white/80 p-8 shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
      <div className="mb-6 flex items-center justify-between border-b border-[#E1E3DD] pb-5">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-[#7E9078]">Tu carrito</p>
          <h2 className="mt-2 text-3xl font-black">Resumen de compra</h2>
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2EA]">
          <ShoppingBag className="h-7 w-7 text-[#7E9078]" />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
          <PackageOpen className="mb-4 h-16 w-16 text-[#A8B5A2]" />
          <p className="text-3xl font-black">Carrito vacío</p>
          <p className="mt-2 text-lg text-[#6B6B6B]">Los productos aparecerán aquí</p>
        </div>
      ) : (
        <div className="divide-y divide-[#E1E3DD]">
          {items.map((item, index) => (
            <div
              key={`${item.id ?? item.name}-${index}`}
              className="grid grid-cols-[80px_1fr_100px_140px] items-center gap-4 py-3.5 animate-[fadeIn_0.3s_ease-in-out]"
            >
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-[#F0EFEA]">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <ShoppingBag className="h-8 w-8 text-[#7E9078]" />
                )}
              </div>
              <div>
                <p className="text-xl font-black">{item.name}</p>
                {item.variant && <p className="mt-0.5 text-base text-[#4F4F4F]">{item.variant}</p>}
                <p className="text-sm text-[#6B6B6B]">{formatCLP(item.unit_price)} c/u</p>
              </div>
              <div className="justify-self-center rounded-xl bg-[#EEF2EA] px-4 py-2 text-lg font-black">
                {item.quantity}
              </div>
              <p className="justify-self-end text-xl font-black">{formatCLP(normalizeItemSubtotal(item))}</p>
            </div>
          ))}
        </div>
      )}

      {/* Total + método de pago */}
      <div className="mt-6 rounded-[24px] border border-[#D8DDD2] bg-[#FCFCFA] p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#7E9078]">Total</p>
            <p className="mt-1 text-5xl font-black tracking-tight">{formatCLP(total)}</p>
          </div>

          <div className="rounded-2xl bg-[#EEF2EA] px-5 py-4">
            {awaiting ? (
              <div className="flex items-center gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-[#7E9078]" />
                <div>
                  <p className="text-lg font-black text-[#52604C]">Procesando pago...</p>
                  <p className="text-sm text-[#6B6B6B]">{paymentLabel(paymentMethod)}</p>
                </div>
              </div>
            ) : paymentMethod ? (
              <div className="flex items-center gap-3">
                <PaymentIcon method={paymentMethod} />
                <div>
                  <p className="text-lg font-black text-[#52604C]">{paymentLabel(paymentMethod)}</p>
                  <p className="text-sm text-[#6B6B6B]">Medio seleccionado</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Heart className="h-7 w-7 text-[#7E9078]" />
                <div>
                  <p className="text-lg font-black text-[#52604C]">Gracias por tu compra</p>
                  <p className="text-sm text-[#6B6B6B]">ARM Merch</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
