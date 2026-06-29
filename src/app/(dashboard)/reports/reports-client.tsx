'use client'

import { useMemo, useState } from 'react'
import {
  Download,
  Loader2,
  Package,
  ShoppingBag,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

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
  }).format(Number(n || 0))

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

function getRelationOne(value: any) {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function getSeller(order: any) {
  return getRelationOne(order?.seller)
}

function getProductFromItem(item: any) {
  return getRelationOne(item?.product)
}

function safeNumber(value: any) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function normalizeDateOnly(value: string) {
  return new Date(`${value}T00:00:00`)
}

export default function ReportsClient({
  orders,
  products,
  sellers,
  campusName,
}: Props) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sellerId, setSellerId] = useState('')
  const [exporting, setExporting] = useState(false)

  const paidOrders = useMemo(() => {
    return (orders ?? []).filter((o) =>
      ['paid', 'completed', 'delivered', 'completada', 'entregada'].includes(
        String(o.status ?? '').toLowerCase()
      )
    )
  }, [orders])

  const filtered = useMemo(() => {
    return paidOrders.filter((o) => {
      const d = new Date(o.created_at)

      if (dateFrom && d < normalizeDateOnly(dateFrom)) return false
      if (dateTo && d > new Date(`${dateTo}T23:59:59`)) return false
      if (sellerId && o.seller_id !== sellerId) return false

      return true
    })
  }, [paidOrders, dateFrom, dateTo, sellerId])

  const totalRevenue = filtered.reduce((sum, order) => {
    return sum + safeNumber(order.amount_paid ?? order.total)
  }, 0)

  const totalOrders = filtered.length
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const uniqueSellers = new Set(filtered.map((order) => order.seller_id).filter(Boolean)).size

  const dailyData = useMemo(() => {
    const dailyMap: Record<string, number> = {}

    filtered.forEach((order) => {
      const day = fmtDate(order.created_at)
      dailyMap[day] = (dailyMap[day] || 0) + safeNumber(order.amount_paid ?? order.total)
    })

    return Object.entries(dailyMap)
      .map(([day, total]) => ({ day, total }))
      .slice(-14)
  }, [filtered])

  const sellerData = useMemo(() => {
    const sellerMap: Record<
      string,
      { id: string; name: string; total: number; count: number }
    > = {}

    filtered.forEach((order) => {
      const seller = getSeller(order)
      const id = order.seller_id || 'sin-vendedor'
      const name = seller?.full_name || 'Sin vendedor'

      if (!sellerMap[id]) {
        sellerMap[id] = {
          id,
          name,
          total: 0,
          count: 0,
        }
      }

      sellerMap[id].total += safeNumber(order.amount_paid ?? order.total)
      sellerMap[id].count += 1
    })

    return Object.values(sellerMap).sort((a, b) => b.total - a.total)
  }, [filtered])

  const topProducts = useMemo(() => {
    const productMap: Record<
      string,
      { name: string; qty: number; revenue: number }
    > = {}

    filtered.forEach((order) => {
      ;(order.order_items ?? []).forEach((item: any) => {
        const product = getProductFromItem(item)
        const name = product?.name || 'Producto desconocido'
        const quantity = safeNumber(item.quantity)
        const unitPrice = safeNumber(item.unit_price)

        if (!productMap[name]) {
          productMap[name] = {
            name,
            qty: 0,
            revenue: 0,
          }
        }

        productMap[name].qty += quantity
        productMap[name].revenue += quantity * unitPrice
      })
    })

    return Object.values(productMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8)
  }, [filtered])

  async function exportCSV() {
    setExporting(true)

    const rows = [
      ['Orden', 'Fecha', 'Vendedor', 'Método pago', 'Estado', 'Total'],
      ...filtered.map((order) => {
        const seller = getSeller(order)

        return [
          `#${order.order_number}`,
          fmtDate(order.created_at),
          seller?.full_name ?? '',
          order.payment_method ?? '',
          order.status ?? '',
          safeNumber(order.amount_paid ?? order.total).toString(),
        ]
      }),
    ]

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n')

    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;',
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `arm-merch-reporte-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)

    setExporting(false)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null

    return (
      <div className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs">
        <p className="mb-0.5 text-zinc-400">{label}</p>
        <p className="font-bold text-amber-400">{fmt(payload[0].value)}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Reportes</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            {totalOrders} órdenes pagadas en el período seleccionado
            {campusName ? ` · ${campusName}` : ''}
          </p>
        </div>

        <button
          onClick={exportCSV}
          disabled={exporting || filtered.length === 0}
          className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          {exporting ? 'Exportando...' : 'Exportar CSV'}
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 transition focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 transition focus:border-amber-500 focus:outline-none"
          />
        </div>

        <select
          value={sellerId}
          onChange={(e) => setSellerId(e.target.value)}
          className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 transition focus:border-amber-500 focus:outline-none"
        >
          <option value="">Todos los voluntarios</option>
          {sellers.map((seller) => (
            <option key={seller.id} value={seller.id}>
              {seller.full_name || 'Sin nombre'}
            </option>
          ))}
        </select>

        {(dateFrom || dateTo || sellerId) && (
          <button
            onClick={() => {
              setDateFrom('')
              setDateTo('')
              setSellerId('')
            }}
            className="text-xs text-zinc-500 transition hover:text-white"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Ingresos totales',
            value: fmt(totalRevenue),
            icon: TrendingUp,
            color: 'text-amber-400',
          },
          {
            label: 'Total órdenes',
            value: totalOrders.toString(),
            icon: ShoppingBag,
            color: 'text-blue-400',
          },
          {
            label: 'Ticket promedio',
            value: fmt(avgTicket),
            icon: Package,
            color: 'text-green-400',
          },
          {
            label: 'Voluntarios',
            value: uniqueSellers.toString(),
            icon: Users,
            color: 'text-purple-400',
          },
        ].map((stat) => {
          const Icon = stat.icon

          return (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-xl border border-zinc-700/40 bg-zinc-800/50 p-4"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-700/60">
                <Icon size={16} className={stat.color} />
              </div>

              <div>
                <p className="text-xs text-zinc-500">{stat.label}</p>
                <p className={`text-lg font-bold ${stat.color}`}>
                  {stat.value}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 p-4">
        <p className="mb-4 text-sm font-medium text-white">Ventas por día</p>

        {dailyData.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-zinc-600">
            Sin datos en el período
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={dailyData}
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            >
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
        <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 p-4">
          <p className="mb-3 text-sm font-medium text-white">
            Productos más vendidos
          </p>

          {topProducts.length === 0 ? (
            <p className="py-4 text-center text-xs text-zinc-600">Sin datos</p>
          ) : (
            <div className="flex flex-col gap-2">
              {topProducts.map((product, index) => (
                <div key={product.name} className="flex items-center gap-3">
                  <span className="w-4 text-xs text-zinc-600">
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center justify-between">
                      <span className="truncate text-xs text-zinc-300">
                        {product.name}
                      </span>
                      <span className="ml-2 text-xs text-zinc-500">
                        {product.qty} uds.
                      </span>
                    </div>

                    <div className="h-1 overflow-hidden rounded-full bg-zinc-700">
                      <div
                        className="h-full rounded-full bg-amber-500"
                        style={{
                          width: `${(product.qty / (topProducts[0]?.qty || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <span className="min-w-[65px] text-right text-xs font-semibold text-amber-400">
                    {fmt(product.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 p-4">
          <p className="mb-3 text-sm font-medium text-white">
            Ventas por voluntario
          </p>

          {sellerData.length === 0 ? (
            <p className="py-4 text-center text-xs text-zinc-600">Sin datos</p>
          ) : (
            <div className="flex flex-col gap-2">
              {sellerData.map((seller) => (
                <div key={seller.id} className="flex items-center gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                    <span className="text-[10px] font-bold text-amber-400">
                      {seller.name?.[0] ?? 'S'}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-xs text-zinc-300">
                        {seller.name}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {seller.count} órdenes
                      </span>
                    </div>

                    <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-zinc-700">
                      <div
                        className="h-full rounded-full bg-purple-500"
                        style={{
                          width: `${(seller.total / (sellerData[0]?.total || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <span className="min-w-[65px] text-right text-xs font-semibold text-purple-400">
                    {fmt(seller.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-700/40 bg-zinc-800/30">
        <div className="border-b border-zinc-700/40 px-4 py-3">
          <p className="text-sm font-medium text-white">Detalle de órdenes</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700/60">
                {['Orden', 'Fecha', 'Vendedor', 'Método', 'Estado', 'Total'].map(
                  (header) => (
                    <th
                      key={header}
                      className="px-4 py-3 text-left text-xs font-medium text-zinc-500"
                    >
                      {header}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {filtered.slice(0, 50).map((order) => {
                const seller = getSeller(order)

                return (
                  <tr
                    key={order.id}
                    className="border-b border-zinc-700/30 transition hover:bg-zinc-700/20"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">
                      #{order.order_number}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-400">
                      {fmtDate(order.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-300">
                      {seller?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] capitalize text-zinc-400">
                        {order.payment_method ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] capitalize text-green-300">
                        {order.status ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm font-bold text-amber-400">
                      {fmt(order.amount_paid ?? order.total)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-10 text-center text-sm text-zinc-600">
              Sin órdenes en el período seleccionado
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
