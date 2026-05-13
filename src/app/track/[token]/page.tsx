import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { CheckCircle2, Circle, Clock, Home, PackageCheck, Shirt, Truck } from 'lucide-react'

type Props = { params: { token: string } }

const STATUS_ORDER = ['pending_production', 'in_production', 'ready_pickup', 'delivered']

const STEPS = [
  {
    key: 'pending_production',
    title: 'En preparación',
    message: 'Recibimos tu compra y el pedido quedó en preparación.',
    icon: Clock,
  },
  {
    key: 'in_production',
    title: 'En producción',
    message: 'Estamos preparando tu producto con el equipo ARM Merch.',
    icon: Shirt,
  },
  {
    key: 'ready_pickup',
    title: 'Listo para retiro',
    message: 'Tu pedido ya está disponible para retirar en el campus indicado.',
    icon: PackageCheck,
  },
  {
    key: 'delivered',
    title: 'Entregado',
    message: 'El pedido fue entregado correctamente.',
    icon: Truck,
  },
]

function fmt(n: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n || 0)
}

function formatDate(value?: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function currentLabel(status?: string | null) {
  const map: Record<string, string> = {
    pending_production: 'En preparación',
    in_production: 'En producción',
    ready_pickup: 'Listo para retiro',
    delivered: 'Entregado',
    not_required: 'Compra confirmada',
  }
  return map[String(status ?? '')] ?? 'Seguimiento'
}

function getStepState(current: string | null | undefined, step: string) {
  const normalizedCurrent = String(current ?? 'pending_production')
  const currentIndex = STATUS_ORDER.indexOf(normalizedCurrent)
  const stepIndex = STATUS_ORDER.indexOf(step)

  if (currentIndex < 0) return stepIndex === 0 ? 'active' : 'pending'
  if (stepIndex < currentIndex) return 'done'
  if (stepIndex === currentIndex) return 'active'
  return 'pending'
}

function StepIcon({ state, icon: Icon }: { state: string; icon: any }) {
  if (state === 'done') return <CheckCircle2 className="h-7 w-7 text-green-400" />
  if (state === 'active') return <Icon className="h-7 w-7 text-amber-400" />
  return <Circle className="h-7 w-7 text-zinc-600" />
}

export default async function TrackingPage({ params }: Props) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return <TrackingError message="Servicio de seguimiento no configurado." />
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const token = decodeURIComponent(params.token || '').replace(/^ARM-/i, '').toLowerCase()

  const { data: order } = await supabase
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
      pickup_campus_id,
      order_contacts(client_name, client_email),
      order_items(quantity, unit_price, size, products(name, sku))
    `)
    .eq('tracking_token', token)
    .maybeSingle()

  if (!order) {
    return <TrackingError message="No encontramos un pedido con este número de seguimiento." />
  }

  const pickupCampusId = order.pickup_campus_id || order.campus_id
  const [{ data: pickupCampus }, { data: purchaseCampus }, { data: historyRows }] = await Promise.all([
    pickupCampusId ? supabase.from('campus').select('name').eq('id', pickupCampusId).maybeSingle() : Promise.resolve({ data: null }),
    order.campus_id ? supabase.from('campus').select('name').eq('id', order.campus_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase
      .from('order_status_history')
      .select('status, title, message, created_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true }),
  ])

  const contact = Array.isArray(order.order_contacts) ? order.order_contacts[0] : order.order_contacts
  const status = String(order.production_status ?? 'pending_production')
  const displayToken = `ARM-${String(order.tracking_token).slice(0, 8).toUpperCase()}`
  const currentIndex = Math.max(0, STATUS_ORDER.indexOf(status))
  const progress = status === 'delivered' ? 100 : Math.max(20, Math.round(((currentIndex + 1) / STATUS_ORDER.length) * 100))
  const items = order.order_items ?? []

  return (
    <main className="min-h-screen bg-[#0b0c10] px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-950 shadow-2xl">
          <div className="bg-gradient-to-br from-zinc-900 to-black p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-400">ARM Merch</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Seguimiento de pedido</h1>
                <p className="mt-2 text-sm text-zinc-400">Orden #{order.order_number} · {displayToken}</p>
              </div>
              <div className="rounded-2xl bg-amber-500 px-4 py-3 text-center text-black">
                <p className="text-xs font-bold uppercase tracking-wide">Estado actual</p>
                <p className="mt-1 text-sm font-black">{currentLabel(status)}</p>
              </div>
            </div>

            <div className="mt-6 rounded-full bg-zinc-800 p-1">
              <div className="h-3 rounded-full bg-amber-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="grid gap-4 border-t border-zinc-800 p-5 sm:grid-cols-3">
            <InfoCard label="Cliente" value={contact?.client_name ?? 'Cliente'} />
            <InfoCard label="Total" value={fmt(Number(order.total ?? 0))} />
            <InfoCard label="Campus retiro" value={pickupCampus?.name ?? 'Por confirmar'} />
          </div>
        </section>

        <section className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5 sm:p-6">
          <h2 className="mb-5 text-xl font-black">Detalle del pedido</h2>
          <div>
            {STEPS.map((step, index) => {
              const state = getStepState(status, step.key)
              const history = (historyRows ?? []).find((h: any) => h.status === step.key)
              const date = history?.created_at || (step.key === 'ready_pickup' ? order.ready_at : step.key === 'delivered' ? order.delivered_at : null)
              return (
                <div key={step.key} className="relative flex gap-4">
                  {index < STEPS.length - 1 && <div className="absolute left-[13px] top-9 h-full w-px bg-zinc-800" />}
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-950">
                    <StepIcon state={state} icon={step.icon} />
                  </div>
                  <div className="pb-7">
                    <p className={`font-black ${state === 'pending' ? 'text-zinc-500' : 'text-white'}`}>{history?.title ?? step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">{history?.message ?? step.message}</p>
                    {date && <p className="mt-1 text-xs text-zinc-600">{formatDate(date)}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="mb-4 text-lg font-black">Productos</h2>
            <div className="space-y-3">
              {items.map((item: any, idx: number) => {
                const product = Array.isArray(item.products) ? item.products[0] : item.products
                return (
                  <div key={idx} className="rounded-2xl bg-zinc-900 p-4">
                    <p className="font-bold text-white">{product?.name ?? 'Producto'}</p>
                    <p className="mt-1 text-sm text-zinc-500">Cantidad: {item.quantity}{item.size ? ` · Talla: ${item.size}` : ''}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="mb-4 text-lg font-black">Retiro</h2>
            <div className="space-y-3 text-sm leading-6 text-zinc-400">
              <p><span className="text-zinc-500">Campus venta:</span> {purchaseCampus?.name ?? 'Sin campus'}</p>
              <p><span className="text-zinc-500">Campus retiro:</span> {pickupCampus?.name ?? 'Por confirmar'}</p>
              <p>Cuando tu pedido esté listo, recibirás una notificación en tu correo.</p>
            </div>
          </div>
        </section>

        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300">
            <Home size={14} /> ARM Merch
          </Link>
        </div>
      </div>
    </main>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-900 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 font-bold text-white">{value}</p>
    </div>
  )
}

function TrackingError({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0c10] px-4 text-white">
      <div className="max-w-md rounded-[2rem] border border-zinc-800 bg-zinc-950 p-8 text-center">
        <h1 className="text-2xl font-black">Seguimiento no disponible</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">{message}</p>
        <Link href="/" className="mt-6 inline-flex rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-black">
          Volver
        </Link>
      </div>
    </main>
  )
}
