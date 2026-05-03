'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useCart, type CartItem } from '@/lib/hooks/use-cart'
import {
  ShoppingCart,
  Trash2,
  CreditCard,
  Landmark,
  Banknote,
  Wallet,
  X,
  Receipt,
  Minus,
  Plus,
  Package,
  Clock,
  Link,
} from 'lucide-react'
import SaleSuccessModal from '@/components/pos/sale-success-modal'

// ─── helpers ───────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n)

// ─── CartItemRow ────────────────────────────────────────────────────────────
function CartItemRow({
  item,
  onUpdateQty,
  onRemove,
}: {
  item: CartItem
  onUpdateQty: (qty: number) => void
  onRemove: () => void
}) {
  const lineTotal = item.unit_price * item.quantity

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 30, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl border border-white/6 bg-white/[0.025] p-3"
    >
      <div className="flex items-start gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-xl">
          {item.product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.product.image_url}
              alt={item.product.name}
              className="h-10 w-10 rounded-xl object-cover"
            />
          ) : (
            '📦'
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-white">
            {item.product.name}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {fmt(item.unit_price)} c/u
            {item.size && (
              <span className="ml-1.5 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-400">
                Talla {item.size}
              </span>
            )}
          </p>
        </div>

        <button
          onClick={onRemove}
          className="rounded-lg p-1 text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
          aria-label="Quitar"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-xl bg-black/30 px-1.5 py-1">
          <button
            onClick={() => onUpdateQty(item.quantity - 1)}
            className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 text-white transition hover:bg-white/10"
          >
            <Minus size={11} />
          </button>
          <span className="w-7 text-center text-sm font-bold text-white">{item.quantity}</span>
          <button
            onClick={() => onUpdateQty(item.quantity + 1)}
            disabled={item.quantity >= item.product.stock}
            className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 text-white transition hover:bg-white/10 disabled:opacity-30"
          >
            <Plus size={11} />
          </button>
        </div>
        <span className="text-sm font-bold text-white">{fmt(lineTotal)}</span>
      </div>
    </motion.div>
  )
}

