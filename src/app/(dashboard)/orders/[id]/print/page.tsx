'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type OrderRow = {
  id: string
  order_number: number | string
  campus_id: string | null
  payment_method: string | null
  total: number
  discount?: number | null
  created_at: string
  status?: string | null
  notes?: string | null
}

type CampusRow = {
  id: string
  name: string
}

type ItemRow = {
  id: string
  quantity: number
  unit_price: number
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

type ContactRow = {
  client_name?: string | null
  client_email?: string | null
}

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

export default function OrderPrintPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()

  const orderId = String(params?.id ?? '')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [order, setOrder] = useState<OrderRow | null>(null)
  const [profile, setProfile] = useState<{ role: string; campus_id: string | null } | null>(null)
  const [campuses, setCampuses] = useState<CampusRow[]>([])
  const [items, setItems] = useState<ItemRow[]>([])
  const [contact, setContact] = useState<ContactRow | null>(null)

  useEffect(() => {
    async function load() {
      if (!orderId) {
        setError('ID de orden inválido')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        router.push('/login')
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role, campus_id')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profileData) {
        router.push('/login')
        return
      }

      const [
        { data: orderData, error: orderError },
        { data: itemsData, error: itemsError },
        { data: campusData, error: campusError },
        { data: contactData, error: contactError },
      ] = await Promise.all([
        supabase
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
          .eq('id', orderId)
          .single(),

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
          .eq('order_id', orderId),

        supabase.from('campus').select('id, name'),

        supabase
          .from('order_contacts')
          .select(`
            client_name,
            client_email
          `)
          .eq('order_id', orderId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      if (orderError || !orderData) {
        setError('No se pudo cargar la orden')
        setLoading(false)
        return
      }

      if (itemsError) {
        setError(itemsError.message)
        setLoading(false)
        return
      }

      if (campusError) {
        setError(campusError.message)
        setLoading(false)
        return
      }

      if (contactError) {
        setError(contactError.message)
        setLoading(false)
        return
      }

      if (
        profileData.role !== 'super_admin' &&
        profileData.campus_id !== orderData.campus_id
      ) {
        setError('No tienes acceso a esta orden')
        setLoading(false)
        return
      }

      setProfile(profileData)
      setOrder(orderData as OrderRow)
      setItems((itemsData ?? []) as ItemRow[])
      setCampuses((campusData ?? []) as CampusRow[])
      setContact((contactData ?? null) as ContactRow | null)
      setLoading(false)

      setTimeout(() => {
        window.print()
      }, 400)
    }

    load()
  }, [orderId, router, supabase])

  const campusMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const campus of campuses) {
      map.set(campus.id, campus.name)
    }
    return map
  }, [campuses])

  const campusName = useMemo(() => {
    if (!order?.campus_id) return 'Sin campus'
    return campusMap.get(order.campus_id) ?? 'Sin campus'
  }, [campusMap, order])

  const safeItems = useMemo(() => {
    return items.map((item) => {
      const product = Array.isArray(item.products)
        ? item.products[0]
        : item.products

      return {
        id: item.id,
        quantity: Number(item.quantity ?? 0),
        unit_price: Number(item.unit_price ?? 0),
        name: product?.name ?? 'Producto',
        sku: product?.sku ?? '—',
        lineTotal: Number(item.quantity ?? 0) * Number(item.unit_price ?? 0),
      }
    })
  }, [items])

  const subtotal = useMemo(() => {
    return safeItems.reduce((sum, item) => sum + item.lineTotal, 0)
  }, [safeItems])

  const discount = Number(order?.discount ?? 0)
  const total = Number(order?.total ?? 0)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-black">
        <p>Cargando voucher...</p>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-white p-8 text-black">
        <h1 className="text-xl font-bold">No se pudo imprimir la orden</h1>
        <p className="mt-2">{error ?? 'Orden no encontrada'}</p>
        <button
          type="button"
          onClick={() => router.push('/orders')}
          className="mt-6 rounded-lg border px-4 py-2"
        >
          Volver a órdenes
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-black print:bg-white">
      <div className="mx-auto max-w-[360px] p-6 print:p-2">
        <div className="text-center">
          <h1 className="text-2xl font-bold">ARM MERCH</h1>
          <p className="mt-1 text-xs">Comprobante de compra</p>
        </div>

        <div className="my-4 border-t border-dashed border-black" />

        <div className="space-y-1 text-sm">
          <p>
            <span className="font-semibold">Orden:</span> #{order.order_number}
          </p>
          <p>
            <span className="font-semibold">Fecha:</span> {formatDate(order.created_at)}
          </p>
          <p>
            <span className="font-semibold">Campus:</span> {campusName}
          </p>
          <p>
            <span className="font-semibold">Pago:</span> {order.payment_method ?? 'Sin definir'}
          </p>
          <p>
            <span className="font-semibold">Estado:</span> {order.status ?? '—'}
          </p>
        </div>

        {(contact?.client_name || contact?.client_email) && (
          <>
            <div className="my-4 border-t border-dashed border-black" />
            <div className="space-y-1 text-sm">
              {contact?.client_name && (
                <p>
                  <span className="font-semibold">Cliente:</span> {contact.client_name}
                </p>
              )}
              {contact?.client_email && (
                <p>
                  <span className="font-semibold">Email:</span> {contact.client_email}
                </p>
              )}
            </div>
          </>
        )}

        <div className="my-4 border-t border-dashed border-black" />

        <div className="space-y-3 text-sm">
          {safeItems.map((item) => (
            <div key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-xs">{item.sku}</p>
                  <p className="text-xs">
                    {item.quantity} × {formatCurrency(item.unit_price)}
                  </p>
                </div>
                <div className="shrink-0 font-semibold">
                  {formatCurrency(item.lineTotal)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="my-4 border-t border-dashed border-black" />

        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>

          <div className="flex justify-between">
            <span>Descuento</span>
            <span>{formatCurrency(discount)}</span>
          </div>

          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        {order.notes && (
          <>
            <div className="my-4 border-t border-dashed border-black" />
            <div className="text-sm">
              <p className="font-semibold">Nota</p>
              <p>{order.notes}</p>
            </div>
          </>
        )}

        <div className="my-4 border-t border-dashed border-black" />

        <div className="text-center text-xs">
          <p>Gracias por tu compra 🙌</p>
        </div>

        <div className="mt-8 flex items-center justify-center gap-3 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-black px-4 py-2 text-white"
          >
            Imprimir
          </button>

          <button
            type="button"
            onClick={() => router.push(`/orders/${order.id}`)}
            className="rounded-lg border border-black px-4 py-2"
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  )
}