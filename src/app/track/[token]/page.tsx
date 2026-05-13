import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { CheckCircle2, Circle, Clock, PackageCheck, Shirt, Truck, Home } from 'lucide-react'

type Props = {
  params: { token: string }
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n || 0)

function formatDate(value?: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusLabel(status?: string | null) {
  const map: Record<string, string> = {
    not_required: 'Compra confirmada',
    pending_production: 'En preparación',
    in_production: 'En producción',
    ready_pickup: 'Listo para retiro',
    delivered: 'Entregado',
  }
  return map[String(status ?? '')] ?? 'Seguimiento'
}

function stepState(current: string | null | undefined, step: string) {
  const order = ['pending_production', 'in_production', 'ready_pickup', 'delivered']
  const currentIndex = order.indexOf(String(current ?? 'pending_production'))
  const stepIndex = order.indexOf(step)
  if (currentIndex < 0) return stepIndex === 0 ? 'active' : 'pending'
  if (stepIndex < currentIndex) return 'done'
  if (stepIndex === currentIndex) return 'active'
  return 'pending'
}

function StepIcon({ state, icon: Icon }: { state: string; icon: any }) {
  if (state === 'done') {
    return <CheckCircle2 className="h-6 w-6 text-green-500" />
  }
  if (state === 'active') {
    return <Icon className="h-6 w-6 text-amber-500" />
  }
  return <Circle className="h-6 w-6 text-zinc-500" />
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

  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, total, status, production_status, created_at, campus_id, pickup_campus_id, ready_at, delivered_at')
    .eq('tracking_token', params.token)
    .maybeSingle()

  if (!order) {
    return <TrackingError message="No encontramos este pedido. Revisa el enlace de seguimiento." />
  }

  const [{ data: contact }, { data: campusRows }, { data: historyRows }, { data: itemRows }] = await Promise.all([
    supabase
      .from('order_contacts')
      .select('client_name, client_email, client_phone')
      .eq('order_id', order.id)
      .maybeSingle(),
    supabase
      .from('campus')
      .select('id, name')
      .in('id', [order.campus_id, order.pickup_campus_id].filter(Boolean) as string[]),
    supabase
      .from('order_status_history')
      .select('status, title, message, created_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('order_items')
      .select('quantity, unit_price, size, products(name, sku)')
      .eq('order_id', order.id),
  ])

  const campusMap = new Map((campusRows ?? []).map((c: any) => [c.id, c.name]))
  const purchaseCampus = order.campus_id ? campusMap.get(order.campus_id) : null
  const pickupCampus = order.pickup_campus_id
    ? campusMap.get(order.pickup_campus_id)
    : purchaseCampus

  const productionStatus = String(order.production_status ?? 'not_required')
  const steps = [
    {
      key: 'pending_production',
      title: 'En preparación',
      message: 'Recibimos tu compra y el equipo ARM Merch está preparando el pedido.',
      icon: Clock,
    },
    {
      key: 'in_production',
      title: 'En producción',
      message: 'Tu producto está siendo preparado por nuestro equipo.',
      icon: Shirt,
    },
    {
      key: 'ready_pickup',
      title: 'Listo para retiro',
      message: `Tu pedido está listo para retirar${pickupCampus ? ` en ${pickupCampus}` : ''}.`,
      icon: PackageCheck,
    },
    {
      key: 'delivered',
      title: 'Entregado',
      message: 'El pedido fue entregado correctamente.',
      icon: Truck,
    },
  ]

  return (
    <main className="min-h-screen bg-[#0e0f14] px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500">Seguimiento ARM Merch</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">Pedido #{order.order_number}</h1>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 rounded-2xl border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
            <Home size={16} /> Inicio
          </Link>
        </div>

        <section className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-zinc-500">Estado actual</p>
              <p className="mt-1 text-2xl font-bold text-amber-400">{statusLabel(productionStatus)}</p>
              <p className="mt-2 text-sm text-zinc-400">
                {contact?.client_name ? `Hola ${contact.client_name}, ` : ''}aquí puedes revisar el avance de tu pedido.
              </p>
            </div>
            <div className="rounded-2xl bg-zinc-900 px-5 py-4 text-right">
              <p className="text-xs uppercase tracking-widest text-zinc-500">Total</p>
              <p className="mt-1 text-xl font-black text-white">{fmt(Number(order.total ?? 0))}</p>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="mb-5 text-lg font-bold">Detalle del pedido</h2>
          <div className="space-y-5">
            {steps.map((step, index) => {
              const state = stepState(productionStatus, step.key)
              const history = (historyRows ?? []).find((h: any) => h.status === step.key)
              return (
                <div key={step.key} className="relative flex gap-4">
                  {index < steps.length - 1 && (
                    <div className="absolute left-3 top-8 h-full w-px bg-zinc-800" />
                  )}
                  <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-950">
                    <StepIcon state={state} icon={step.icon} />
                  </div>
                  <div className="pb-6">
                    <p className={`font-bold ${state === 'pending' ? 'text-zinc-500' : 'text-white'}`}>{step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">{history?.message ?? step.message}</p>
                    {(history?.created_at || (step.key === 'ready_pickup' && order.ready_at) || (step.key === 'delivered' && order.delivered_at)) && (
                      <p className="mt-1 text-xs text-zinc-600">
                        {formatDate(history?.created_at ?? (step.key === 'ready_pickup' ? order.ready_at : order.delivered_at))}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="mb-3 text-lg font-bold">Productos</h2>
            <div className="space-y-3">
              {(itemRows ?? []).map((item: any, idx: number) => {
                const product = Array.isArray(item.products) ? item.products[0] : item.products
                return (
                  <div key={idx} className="rounded-2xl bg-zinc-900 p-3">
                    <p className="font-semibold text-white">{product?.name ?? 'Producto'}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Cantidad: {item.quantity}{item.size ? ` · Talla: ${item.size}` : ''}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="mb-3 text-lg font-bold">Retiro</h2>
            <div className="space-y-3 text-sm text-zinc-400">
              <p><span className="text-zinc-500">Campus venta:</span> {purchaseCampus ?? 'Sin campus'}</p>
              <p><span className="text-zinc-500">Campus retiro:</span> {pickupCampus ?? 'Por confirmar'}</p>
              <p className="leading-6">Cuando tu pedido esté listo, recibirás una notificación para retirarlo en el campus indicado.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function TrackingError({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0e0f14] px-4 text-white">
      <div className="max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 p-8 text-center">
        <p className="text-5xl">📦</p>
        <h1 className="mt-4 text-2xl font-bold">Seguimiento no disponible</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">{message}</p>
      </div>
    </main>
  )
}
