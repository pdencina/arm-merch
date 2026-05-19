import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import TrackingAutoRefresh from '@/components/tracking/auto-refresh'
import {
  CheckCircle2,
  Clock3,
  PackageCheck,
  Shirt,
  Store,
  Truck,
  ReceiptText,
  CalendarDays,
  Sparkles,
  Home,
} from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = {
  params: {
    token: string
  }
}

type OrderData = {
  id: string
  order_number: number | string
  tracking_token: string | null
  production_status: string | null
  status: string | null
  total: number | null
  created_at: string
  ready_at?: string | null
  delivered_at?: string | null
  campus_id: string | null
  pickup_campus_id?: string | null
}

type ContactData = {
  client_name: string | null
  client_email: string | null
  client_phone: string | null
}

type CampusData = {
  id: string
  name: string
}

type ItemData = {
  id: string
  quantity: number
  unit_price: number
  fulfillment_type?: string | null
  size?: string | null
  products:
    | {
        name?: string | null
        sku?: string | null
      }
    | Array<{
        name?: string | null
        sku?: string | null
      }>
    | null
}

type HistoryData = {
  id: string
  status: string
  message: string | null
  created_at: string
}

const STATUS_CONFIG: Record<
  string,
  {
    title: string
    subtitle: string
    icon: any
    badge: string
    percent: number
  }
> = {
  pending_production: {
    title: 'Pedido recibido',
    subtitle: 'Recibimos tu compra y ya está en nuestra cola de preparación.',
    icon: ReceiptText,
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    percent: 25,
  },
  in_preparation: {
    title: 'En preparación',
    subtitle: 'Estamos preparando los detalles de tu pedido.',
    icon: Clock3,
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    percent: 35,
  },
  in_production: {
    title: 'En producción',
    subtitle: 'Tu producto está siendo preparado por el equipo ARM Merch.',
    icon: Shirt,
    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    percent: 60,
  },
  ready_pickup: {
    title: 'Listo para retiro',
    subtitle: 'Tu pedido ya está disponible para retirar en el campus indicado.',
    icon: PackageCheck,
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    percent: 85,
  },
  delivered: {
    title: 'Pedido entregado',
    subtitle: 'El pedido fue retirado exitosamente. ¡Gracias por tu compra!',
    icon: CheckCircle2,
    badge: 'bg-green-500/15 text-green-300 border-green-500/30',
    percent: 100,
  },
  cancelled: {
    title: 'Pedido cancelado',
    subtitle: 'Este pedido fue cancelado o no pudo ser confirmado.',
    icon: Clock3,
    badge: 'bg-red-500/15 text-red-300 border-red-500/30',
    percent: 0,
  },
}

