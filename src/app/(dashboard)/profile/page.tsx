'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  User,
  TrendingUp,
  ShoppingBag,
  Award,
  ArrowRight,
  ScanLine,
  Package,
  Receipt
} from 'lucide-react'
import Link from 'next/link'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  voluntario: 'Voluntario',
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) return

      const [{ data: p }, { data: o }] = await Promise.all([
        supabase
          .from('profiles')
          .select('*, campus:campus(name)')
          .eq('id', session.user.id)
          .single(),

        supabase
          .from('orders')
          .select(`
            id,
            total,
            status,
            created_at,
            order_number,
            payment_method,
            notes
          `)
          .eq('seller_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      const myOrders = (o ?? []) as any[]

      const paidOrders = myOrders.filter(
        (x: any) => x.status === 'paid'
      )

      const today = new Date().toDateString()

      const todayOrders = paidOrders.filter(
        (x: any) =>
          new Date(x.created_at).toDateString() === today
      )

      setProfile(p)
      setOrders(myOrders)

      setStats({
        total: paidOrders.reduce(
          (s: number, x: any) => s + Number(x.total),
          0
        ),

        count: paidOrders.length,

        todayTotal: todayOrders.reduce(
          (s: number, x: any) => s + Number(x.total),
          0
        ),

        todayCount: todayOrders.length,

        avg:
          paidOrders.length > 0
            ? paidOrders.reduce(
                (s: number, x: any) => s + Number(x.total),
                0
              ) / paidOrders.length
            : 0,
      })
    }

    load()
  }, [])

  const initials =
    profile?.full_name
      ?.split(' ')
      .map((w: string) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() ?? '?'

  return (
    <div className="flex flex-col gap-5 max-w-5xl">

      {/* HEADER */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center justify-between flex-wrap gap-4">

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <span className="text-2xl font-bold text-amber-400">
              {initials}
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-white">
              {profile?.full_name ?? 'Usuario'}
            </h1>

            <p className="text-zinc-500 text-sm">
              {profile?.email}
            </p>

            <div className="flex gap-2 mt-3 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {ROLE_LABEL[profile?.role ?? 'voluntario']}
              </span>

              {profile?.campus?.name && (
                <span className="px-3 py-1 rounded-full text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {profile?.campus?.name}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-right">
          <p className="text-zinc-500 text-sm">
            Plataforma ARM Merch
          </p>

          <p className="text-amber-400 font-semibold">
            Equipo autorizado
          </p>
        </div>
      </div>

      {/* KPIS */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

          {[
            {
              icon: TrendingUp,
              label: 'Ventas hoy',
              value: fmt(stats.todayTotal),
              sub: `${stats.todayCount} órdenes`,
              color: 'text-amber-400',
            },

            {
              icon: ShoppingBag,
              label: 'Ventas totales',
              value: fmt(stats.total),
              sub: `${stats.count} ventas`,
              color: 'text-green-400',
            },

            {
              icon: Award,
              label: 'Ticket promedio',
              value: fmt(stats.avg),
              sub: 'por venta',
              color: 'text-blue-400',
            },

            {
              icon: Receipt,
              label: 'Órdenes pagadas',
              value: stats.count.toString(),
              sub: 'historial',
              color: 'text-purple-400',
            },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                  <card.icon
                    size={18}
                    className={card.color}
                  />
                </div>
              </div>

              <p className="text-zinc-500 text-sm mt-4">
                {card.label}
              </p>

              <h2 className={`text-2xl font-bold mt-1 ${card.color}`}>
                {card.value}
              </h2>

              <p className="text-xs text-zinc-600 mt-1">
                {card.sub}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ACCESOS RÁPIDOS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

        {[
          {
            icon: ShoppingBag,
            label: 'Punto de venta',
            href: '/pos',
          },

          {
            icon: ScanLine,
            label: 'Escanear inventario',
            href: '/inventory/scan',
          },

          {
            icon: Package,
            label: 'Pedidos',
            href: '/delivery-orders',
          },

          {
            icon: Receipt,
            label: 'Reportes',
            href: '/reports',
          },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-amber-500/30 transition"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <item.icon
                size={18}
                className="text-amber-400"
              />
            </div>

            <p className="text-white font-medium mt-4">
              {item.label}
            </p>

            <div className="flex items-center gap-2 text-zinc-500 text-sm mt-1">
              Ir al módulo
              <ArrowRight size={14} />
            </div>
          </Link>
        ))}
      </div>

      {/* ÚLTIMAS VENTAS */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">
            Mis últimas ventas
          </h2>

          <span className="text-zinc-500 text-sm">
            {orders.length} registros
          </span>
        </div>

        {orders.length === 0 ? (
          <div className="py-10 text-center text-zinc-600">
            Sin ventas registradas
          </div>
        ) : (
          <div className="space-y-3">

            {orders.slice(0, 10).map((o) => (
              <div
                key={o.id}
                className="flex items-center gap-4 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3"
              >

                <div className="text-zinc-500 font-mono text-sm w-16">
                  #{o.order_number}
                </div>

                <div className="flex-1">
                  <p className="text-white text-sm">
                    {o.payment_method ?? 'Venta'}
                  </p>

                  <p className="text-zinc-500 text-xs">
                    {fmtDate(o.created_at)}
                  </p>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    o.status === 'paid'
                      ? 'bg-green-500/10 text-green-400'
                      : o.status === 'pending'
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {o.status}
                </span>

                <div className="text-amber-400 font-bold">
                  {fmt(Number(o.total))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}