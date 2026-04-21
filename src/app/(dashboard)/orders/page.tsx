import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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

export default async function OrdersPage() {
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

  let ordersQuery = supabase
    .from('orders')
    .select(`
      id,
      order_number,
      campus_id,
      payment_method,
      total,
      status,
      created_at
    `)
    .order('created_at', { ascending: false })

  if (profile.role !== 'super_admin' && profile.campus_id) {
    ordersQuery = ordersQuery.eq('campus_id', profile.campus_id)
  }

  const [{ data: orders }, { data: campuses }] = await Promise.all([
    ordersQuery,
    supabase.from('campus').select('id, name'),
  ])

  const campusMap = new Map((campuses ?? []).map((c: any) => [c.id, c.name]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Órdenes</h1>
        <p className="mt-2 text-zinc-400">
          {(orders ?? []).length} órdenes encontradas
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-zinc-800 bg-zinc-950/40">
              <tr className="text-left text-sm text-zinc-400">
                <th className="px-6 py-4 font-medium">N° Orden</th>
                <th className="px-6 py-4 font-medium">Campus</th>
                <th className="px-6 py-4 font-medium">Método pago</th>
                <th className="px-6 py-4 font-medium">Total</th>
                <th className="px-6 py-4 font-medium">Estado</th>
                <th className="px-6 py-4 font-medium">Fecha</th>
                <th className="px-6 py-4 font-medium">Acción</th>
              </tr>
            </thead>

            <tbody>
              {(orders ?? []).length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-sm text-zinc-500"
                  >
                    No hay órdenes registradas.
                  </td>
                </tr>
              ) : (
                (orders ?? []).map((order: any) => (
                  <tr
                    key={order.id}
                    className="border-b border-zinc-800/80 text-sm text-white transition hover:bg-zinc-800/30"
                  >
                    <td className="px-6 py-5 font-semibold">
                      #{order.order_number}
                    </td>

                    <td className="px-6 py-5 text-zinc-300">
                      {order.campus_id
                        ? campusMap.get(order.campus_id) ?? 'Sin campus'
                        : 'Sin campus'}
                    </td>

                    <td className="px-6 py-5 capitalize text-zinc-300">
                      {order.payment_method ?? 'Sin definir'}
                    </td>

                    <td className="px-6 py-5 font-semibold text-amber-400">
                      {formatCurrency(Number(order.total ?? 0))}
                    </td>

                    <td className="px-6 py-5">
                      <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-200">
                        {order.status ?? '—'}
                      </span>
                    </td>

                    <td className="px-6 py-5 text-zinc-400">
                      {formatDate(order.created_at)}
                    </td>

                    <td className="px-6 py-5">
                      <Link
                        href={`/orders/${order.id}`}
                        className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}