const TIMELINE = [
  {
    key: 'pending_production',
    title: 'Compra confirmada',
    description: 'Recibimos tu compra correctamente.',
    icon: ReceiptText,
  },
  {
    key: 'in_production',
    title: 'En producción',
    description: 'Estamos preparando tu producto.',
    icon: Shirt,
  },
  {
    key: 'ready_pickup',
    title: 'Listo para retiro',
    description: 'Disponible en el campus seleccionado.',
    icon: PackageCheck,
  },
  {
    key: 'delivered',
    title: 'Entregado',
    description: 'Pedido retirado exitosamente.',
    icon: CheckCircle2,
  },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatDate(value?: string | null) {
  if (!value) return 'Pendiente'
  return new Date(value).toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function normalizeStatus(order: OrderData | null) {
  if (!order) return 'pending_production'
  if (order.status === 'cancelled') return 'cancelled'
  return order.production_status || 'pending_production'
}

function getStatusIndex(status: string) {
  if (status === 'cancelled') return -1
  const index = TIMELINE.findIndex((step) => step.key === status)
  return index >= 0 ? index : 0
}

function getProduct(item: ItemData) {
  return Array.isArray(item.products) ? item.products[0] : item.products
}

export default async function TrackingPage({ params }: PageProps) {
  const token = decodeURIComponent(params.token || '').trim()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return (
      <main className="min-h-screen bg-[#090b10] px-4 py-10 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-500/20 bg-red-950/30 p-6">
          <h1 className="text-xl font-bold">Configuración incompleta</h1>
          <p className="mt-2 text-sm text-red-200">
            Faltan variables de entorno para consultar el seguimiento.
          </p>
        </div>
      </main>
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      tracking_token,
      production_status,
      status,
      total,
      created_at,
      ready_at,
      delivered_at,
      campus_id,
      pickup_campus_id
    `)
    .eq('tracking_token', token)
    .maybeSingle<OrderData>()

  if (orderError || !order) {
    return (
      <main className="min-h-screen bg-[#090b10] px-4 py-10 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/15 text-amber-300">
            <ReceiptText size={32} />
          </div>
          <h1 className="text-2xl font-black">Seguimiento no encontrado</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            No encontramos un pedido asociado a este código.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-black"
          >
            <Home size={16} className="mr-2" />
            Ir al inicio
          </Link>
        </div>
      </main>
    )
  }

  const [
    contactResult,
    itemsResult,
    campusResult,
    pickupCampusResult,
    historyResult,
  ] = await Promise.all([
    supabase
      .from('order_contacts')
      .select('client_name, client_email, client_phone')
      .eq('order_id', order.id)
      .maybeSingle<ContactData>(),

    supabase
      .from('order_items')
      .select(`
        id,
        quantity,
        unit_price,
        fulfillment_type,
        size,
        products (
          name,
          sku
        )
      `)
      .eq('order_id', order.id),

    order.campus_id
      ? supabase.from('campus').select('id, name').eq('id', order.campus_id).maybeSingle<CampusData>()
      : Promise.resolve({ data: null }),

    order.pickup_campus_id
      ? supabase.from('campus').select('id, name').eq('id', order.pickup_campus_id).maybeSingle<CampusData>()
      : Promise.resolve({ data: null }),

    supabase
      .from('order_status_history')
      .select('id, status, message, created_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true }),
  ])

  const contact = contactResult.data
  const safeItems = (itemsResult.data ?? []) as ItemData[]

  const productionItems = safeItems.filter(
    (item) => item.fulfillment_type === 'production'
  )

  const immediateItems = safeItems.filter(
    (item) => item.fulfillment_type !== 'production'
  )

  const campus = campusResult.data
  const pickupCampus = pickupCampusResult.data
  const history = (historyResult.data ?? []) as HistoryData[]

  const currentStatus = normalizeStatus(order)
  const config = STATUS_CONFIG[currentStatus] ?? STATUS_CONFIG.pending_production
  const CurrentIcon = config.icon
  const currentIndex = getStatusIndex(currentStatus)
  const customerName = contact?.client_name || 'Cliente ARM Merch'
  const destinationCampus = pickupCampus || campus
  const progress = config.percent

  return (
    <main className="min-h-screen bg-[#090b10] text-white">
      <TrackingAutoRefresh intervalMs={8000} />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.14),transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.12),transparent_35%)]" />

      <section className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">
              ARM Merch
            </p>
            <h1 className="mt-1 text-lg font-black sm:text-xl">
              Seguimiento de pedido
            </h1>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-right">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">
              Código
            </p>
            <p className="font-mono text-sm font-black text-white">
              {order.tracking_token}
            </p>
          </div>
        </header>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-5 shadow-2xl backdrop-blur sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.7rem] bg-amber-500 text-black shadow-[0_0_40px_rgba(245,158,11,0.22)]">
                <CurrentIcon size={42} />
              </div>

              <div className="min-w-0 flex-1">
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${config.badge}`}>
                  {config.title}
                </span>
                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                  {config.title}
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                  {config.subtitle}
                </p>
              </div>
            </div>

            <div className="mt-7">
              <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                <span>Progreso del pedido</span>
                <span className="font-bold text-amber-300">{progress}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-400 to-emerald-400 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="mt-8 space-y-0">
              {TIMELINE.map((step, index) => {
                const Icon = step.icon
                const isDone = currentStatus !== 'cancelled' && index <= currentIndex
                const isActive = currentStatus !== 'cancelled' && index === currentIndex
                const historyItem = history.find((h) => h.status === step.key)

                return (
                  <div key={step.key} className="relative flex gap-4 pb-7 last:pb-0">
                    {index !== TIMELINE.length - 1 && (
                      <div
                        className={`absolute left-[22px] top-11 h-[calc(100%-44px)] w-px ${
                          index < currentIndex ? 'bg-emerald-500/70' : 'bg-white/10'
                        }`}
                      />
                    )}

                    <div
                      className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
                        isDone
                          ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-300'
                          : 'border-white/10 bg-white/[0.04] text-zinc-500'
                      } ${isActive ? 'ring-4 ring-amber-500/10' : ''}`}
                    >
                      <Icon size={21} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className={`font-bold ${isDone ? 'text-white' : 'text-zinc-500'}`}>
                          {step.title}
                        </h3>
                        {isActive && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-300">
                            Actual
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">
                        {historyItem?.message || step.description}
                      </p>
                      <p className="mt-1 text-xs text-zinc-600">
                        {historyItem ? formatDate(historyItem.created_at) : 'Pendiente'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-5 backdrop-blur sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300">
                  <Store size={22} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                    Retiro en campus
                  </p>
                  <h3 className="mt-1 text-lg font-black">
                    {destinationCampus?.name || 'Campus por confirmar'}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    Te avisaremos cuando el pedido esté listo para retirar.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-5 backdrop-blur sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-black">Resumen</h3>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-400">
                  Orden #{order.order_number}
                </span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 rounded-2xl bg-black/20 p-3">
                  <Sparkles size={18} className="text-amber-300" />
                  <div>
                    <p className="text-zinc-500">Cliente</p>
                    <p className="font-semibold text-white">{customerName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl bg-black/20 p-3">
                  <CalendarDays size={18} className="text-amber-300" />
                  <div>
                    <p className="text-zinc-500">Compra realizada</p>
                    <p className="font-semibold text-white">{formatDate(order.created_at)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl bg-black/20 p-3">
                  <Truck size={18} className="text-amber-300" />
                  <div>
                    <p className="text-zinc-500">Estado actual</p>
                    <p className="font-semibold text-white">{config.title}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-5 backdrop-blur sm:p-6">
              <h3 className="mb-4 text-lg font-black">Productos</h3>

              <div className="space-y-3">
                {productionItems.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    Este pedido no tiene productos en producción.
                  </p>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <Shirt size={16} className="text-violet-300" />
                        <p className="text-sm font-black text-violet-300">
                          Productos en producción
                        </p>
                      </div>

                      <div className="space-y-3">
                        {productionItems.map((item) => {
                          const product = getProduct(item)
                          const lineTotal =
                            Number(item.quantity ?? 0) *
                            Number(item.unit_price ?? 0)

                          return (
                            <div
                              key={item.id}
                              className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-bold text-white">
                                    {product?.name || 'Producto'}
                                  </p>
                                  <p className="mt-1 text-xs text-violet-200">
                                    Pendiente producción
                                  </p>
                                  <p className="mt-1 text-xs text-zinc-500">
                                    {item.quantity} × {formatCurrency(Number(item.unit_price ?? 0))}
                                    {item.size ? ` · Talla ${item.size}` : ''}
                                  </p>
                                </div>

                                <p className="shrink-0 font-black text-violet-300">
                                  {formatCurrency(lineTotal)}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {immediateItems.length > 0 && (
                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-300" />
                          <p className="text-sm font-black text-emerald-300">
                            Productos entregados
                          </p>
                        </div>

                        <div className="space-y-3">
                          {immediateItems.map((item) => {
                            const product = getProduct(item)
                            const lineTotal =
                              Number(item.quantity ?? 0) *
                              Number(item.unit_price ?? 0)

                            return (
                              <div
                                key={item.id}
                                className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-bold text-white">
                                      {product?.name || 'Producto'}
                                    </p>
                                    <p className="mt-1 text-xs text-emerald-200">
                                      Entrega inmediata
                                    </p>
                                    <p className="mt-1 text-xs text-zinc-500">
                                      {item.quantity} × {formatCurrency(Number(item.unit_price ?? 0))}
                                      {item.size ? ` · Talla ${item.size}` : ''}
                                    </p>
                                  </div>

                                  <p className="shrink-0 font-black text-emerald-300">
                                    {formatCurrency(lineTotal)}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                <span className="font-bold text-zinc-300">Total pagado</span>
                <span className="text-2xl font-black text-white">
                  {formatCurrency(Number(order.total ?? 0))}
                </span>
              </div>
            </div>
          </aside>
        </div>

        <footer className="py-8 text-center text-xs text-zinc-600">
          ARM Merch · Seguimiento generado automáticamente
        </footer>
      </section>
    </main>
  )
}
