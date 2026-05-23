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
    <main className="min-h-screen bg-[#F5F4EF] text-[#111111] relative overflow-hidden">
      <TrackingAutoRefresh intervalMs={8000} />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,181,162,0.22),transparent_42%)]" />

      <section className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black shadow-sm">
              <span className="text-xl font-black text-white">A</span>
            </div>

            <div>
              <p className="text-2xl font-black text-[#111111]">ARM Merch</p>
              <p className="text-sm text-[#7E9078]">Seguimiento de pedidos</p>
            </div>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-[#D8DDD2] bg-white px-5 py-3 text-sm font-black text-[#111111] shadow-sm transition hover:bg-[#F7F8F5]"
          >
            <Home size={16} />
            Inicio
          </Link>
        </header>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[36px] border border-[#D8DDD2] bg-white/80 p-7 shadow-[0_14px_45px_rgba(0,0,0,0.05)] backdrop-blur">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] bg-[#A8B5A2] text-white shadow-sm">
                <CurrentIcon size={48} />
              </div>

              <div className="min-w-0 flex-1">
                <span className="inline-flex rounded-full border border-[#D8DDD2] bg-[#EEF2EA] px-3 py-1 text-xs font-black text-[#52604C]">
                  {config.title}
                </span>

                <h2 className="mt-4 text-4xl font-black tracking-tight text-[#111111] sm:text-5xl">
                  {config.title}
                </h2>

                <p className="mt-3 max-w-xl text-base leading-7 text-[#5F5F5F]">
                  {config.subtitle}
                </p>
              </div>
            </div>

            <div className="mt-8">
              <div className="mb-2 flex items-center justify-between text-xs text-[#7E9078]">
                <span className="font-bold">Progreso del pedido</span>
                <span className="font-black text-[#52604C]">{progress}%</span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-[#E7EDE3]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#A8B5A2] via-[#8FA28A] to-[#52604C] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="mt-9 space-y-0">
              {TIMELINE.map((step, index) => {
                const Icon = step.icon
                const isDone = currentStatus !== 'cancelled' && index <= currentIndex
                const isActive = currentStatus !== 'cancelled' && index === currentIndex
                const historyItem = history.find((h) => h.status === step.key)

                return (
                  <div key={step.key} className="relative flex gap-4 pb-8 last:pb-0">
                    {index !== TIMELINE.length - 1 && (
                      <div
                        className={`absolute left-[22px] top-11 h-[calc(100%-44px)] w-px ${
                          index < currentIndex ? 'bg-[#8FA28A]' : 'bg-[#D8DDD2]'
                        }`}
                      />
                    )}

                    <div
                      className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
                        isDone
                          ? 'border-[#A8B5A2] bg-[#EEF2EA] text-[#52604C]'
                          : 'border-[#D8DDD2] bg-[#FCFCFA] text-[#A8A8A8]'
                      } ${isActive ? 'ring-4 ring-[#A8B5A2]/15' : ''}`}
                    >
                      <Icon size={21} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className={`font-black ${isDone ? 'text-[#111111]' : 'text-[#A8A8A8]'}`}>
                          {step.title}
                        </h3>

                        {isActive && (
                          <span className="rounded-full bg-[#EEF2EA] px-2 py-0.5 text-[10px] font-black text-[#52604C]">
                            Actual
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-[#6B6B6B]">
                        {historyItem?.message || step.description}
                      </p>

                      <p className="mt-1 text-xs text-[#A0A0A0]">
                        {historyItem ? formatDate(historyItem.created_at) : 'Pendiente'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[32px] border border-[#D8DDD2] bg-white/80 p-6 shadow-[0_12px_35px_rgba(0,0,0,0.04)] backdrop-blur">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF2EA] text-[#52604C]">
                  <Store size={23} />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-[#7E9078]">
                    Retiro en campus
                  </p>
                  <h3 className="mt-2 text-xl font-black text-[#111111]">
                    {destinationCampus?.name || 'Campus por confirmar'}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#6B6B6B]">
                    Te avisaremos cuando el pedido esté listo para retirar.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-[#D8DDD2] bg-white/80 p-6 shadow-[0_12px_35px_rgba(0,0,0,0.04)] backdrop-blur">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-xl font-black text-[#111111]">Resumen</h3>
                <span className="rounded-full bg-[#EEF2EA] px-3 py-1 text-xs font-black text-[#52604C]">
                  Orden #{order.order_number}
                </span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 rounded-2xl bg-[#FCFCFA] p-4">
                  <Sparkles size={18} className="text-[#7E9078]" />
                  <div>
                    <p className="text-[#7E9078]">Cliente</p>
                    <p className="font-black text-[#111111]">{customerName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl bg-[#FCFCFA] p-4">
                  <CalendarDays size={18} className="text-[#7E9078]" />
                  <div>
                    <p className="text-[#7E9078]">Compra realizada</p>
                    <p className="font-black text-[#111111]">{formatDate(order.created_at)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl bg-[#FCFCFA] p-4">
                  <Truck size={18} className="text-[#7E9078]" />
                  <div>
                    <p className="text-[#7E9078]">Estado actual</p>
                    <p className="font-black text-[#111111]">{config.title}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-[#D8DDD2] bg-white/80 p-6 shadow-[0_12px_35px_rgba(0,0,0,0.04)] backdrop-blur">
              <h3 className="mb-5 text-xl font-black text-[#111111]">Productos</h3>

              <div className="space-y-3">
                {productionItems.length === 0 && immediateItems.length === 0 ? (
                  <p className="text-sm text-[#6B6B6B]">
                    Este pedido no tiene productos visibles.
                  </p>
                ) : (
                  <div className="space-y-5">
                    {productionItems.length > 0 && (
                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <Shirt size={16} className="text-[#7E9078]" />
                          <p className="text-sm font-black text-[#52604C]">
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
                                className="rounded-2xl border border-[#D8DDD2] bg-[#FCFCFA] p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-black text-[#111111]">
                                      {product?.name || 'Producto'}
                                    </p>
                                    <p className="mt-1 text-xs text-[#7E9078]">
                                      Pendiente producción
                                    </p>
                                    <p className="mt-1 text-xs text-[#6B6B6B]">
                                      {item.quantity} × {formatCurrency(Number(item.unit_price ?? 0))}
                                      {item.size ? ` · Talla ${item.size}` : ''}
                                    </p>
                                  </div>

                                  <p className="shrink-0 font-black text-[#52604C]">
                                    {formatCurrency(lineTotal)}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {immediateItems.length > 0 && (
                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-[#7E9078]" />
                          <p className="text-sm font-black text-[#52604C]">
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
                                className="rounded-2xl border border-[#D8DDD2] bg-[#FCFCFA] p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-black text-[#111111]">
                                      {product?.name || 'Producto'}
                                    </p>
                                    <p className="mt-1 text-xs text-[#7E9078]">
                                      Entrega inmediata
                                    </p>
                                    <p className="mt-1 text-xs text-[#6B6B6B]">
                                      {item.quantity} × {formatCurrency(Number(item.unit_price ?? 0))}
                                      {item.size ? ` · Talla ${item.size}` : ''}
                                    </p>
                                  </div>

                                  <p className="shrink-0 font-black text-[#52604C]">
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

              <div className="mt-5 flex items-center justify-between border-t border-[#D8DDD2] pt-5">
                <span className="font-black text-[#52604C]">Total pagado</span>
                <span className="text-3xl font-black text-[#111111]">
                  {formatCurrency(Number(order.total ?? 0))}
                </span>
              </div>
            </div>
          </aside>
        </div>

        <footer className="py-8 text-center text-xs text-[#9A9A9A]">
          ARM Merch · Seguimiento generado automáticamente
        </footer>
      </section>
    </main>
  )
}
