import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import SendReceipt from '@/components/orders/send-receipt'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-CL')
}

export default async function OrderDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, campus_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const { data: order } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      campus_id,
      payment_method,
      total,
      discount,
      created_at,
      status,
      notes
    `)
    .eq('id', params.id)
    .single()

  if (!order) notFound()

  if (profile.role !== 'super_admin' && profile.campus_id !== order.campus_id) {
    notFound()
  }

  const [{ data: items }, { data: campuses }] = await Promise.all([
    supabase
      .from('order_items')
      .select(`
        id,
        quantity,
        unit_price,
        products (
          name,
          sku
        )
      `)
      .eq('order_id', order.id),

    supabase.from('campus').select('id, name'),
  ])

  const campusMap = new Map((campuses ?? []).map((c: any) => [c.id, c.name]))
  const campusName = order.campus_id
    ? campusMap.get(order.campus_id) ?? 'Sin campus'
    : 'Sin campus'

  const safeItems = (items ?? []).map((item: any) => {
    const product = Array.isArray(item.products)
      ? item.products[0]
      : item.products

    return {
      id: item.id,
      quantity: Number(item.quantity ?? 0),
      unit_price: Number(item.unit_price ?? 0),
      name: product?.name ?? 'Producto',
      sku: product?.sku ?? '—',
      lineTotal:
        Number(item.quantity ?? 0) * Number(item.unit_price ?? 0),
    }
  })

  const subtotal = safeItems.reduce(
    (sum: number, item: any) => sum + item.lineTotal,
    0
  )

  const discount = Number(order.discount ?? 0)
  const total = Number(order.total ?? 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-zinc-500">Detalle de orden</p>
          <h1 className="text-2xl font-bold text-white">
            #{order.order_number}
          </h1>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/orders"
            className="inline-flex items-center justify-center rounded-xl bg-zinc-800 px-4 py-2.5 text-sm text-white hover:bg-zinc-700"
          >
            Volver
          </Link>

          <Link
            href={`/orders/${order.id}/print`}
            target="_blank"
            className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-400"
          >
            Imprimir
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm text-zinc-400">Fecha</p>
          <p className="mt-1 text-white">
            {formatDate(order.created_at)}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm text-zinc-400">Campus</p>
          <p className="mt-1 text-white">{campusName}</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm text-zinc-400">Método de pago</p>
          <p className="mt-1 text-white capitalize">
            {order.payment_method ?? 'Sin definir'}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm text-zinc-400">Estado</p>
          <p className="mt-1 text-white">
            {order.status ?? '—'}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Productos
        </h2>

        <div className="space-y-4">
          {safeItems.length === 0 ? (
            <p className="text-sm text-zinc-500">No hay productos en esta orden.</p>
          ) : (
            safeItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between border-b border-zinc-800 pb-3"
              >
                <div>
                  <p className="font-medium text-white">
                    {item.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    SKU: {item.sku}
                  </p>
                  <p className="text-sm text-zinc-400">
                    {item.quantity} × {formatCurrency(item.unit_price)}
                  </p>
                </div>

                <p className="font-semibold text-white">
                  {formatCurrency(item.lineTotal)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-2">
        <div className="flex justify-between text-zinc-400">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>

        <div className="flex justify-between text-zinc-400">
          <span>Descuento</span>
          <span>{formatCurrency(discount)}</span>
        </div>

        <div className="flex justify-between text-xl font-bold text-white">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      {order.notes && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-2 text-lg font-semibold text-white">
            Nota
          </h2>
          <p className="text-zinc-300">{order.notes}</p>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-3 text-lg font-semibold text-white">
          Acciones
        </h2>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/orders/${order.id}/print`}
            target="_blank"
            className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-400"
          >
            Imprimir ticket
          </Link>
        </div>

        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-white">
            Enviar comprobante por correo
          </h3>
          <SendReceipt orderId={order.id} />
        </div>
      </div>
    </div>
  )
}