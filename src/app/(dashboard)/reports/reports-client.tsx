'use client'

import { useState, useMemo } from 'react'
import { Download, TrendingUp, ShoppingBag, Users, Package, ArrowUpRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Props {
  orders: any[]
  products: any[]
  sellers: any[]
  campusName?: string | null
}

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
    year: 'numeric',
  })

// Obtiene el nombre del cliente desde order_contacts (nueva estructura) o fallback
function getClientName(order: any): string {
  const contact = Array.isArray(order.order_contacts)
    ? order.order_contacts[0]
    : order.order_contacts
  return contact?.client_name ?? '—'
}

// Etiqueta visual para el estado de la orden
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    paid:      { label: 'Pagado',     className: 'bg-green-500/15 text-green-400' },
    pending:   { label: 'Pendiente',  className: 'bg-amber-500/15 text-amber-400' },
    cancelled: { label: 'Cancelado',  className: 'bg-red-500/15 text-red-400' },
    refunded:  { label: 'Reembolsado',className: 'bg-blue-500/15 text-blue-400' },
    pendiente:  { label: 'Pendiente',  className: 'bg-amber-500/15 text-amber-400' },
    cancelada:  { label: 'Cancelada',  className: 'bg-red-500/15 text-red-400' },
  }
  const s = map[status] ?? { label: status, className: 'bg-zinc-700 text-zinc-400' }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.className}`}>
      {s.label}
    </span>
  )
}

export default function ReportsClient({ orders, products, sellers, campusName }: Props) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [sellerId, setSellerId] = useState('')

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const d = new Date(o.created_at)
      if (dateFrom && d < new Date(dateFrom)) return false
      if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false
      if (sellerId && o.seller_id !== sellerId) return false
      return true
    })
  }, [orders, dateFrom, dateTo, sellerId])

  const totalRevenue  = filtered.reduce((s, o) => s + Number(o.total ?? 0), 0)
  const totalDiscount = filtered.reduce((s, o) => s + Number(o.discount ?? 0), 0)
  const totalOrders   = filtered.length
  const avgTicket     = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const uniqueSellers = new Set(filtered.map((o) => o.seller_id)).size

  // Ventas por día
  const dailyMap: Record<string, number> = {}
  filtered.forEach((o) => {
    const d = fmtDate(o.created_at)
    dailyMap[d] = (dailyMap[d] || 0) + Number(o.total ?? 0)
  })
  const dailyData = Object.entries(dailyMap)
    .map(([day, total]) => ({ day, total }))
    .slice(-14)

  // Ventas por voluntario
  const sellerMap: Record<string, { name: string; total: number; count: number }> = {}
  filtered.forEach((o) => {
    const name = o.seller?.full_name ?? 'Sin nombre'
    if (!sellerMap[name]) sellerMap[name] = { name, total: 0, count: 0 }
    sellerMap[name].total += Number(o.total ?? 0)
    sellerMap[name].count += 1
  })
  const sellerData = Object.values(sellerMap).sort((a, b) => b.total - a.total)

  // Productos más vendidos
  const productMap: Record<string, { name: string; qty: number; revenue: number }> = {}
  filtered.forEach((o) => {
    ;(o.order_items ?? []).forEach((item: any) => {
      const name = item.product?.name ?? 'Desconocido'
      if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0 }
      productMap[name].qty     += Number(item.quantity ?? 0)
      productMap[name].revenue += Number(item.quantity ?? 0) * Number(item.unit_price ?? 0)
    })
  })
  const topProducts = Object.values(productMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8)

  // Desglose por método de pago
  const paymentMap: Record<string, number> = {}
  filtered.forEach((o) => {
    const m = o.payment_method ?? 'otro'
    paymentMap[m] = (paymentMap[m] || 0) + Number(o.total ?? 0)
  })

  // Exportar CSV
  function exportCSV() {
    const rows = [
      ['Orden', 'Fecha', 'Cliente', 'Vendedor', 'Método pago', 'Descuento', 'Total', 'Estado'],
      ...filtered.map((o) => [
        `#${o.order_number}`,
        fmtDate(o.created_at),
        getClientName(o),
        o.seller?.full_name ?? '',
        o.payment_method ?? '',
        o.discount ?? 0,
        o.total ?? 0,
        o.status ?? '',
      ]),
    ]
    const csv  = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `arm-merch-reporte-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs shadow-lg">
        <p className="mb-0.5 text-zinc-400">{label}</p>
        <p className="font-bold text-amber-400">{fmt(payload[0].value)}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Reportes</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            {totalOrders} órdenes en el período seleccionado
            {campusName && <span className="ml-1 text-zinc-600">· {campusName}</span>}
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5
                     text-sm font-medium text-zinc-300 transition hover:bg-zinc-700"
        >
          <Download size={14} />
          Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300
                       transition focus:border-amber-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300
                       transition focus:border-amber-500 focus:outline-none"
          />
        </div>
        <select
          value={sellerId}
          onChange={(e) => setSellerId(e.target.value)}
          className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300
                     transition focus:border-amber-500 focus:outline-none"
        >
          <option value="">Todos los voluntarios</option>
          {sellers.map((s) => (
            <option key={s.id} value={s.id}>{s.full_name}</option>
          ))}
        </select>
        {(dateFrom || dateTo || sellerId) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); setSellerId('') }}
            className="text-xs text-zinc-500 transition hover:text-white"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Ingresos totales', value: fmt(totalRevenue),        icon: TrendingUp, color: 'text-amber-400'  },
          { label: 'Total órdenes',    value: totalOrders.toString(),   icon: ShoppingBag,color: 'text-blue-400'   },
          { label: 'Ticket promedio',  value: fmt(avgTicket),           icon: Package,    color: 'text-green-400'  },
          { label: 'Voluntarios',      value: uniqueSellers.toString(), icon: Users,      color: 'text-purple-400' },
        ].map((s) => {
          const Icon = s.icon
          return (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-xl border border-zinc-700/40 bg-zinc-800/50 p-4"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-700/60">
                <Icon size={16} className={s.color} />
              </div>
              <div>
                <p className="text-xs text-zinc-500">{s.label}</p>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Descuentos aplicados (si hay) */}
      {totalDiscount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/8 px-4 py-3">
          <ArrowUpRight size={14} className="text-green-400" />
          <span className="text-sm text-green-400">
            Descuentos totales aplicados en el período:{' '}
            <strong>{fmt(totalDiscount)}</strong>
          </span>
        </div>
      )}

      {/* Gráfico ventas por día */}
      <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 p-4">
        <p className="mb-4 text-sm font-medium text-white">Ventas por día</p>
        {dailyData.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-zinc-600">
            Sin datos en el período
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="day"
                tick={{ fill: '#52525b', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {dailyData.map((_, i) => (
                  <Cell key={i} fill="#f59e0b" fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Productos más vendidos */}
        <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 p-4">
          <p className="mb-3 text-sm font-medium text-white">Productos más vendidos</p>
          {topProducts.length === 0 ? (
            <p className="py-4 text-center text-xs text-zinc-600">Sin datos</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="w-4 text-xs text-zinc-600">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center justify-between">
                      <span className="truncate text-xs text-zinc-300">{p.name}</span>
                      <span className="ml-2 text-xs text-zinc-500">{p.qty} uds.</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-zinc-700">
                      <div
                        className="h-full rounded-full bg-amber-500"
                        style={{ width: `${(p.qty / (topProducts[0]?.qty || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="min-w-[65px] text-right text-xs font-semibold text-amber-400">
                    {fmt(p.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ventas por voluntario */}
        <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 p-4">
          <p className="mb-3 text-sm font-medium text-white">Ventas por voluntario</p>
          {sellerData.length === 0 ? (
            <p className="py-4 text-center text-xs text-zinc-600">Sin datos</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {sellerData.map((s) => (
                <div key={s.name} className="flex items-center gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                    <span className="text-[10px] font-bold text-amber-400">
                      {s.name[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-xs text-zinc-300">{s.name}</span>
                      <span className="text-xs text-zinc-500">{s.count} órdenes</span>
                    </div>
                    <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-zinc-700">
                      <div
                        className="h-full rounded-full bg-purple-500"
                        style={{ width: `${(s.total / (sellerData[0]?.total || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="min-w-[65px] text-right text-xs font-semibold text-purple-400">
                    {fmt(s.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desglose por método de pago */}
      {Object.keys(paymentMap).length > 0 && (
        <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 p-4">
          <p className="mb-3 text-sm font-medium text-white">Por método de pago</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(paymentMap)
              .sort((a, b) => b[1] - a[1])
              .map(([method, amount]) => (
                <div
                  key={method}
                  className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 p-3"
                >
                  <p className="mb-1 text-xs capitalize text-zinc-500">{method}</p>
                  <p className="text-sm font-bold text-white">{fmt(amount)}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-600">
                    {totalRevenue > 0
                      ? `${Math.round((amount / totalRevenue) * 100)}%`
                      : '—'}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Tabla de órdenes */}
      <div className="overflow-hidden rounded-xl border border-zinc-700/40 bg-zinc-800/30">
        <div className="border-b border-zinc-700/40 px-4 py-3">
          <p className="text-sm font-medium text-white">Detalle de órdenes</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700/60">
                {['Orden', 'Fecha', 'Cliente', 'Vendedor', 'Método', 'Desc.', 'Total', 'Estado'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-zinc-500"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-zinc-700/30 transition hover:bg-zinc-700/20"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">
                    #{o.order_number}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-zinc-400">
                    {fmtDate(o.created_at)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-zinc-300">
                    {getClientName(o)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-zinc-300">
                    {o.seller?.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] capitalize text-zinc-400">
                      {o.payment_method}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-green-400">
                    {Number(o.discount ?? 0) > 0 ? `−${fmt(o.discount)}` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-sm font-bold text-amber-400">
                    {fmt(o.total ?? 0)}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-10 text-center text-sm text-zinc-600">
              Sin órdenes en el período seleccionado
            </div>
          )}
          {filtered.length > 50 && (
            <div className="border-t border-zinc-700/40 px-4 py-3 text-center text-xs text-zinc-600">
              Mostrando 50 de {filtered.length} órdenes. Exporta CSV para ver todas.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