// ─── PaymentPill ────────────────────────────────────────────────────────────
function PaymentPill({
  option,
  active,
  onClick,
  shortcut,
}: {
  option: { key: string; label: string; icon: React.ElementType }
  active: boolean
  onClick: () => void
  shortcut: string
}) {
  const Icon = option.icon
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 text-xs font-semibold transition-all duration-200 ${
        active
          ? 'border-amber-500/60 bg-amber-500/20 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
          : 'border-white/8 bg-white/[0.03] text-zinc-400 hover:border-white/15 hover:bg-white/[0.06] hover:text-zinc-200'
      }`}
    >
      <Icon size={16} />
      <span className="leading-none">{option.label}</span>
      <span
        className={`absolute right-1.5 top-1.5 text-[9px] font-bold ${
          active ? 'text-amber-500/70' : 'text-zinc-600'
        }`}
      >
        {shortcut}
      </span>
    </button>
  )
}

// ─── componente principal ───────────────────────────────────────────────────

export default function Cart() {
  const supabase = createClient()
  const {
    items,
    paymentMethod,
    setPaymentMethod,
    clientName,
    clientEmail,
    notes,
    setClientName,
    setClientEmail,
    setNotes,
    updateQuantity,
    removeItem,
    clearCart,
    subtotal,
    total,
    itemCount,
  } = useCart()

  // ── UI state ──
  // Cleanup polling on unmount
  useEffect(() => () => { if (sumupPollRef.current) clearInterval(sumupPollRef.current) }, [])

  const [clientPhone, setClientPhone] = useState('')
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null)
  const [sumupSmartOpen, setSumupSmartOpen] = useState(false)
  const [sumupSmartOrder, setSumupSmartOrder] = useState<{ id: string; number: string | number; total: number } | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null)
  const [recentTxList, setRecentTxList] = useState<any[]>([])
  const [txCode, setTxCode] = useState('')
  const [sumupPolling, setSumupPolling] = useState(false)
  const [sumupStatus, setSumupStatus] = useState<'waiting' | 'found' | 'timeout'>('waiting')
  const sumupPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [showNotes, setShowNotes] = useState(false)
  const [isPendingDelivery, setIsPendingDelivery] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const [linkSentOpen, setLinkSentOpen] = useState(false)
  const [createdOrder, setCreatedOrder] = useState<{
    id: string; number: number | string; total: number; emailSent?: boolean
  } | null>(null)

  const canSubmit = useMemo(
    () => items.length > 0 && clientName.trim().length > 0 && !submitting,
    [items.length, clientName, submitting]
  )

  const paymentOptions = [
    { key: 'efectivo',      label: 'Efectivo',   icon: Banknote  },
    { key: 'transferencia', label: 'Transfer.',   icon: Landmark  },
    { key: 'debito',        label: 'Débito',      icon: CreditCard },
    { key: 'credito',       label: 'Crédito',     icon: Wallet    },
    { key: 'link',          label: 'Link pago',   icon: Link      },
    { key: 'sumup',         label: 'Smart POS',   icon: CreditCard },
  ]

  // ── confirmar venta ──
  // ── Verificar pago Smart POS en SumUp ─────────────────────────────────────
  async function handleVerifySumup() {
    setVerifying(true)
    setVerifyError(null)
    setVerifySuccess(null)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch('/api/sumup/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ tx_code: txCode.trim(), amount: sumupSmartOrder?.total ?? 0 }),
      })
      const data = await res.json()

      if (!data.found) {
        setVerifyError(data.message ?? 'No se encontró la transacción')
        setVerifying(false)
        return
      }

      // Transacción encontrada — registrar la venta
      setVerifySuccess(`✅ Pago verificado · ${data.transaction?.card_type ?? 'Tarjeta'} · TX: ${data.transaction?.tx_code ?? ''}`)

      // Crear la orden
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          payment_method: 'credito',
          items: items.map(i => ({
            product_id: i.product.id,
            quantity: i.quantity,
            unit_price: i.product.price,
            size: i.size ?? null,
          })),
          client_name: clientName.trim(),
          client_email: clientEmail.trim() || '',
          client_phone: clientPhone.trim() || null,
          notes: `Smart POS · TX: ${data.transaction?.tx_code ?? ''} · ${data.transaction?.card_type ?? ''}`,
          discount: 0,
        }),
      })
      const orderData = await orderRes.json()

      if (!orderRes.ok) {
        setVerifyError(orderData.error ?? 'Error registrando la orden')
        setVerifying(false)
        return
      }

      // Éxito
      setSumupSmartOpen(false)
      setCreatedOrder({
        id: orderData.order_id,
        number: orderData.order_number ?? orderData.order_id,
        total: total(),
        emailSent: orderData.email_sent,
      })
      setSuccessOpen(true)
      setClientPhone('')
      clearCart()

    } catch (e: any) {
      setVerifyError(e.message ?? 'Error inesperado')
    }
    setVerifying(false)
  }

  async function handleConfirmSale() {
    if (!canSubmit) return
    setSubmitting(true)

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) throw new Error('Sesión expirada.')

      const { data: profile } = await supabase
        .from('profiles')
        .select('campus_id')
        .eq('id', session.user.id)
        .single()

      // ── Si es Smart POS, crear orden pending y esperar pago ──
      if (paymentMethod === 'sumup') {
        // 1. Crear orden en Supabase como pending
        const supabase = createClient()
        const { data: { session: authSession } } = await supabase.auth.getSession()
        if (!authSession?.access_token) { alert('Sin sesión'); return }

        const orderRes = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
          body: JSON.stringify({
            payment_method: 'credito', // Smart POS cobra con tarjeta
            items: items.map(i => ({ product_id: i.product.id, quantity: i.quantity, size: i.size ?? null, unit_price: i.product.price })),
            client_name: clientName.trim() || null,
            client_email: clientEmail.trim() || null,
            client_phone: clientPhone.trim() || null,
            notes: 'Smart POS SumUp - pendiente de pago',
            delivery_status: isPendingDelivery ? 'pending' : null,
          }),
        })
        const orderData = await orderRes.json()
        if (!orderRes.ok) { alert(orderData.error ?? 'Error creando orden'); return }

        const orderId     = orderData.order_id
        const orderNumber = orderData.order_number ?? orderId
        const orderTotal  = total()

        // 2. Mostrar modal de espera
        setSumupSmartOrder({ id: orderId, number: orderNumber, total: orderTotal })
        setSumupStatus('waiting')
        setSumupSmartOpen(true)
        // NO clearCart aqui - se limpia después de confirmar la orden

        // 3. Iniciar polling cada 4 segundos
        let attempts = 0
        const maxAttempts = 45 // 3 minutos

        sumupPollRef.current = setInterval(async () => {
          attempts++
          if (attempts > maxAttempts) {
            clearInterval(sumupPollRef.current!)
            setSumupStatus('timeout')
            return
          }

          try {
            const verifyRes = await fetch('/api/sumup/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
              body: JSON.stringify({ order_id: orderId, amount: orderTotal }),
            })
            const verifyData = await verifyRes.json()

            if (verifyData.found) {
              clearInterval(sumupPollRef.current!)
              setSumupStatus('found')
            }
          } catch (e) {
            console.error('SumUp verify error:', e)
          }
        }, 4000)

        return // No continuar con el flujo normal
      }

      // ── Si es link de pago, crear checkout en SumUp primero ──
      if (paymentMethod === 'link' && clientPhone.trim()) {
        const { data: { session: authSession } } = await supabase.auth.getSession()
        if (authSession?.access_token) {
          const checkoutRes = await fetch('/api/sumup/checkout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authSession.access_token}`,
            },
            body: JSON.stringify({
              amount: total(),
              currency: 'CLP',
              description: `Pedido ARM Merch - ${clientName.trim()}`,
              order_id: `arm-${Date.now()}`,
            }),
          })
          const checkoutData = await checkoutRes.json()
          if (checkoutRes.ok && checkoutData.payment_url) {
            // Store reference for order creation
            window.__sumupCheckoutRef = checkoutData.checkout_reference
            // Send WhatsApp with payment link
            await fetch('/api/whatsapp', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authSession.access_token}`,
              },
              body: JSON.stringify({
                phone: clientPhone.trim(),
                client_name: clientName.trim(),
                campus_name: 'ARM Merch',
                items: items.map(i => ({ name: i.product.name, size: i.size, quantity: i.quantity })),
                payment_url: checkoutData.payment_url,
                total_amount: total(),
              }),
            })
            setPaymentLinkUrl(checkoutData.payment_url)
          }
        }
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
            unit_price: i.unit_price,
            discount_pct: i.discount_pct,
            size: i.size ?? null,
          })),
          client_name: clientName.trim(),
          client_email: clientEmail.trim() || null,
          client_phone: clientPhone.trim() || null,
          payment_method: paymentMethod,
          discount: 0,
          notes: paymentMethod === 'link' && (window as any).__sumupCheckoutRef ? `sumup:${(window as any).__sumupCheckoutRef}` : (notes.trim() || null),
          delivery_status: isPendingDelivery ? 'pending' : null,
        }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Error al registrar la venta.')

      setIsPendingDelivery(false)
      setPaymentLinkUrl(null)
      setCreatedOrder({
        id: data.order_id,
        number: data.order_number ?? data.order_id,
        total: total(),
        emailSent: data.email_sent,
      })
      if (paymentMethod === 'link') {
        setLinkSentOpen(true)
      } else {
        setSuccessOpen(true)
      }
      setClientPhone('')
      clearCart()
    } catch (err: any) {
      alert(err?.message || 'Error inesperado')
    } finally {
      setSubmitting(false)
    }
  }

  // ── atajos de teclado ──
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      if (e.key === '1') setPaymentMethod('efectivo')
      if (e.key === '2') setPaymentMethod('transferencia')
      if (e.key === '3') setPaymentMethod('debito')
      if (e.key === '4') setPaymentMethod('credito')
      if (e.key === 'Enter' && canSubmit) { e.preventDefault(); handleConfirmSale() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canSubmit, paymentMethod, items.length, clientName])


  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <>
      <aside className="flex h-full flex-col bg-[#0e0f14] text-white">

        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-white/6 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <ShoppingCart size={19} className="text-zinc-300" />
              <AnimatePresence>
                {itemCount() > 0 && (
                  <motion.span
                    key="badge"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-black"
                  >
                    {itemCount()}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <h2 className="text-[17px] font-bold tracking-tight">Carrito</h2>
          </div>

          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
            >
              Vaciar
            </button>
          )}
        </div>

        {/* SCROLL AREA */}
        <div className="flex-1 overflow-y-auto">

          {/* ITEMS */}
          <div className="px-4 py-4">
            <AnimatePresence mode="popLayout">
              {items.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex min-h-[200px] flex-col items-center justify-center text-center"
                >
                  <ShoppingCart size={48} className="text-zinc-800" />
                  <p className="mt-3 text-sm text-zinc-600">
                    Selecciona productos del catálogo
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-2.5">
                  {items.map((item) => (
                    <CartItemRow
                      key={item.product.id}
                      item={item}
                      onUpdateQty={(qty) => updateQuantity(item.product.id, qty)}
                      onRemove={() => removeItem(item.product.id)}
                    />
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>

          {items.length > 0 && (
            <div className="space-y-4 px-4 pb-6">

              {/* DATOS DEL CLIENTE */}
              <div className="space-y-2.5">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Cliente <span className="text-red-400">*</span>
                </label>
                <input
                  placeholder="Nombre del cliente"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-amber-500/40"
                />
                <input
                  placeholder="Email (voucher por correo)"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-amber-500/40"
                />
                <input
                  placeholder="Teléfono WhatsApp (ej: +56912345678)"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  type="tel"
                  className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-amber-500/40"
                />
              </div>

              {/* NOTAS */}
              <div>
                <button
                  onClick={() => setShowNotes((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300"
                >
                  <Receipt size={12} />
                  {showNotes ? 'Ocultar notas' : 'Agregar nota a la venta'}
                </button>

                <AnimatePresence>
                  {showNotes && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ej: Cliente recoge mañana..."
                        rows={2}
                        className="mt-2 w-full resize-none rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-amber-500/40"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* PEDIDO PARA PRODUCIR */}
              <button
                onClick={() => setIsPendingDelivery(v => !v)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                  isPendingDelivery
                    ? 'border-violet-500/40 bg-violet-500/10'
                    : 'border-white/6 bg-white/[0.02] hover:border-white/10'
                }`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                  isPendingDelivery ? 'bg-violet-500/20' : 'bg-white/5'
                }`}>
                  {isPendingDelivery
                    ? <Clock size={16} className="text-violet-400" />
                    : <Package size={16} className="text-zinc-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isPendingDelivery ? 'text-violet-300' : 'text-zinc-300'}`}>
                    {isPendingDelivery ? 'Pedido para producir' : 'Entrega inmediata'}
                  </p>
                  <p className="text-[10px] text-zinc-600">
                    {isPendingDelivery
                      ? 'Pagado · quedará pendiente de entrega'
                      : 'El producto se entrega en el momento'}
                  </p>
                </div>
                <div className={`relative flex h-5 w-9 shrink-0 items-center rounded-full transition-all ${
                  isPendingDelivery ? 'bg-violet-500' : 'bg-zinc-700'
                }`}>
                  <span className={`absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-all ${
                    isPendingDelivery ? 'left-[18px]' : 'left-[3px]'
                  }`} />
                </div>
              </button>

              {/* MÉTODO DE PAGO */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Método de pago
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {paymentOptions.map((option, i) => (
                    <PaymentPill
                      key={option.key}
                      option={option}
                      active={paymentMethod === option.key}
                      onClick={() => setPaymentMethod(option.key)}
                      shortcut={String(i + 1)}
                    />
                  ))}
                </div>
              </div>

              {/* RESUMEN TOTAL */}
              <div className="rounded-2xl border border-white/6 bg-white/[0.025] p-4 space-y-2">
                <div className="flex justify-between text-sm text-zinc-400">
                  <span>Subtotal ({itemCount()} {itemCount() === 1 ? 'ítem' : 'ítems'})</span>
                  <span>{fmt(subtotal())}</span>
                </div>

                <div className="border-t border-white/6 pt-2 flex items-end justify-between">
                  <span className="text-zinc-300 text-sm">Total a cobrar</span>
                  <motion.span
                    key={total()}
                    initial={{ scale: 1.08 }}
                    animate={{ scale: 1 }}
                    className="text-[26px] font-black tracking-tight text-white"
                  >
                    {fmt(total())}
                  </motion.span>
                </div>
              </div>

              {/* BOTÓN CONFIRMAR */}
              <motion.button
                whileHover={{ scale: canSubmit ? 1.01 : 1 }}
                whileTap={{ scale: canSubmit ? 0.98 : 1 }}
                onClick={handleConfirmSale}
                disabled={!canSubmit}
                className="relative w-full overflow-hidden rounded-3xl py-4 text-[17px] font-black text-black transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: canSubmit ? (isPendingDelivery ? '#7c3aed' : '#d97706') : '#555' }}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    Procesando...
                  </span>
                ) : isPendingDelivery ? (
                  <span className="flex items-center justify-center gap-2">
                    <Clock size={18} />
                    Registrar pedido · {fmt(total())}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <CreditCard size={18} />
                    Confirmar venta · {fmt(total())}
                  </span>
                )}
              </motion.button>

              <p className="text-center text-[10px] text-zinc-600">
                Presiona <kbd className="rounded bg-white/8 px-1 font-mono">Enter</kbd> para confirmar rápido
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Smart POS — Esperando pago */}
      {sumupSmartOpen && sumupSmartOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-700 bg-zinc-900 p-8 text-center shadow-2xl">

            {sumupStatus === 'waiting' && (
              <>
                <div className="mb-5 flex justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-amber-500/30">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-700 border-t-amber-500" />
                  </div>
                </div>
                <h2 className="mb-2 text-xl font-bold text-white">Esperando pago</h2>
                <p className="mb-1 text-sm text-zinc-400">Cobra en el Smart POS de SumUp</p>
                <p className="mb-5 text-xs text-zinc-600">El sistema detectará el pago automáticamente</p>
                <div className="rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-4 mb-6 text-left space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Orden</span>
                    <span className="font-bold text-white">#{sumupSmartOrder.number}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Total a cobrar</span>
                    <span className="font-bold text-amber-400 text-base">
                      {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(sumupSmartOrder.total)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Estado</span>
                    <span className="text-amber-400">⏳ Esperando cobro en Smart POS</span>
                  </div>
                </div>
                <button
                  onClick={() => { clearInterval(sumupPollRef.current!); setSumupSmartOpen(false) }}
                  className="w-full rounded-2xl border border-zinc-700 py-2.5 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-white"
                >
                  Cancelar
                </button>
              </>
            )}

            {sumupStatus === 'found' && (
              <>
                <div className="mb-4 text-6xl">✅</div>
                <h2 className="mb-2 text-xl font-bold text-white">¡Pago confirmado!</h2>
                <p className="mb-1 text-sm text-zinc-400">Orden <strong className="text-white">#{sumupSmartOrder.number}</strong></p>
                <p className="mb-6 text-xs text-zinc-600">El pago fue detectado en SumUp y la venta fue registrada.</p>
                <button
                  onClick={() => setSumupSmartOpen(false)}
                  className="w-full rounded-2xl bg-green-500 py-3 text-sm font-bold text-white transition hover:bg-green-400"
                >
                  Nueva venta
                </button>
              </>
            )}

            {sumupStatus === 'timeout' && (
              <>
                <div className="mb-4 text-6xl">⏱️</div>
                <h2 className="mb-2 text-xl font-bold text-white">Tiempo de espera agotado</h2>
                <p className="mb-1 text-sm text-zinc-400">No se detectó el pago en 3 minutos.</p>
                <p className="mb-6 text-xs text-zinc-600">La orden #{sumupSmartOrder.number} quedó pendiente. Puedes confirmarla manualmente en Órdenes si el cliente pagó.</p>
                <button
                  onClick={() => setSumupSmartOpen(false)}
                  className="w-full rounded-2xl bg-zinc-700 py-3 text-sm font-bold text-white transition hover:bg-zinc-600"
                >
                  Cerrar
                </button>
              </>
            )}

          </div>
        </div>
      )}

      {/* Smart POS Modal */}
      {sumupSmartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-700 bg-zinc-900 p-8 text-center shadow-2xl">
            <div className="mb-4 text-5xl">🖥️</div>
            <h2 className="mb-2 text-xl font-bold text-white">Cobro con Smart POS</h2>
            <p className="mb-2 text-sm text-zinc-400">Total a cobrar:</p>
            <p className="mb-6 text-3xl font-black text-amber-400">
              {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(sumupSmartOrder?.total ?? 0)}
            </p>

            <div className="mb-6 rounded-2xl border border-zinc-700 bg-zinc-800 p-4 text-left space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Instrucciones</p>
              <div className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="shrink-0 font-bold text-amber-400">1.</span>
                <span>Cobra <strong>{new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(sumupSmartOrder?.total ?? 0)}</strong> en el Smart POS físicamente</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="shrink-0 font-bold text-amber-400">2.</span>
                <span>Espera que el cliente pase la tarjeta y el pago sea aprobado</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="shrink-0 font-bold text-amber-400">3.</span>
                <span>Presiona <strong>"Confirmar pago"</strong> — el sistema verificará automáticamente con SumUp</span>
              </div>
            </div>

            {verifyError && (
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                ❌ {verifyError}
              </div>
            )}

            {verifySuccess && (
              <div className="mb-4 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-xs text-green-400">
                {verifySuccess}
              </div>
            )}

            {/* TX Code input */}
            <div className="mb-4">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                Código de transacción del Smart POS
              </label>
              <input
                value={txCode}
                onChange={e => setTxCode(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') handleVerifySumup() }}
                placeholder="Ej: TAAA2UTDS4R"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-mono text-white placeholder-zinc-600 outline-none transition focus:border-amber-500/60"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="mt-1.5 text-[10px] text-zinc-600">
                El código aparece en la pantalla del Smart POS y en el comprobante del cliente
              </p>
            </div>

            <button
              onClick={() => handleVerifySumup()}
              disabled={verifying}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-50"
            >
              {verifying
                ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" /> Verificando con SumUp...</>
                : '✅ Confirmar pago recibido'}
            </button>

            <button
              onClick={() => { setSumupSmartOpen(false); setVerifyError(null); setTxCode(''); setSubmitting(false) }}
              className="w-full text-center text-xs text-zinc-600 hover:text-zinc-400 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Link de pago enviado */}
      {linkSentOpen && createdOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-700 bg-zinc-900 p-8 text-center shadow-2xl">
            <div className="mb-4 text-6xl">📱</div>
            <h2 className="mb-3 text-xl font-bold text-white">Link enviado al cliente</h2>
            <p className="mb-1 text-sm text-zinc-400">
              Orden <span className="font-bold text-white">#{createdOrder.number}</span>
            </p>
            <p className="mb-5 text-sm text-zinc-500">
              El cliente recibirá el link por WhatsApp para pagar con tarjeta, Apple Pay o Google Pay.
            </p>

            {/* Estado visual */}
            <div className="rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-4 mb-6 text-left space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Estado orden</span>
                <span className="font-semibold text-amber-400">⏳ Pendiente de pago</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Stock descontado</span>
                <span className="font-semibold text-zinc-400">No — se descuenta al pagar</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Confirmación</span>
                <span className="font-semibold text-zinc-400">Automática al pagar</span>
              </div>
            </div>

            <p className="mb-5 text-xs text-zinc-600">
              Si el cliente no paga, la orden quedará pendiente sin afectar el inventario.
            </p>

            <button
              onClick={() => { setLinkSentOpen(false); clearCart() }}
              className="w-full rounded-2xl bg-amber-500 py-3 text-sm font-bold text-black transition hover:bg-amber-400"
            >
              Nueva venta
            </button>
          </div>
        </div>
      )}

      {/* MODAL ÉXITO */}
      {createdOrder && (
        <SaleSuccessModal
          open={successOpen}
          orderId={createdOrder.id}
          orderNumber={createdOrder.number}
          total={createdOrder.total}
          emailSent={createdOrder.emailSent}
          onNewSale={() => setSuccessOpen(false)}
        />
      )}
    </>
  )
}
