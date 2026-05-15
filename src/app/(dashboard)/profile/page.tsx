'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowRight,
  Award,
  CreditCard,
  Package,
  Receipt,
  ScanLine,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number(n || 0))

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

type PermissionMap = Record<string, boolean>

const QUICK_ACCESS = [
  { icon: ShoppingBag, label: 'Punto de venta', href: '/pos', permission: 'pos.view' },
  { icon: ScanLine, label: 'Escanear inventario', href: '/inventory/scan', permission: 'inventory.scan' },
  { icon: Package, label: 'Pedidos', href: '/production', permission: 'deliveries.view' },
  { icon: Receipt, label: 'Reportes', href: '/reports', permission: 'reports.view' },
]

const SUPER_ADMIN_ACCESS = [
  {
    icon: CreditCard,
    label: 'Lectores SumUp',
    href: '/settings/readers',
    description: 'Conectar SOLO por campus',
  },
]

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [permissions, setPermissions] = useState<PermissionMap>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      setLoading(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return
      }

      const [{ data: p }, { data: o }] = await Promise.all([
        supabase.from('profiles').select('*, campus:campus(name)').eq('id', session.user.id).single(),
        supabase
          .from('orders')
          .select('id, total, status, created_at, order_number, payment_method, notes')
          .eq('seller_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      const role = p?.role ?? 'voluntario'
      let permissionMap: PermissionMap = {}

      if (role === 'super_admin') {
        QUICK_ACCESS.forEach((item) => {
          permissionMap[item.permission] = true
        })
      } else {
        const { data: permissionRows } = await supabase
          .from('module_permissions')
          .select('module, enabled')
          .eq('role', role)

        permissionMap = Object.fromEntries(
          (permissionRows ?? []).map((row: any) => [row.module, row.enabled === true])
        )
      }

      const myOrders = (o ?? []) as any[]
      const paidOrders = myOrders.filter((x: any) => x.status === 'paid')
      const today = new Date().toDateString()
      const todayOrders = paidOrders.filter((x: any) => new Date(x.created_at).toDateString() === today)
      const totalSales = paidOrders.reduce((sum: number, order: any) => sum + Number(order.total ?? 0), 0)

      setProfile(p)
      setOrders(myOrders)
      setPermissions(permissionMap)
      setStats({
        total: totalSales,
        count: paidOrders.length,
        todayTotal: todayOrders.reduce((sum: number, order: any) => sum + Number(order.total ?? 0), 0),
        todayCount: todayOrders.length,
        avg: paidOrders.length > 0 ? totalSales / paidOrders.length : 0,
      })
      setLoading(false)
    }

    load()
  }, [])

  const initials =
    profile?.full_name
      ?.split(' ')
      .map((w: string) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() ?? profile?.email?.[0]?.toUpperCase() ?? '?'

  const visibleQuickAccess = useMemo(() => {
    if (!profile) return []
    if (profile.role === 'super_admin') return QUICK_ACCESS
    return QUICK_ACCESS.filter((item) => permissions[item.permission] === true)
  }, [profile, permissions])

  if (loading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/20">
            <span className="text-2xl font-bold text-amber-400">{initials}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{profile?.full_name ?? profile?.email ?? 'Usuario'}</h1>
            <p className="text-sm text-zinc-500">{profile?.email ?? 'Sin correo'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs text-purple-400">
                {ROLE_LABEL[profile?.role ?? 'voluntario'] ?? profile?.role}
              </span>
              {profile?.campus?.name && (
                <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs text-blue-400">
                  {profile.campus.name}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm text-zinc-500">Plataforma ARM Merch</p>
          <p className="font-semibold text-amber-400">Equipo autorizado</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            { icon: TrendingUp, label: 'Ventas hoy', value: fmt(stats.todayTotal), sub: `${stats.todayCount} órdenes`, color: 'text-amber-400' },
            { icon: ShoppingBag, label: 'Ventas totales', value: fmt(stats.total), sub: `${stats.count} ventas`, color: 'text-green-400' },
            { icon: Award, label: 'Ticket promedio', value: fmt(stats.avg), sub: 'por venta', color: 'text-blue-400' },
            { icon: Receipt, label: 'Órdenes pagadas', value: stats.count.toString(), sub: 'historial', color: 'text-purple-400' },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800"><card.icon size={18} className={card.color} /></div>
              <p className="mt-4 text-sm text-zinc-500">{card.label}</p>
              <h2 className={`mt-1 text-2xl font-bold ${card.color}`}>{card.value}</h2>
              <p className="mt-1 text-xs text-zinc-600">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {profile?.role === 'super_admin' && (
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-500">Configuración avanzada</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {SUPER_ADMIN_ACCESS.map((item) => (
              <Link key={item.label} href={item.href} className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 transition hover:border-amber-500/50">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20"><item.icon size={18} className="text-amber-400" /></div>
                <p className="mt-4 font-medium text-white">{item.label}</p>
                <div className="mt-1 flex items-center gap-2 text-sm text-zinc-400">{item.description}<ArrowRight size={14} /></div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {visibleQuickAccess.map((item) => (
          <Link key={item.label} href={item.href} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-amber-500/30">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10"><item.icon size={18} className="text-amber-400" /></div>
            <p className="mt-4 font-medium text-white">{item.label}</p>
            <div className="mt-1 flex items-center gap-2 text-sm text-zinc-500">Ir al módulo<ArrowRight size={14} /></div>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Mis últimas ventas</h2>
          <span className="text-sm text-zinc-500">{orders.length} registros</span>
        </div>
        {orders.length === 0 ? (
          <div className="py-10 text-center text-zinc-600">Sin ventas registradas</div>
        ) : (
          <div className="space-y-3">
            {orders.slice(0, 10).map((order) => (
              <div key={order.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <div className="w-16 font-mono text-sm text-zinc-500">#{order.order_number}</div>
                <div className="min-w-[160px] flex-1">
                  <p className="text-sm text-white">{order.payment_method ?? 'Venta'}</p>
                  <p className="text-xs text-zinc-500">{fmtDate(order.created_at)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${order.status === 'paid' ? 'bg-green-500/10 text-green-400' : order.status === 'pending' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>{order.status}</span>
                <div className="font-bold text-amber-400">{fmt(Number(order.total))}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
