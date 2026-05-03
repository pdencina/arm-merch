'use client'

import { useState, useMemo } from 'react'
import { Download, Loader2, TrendingUp, ShoppingBag, Users, Package } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Props {
  orders: any[]
  products: any[]
  sellers: any[]
  campusName?: string | null
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })

export default function ReportsClient({ orders, products, sellers, campusName }: Props) {
  const [dateFrom,  setDateFrom]  = useState('')
  const [dateTo,    setDateTo]    = useState('')
  const [sellerId,  setSellerId]  = useState('')
  const [exporting, setExporting] = useState(false)

  const filtered = useMemo(() => {
    return orders.filter(o => {
      const d = new Date(o.created_at)
      if (dateFrom && d < new Date(dateFrom)) return false
      if (dateTo   && d > new Date(dateTo + 'T23:59:59')) return false
      if (sellerId && o.seller_id !== sellerId) return false
      return true
    })
  }, [orders, dateFrom, dateTo, sellerId])

  const totalRevenue  = filtered.reduce((s, o) => s + Number(o.total), 0)
  const totalOrders   = filtered.length
  const avgTicket     = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const uniqueSellers = new Set(filtered.map(o => o.seller_id)).size

  const dailyMap: Record<string, number> = {}
  filtered.forEach(o => {
    const d = fmtDate(o.created_at)
    dailyMap[d] = (dailyMap[d] || 0) + Number(o.total)
  })
  const dailyData = Object.entries(dailyMap).map(([day, total]) => ({ day, total })).slice(-14)

  const sellerMap: Record<string, { name: string; total: number; count: number }> = {}
  filtered.forEach(o => {
    const name = o.seller?.full_name ?? 'Sin nombre'
    if (!sellerMap[name]) sellerMap[name] = { name, total: 0, count: 0 }
    sellerMap[name].total += Number(o.total)
    sellerMap[name].count += 1
  })
  const sellerData = Object.values(sellerMap).sort((a, b) => b.total - a.total)

  const productMap: Record<string, { name: string; qty: number; revenue: number }> = {}
  filtered.forEach(o => {
    ;(o.order_items ?? []).forEach((item: any) => {
      const name = item.product?.name ?? 'Desconocido'
      if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0 }
      productMap[name].qty     += item.quantity
      productMap[name].revenue += item.quantity * Number(item.unit_price)
    })
  })
  const topProducts = Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 8)

  async function exportCSV() {
    setExporting(true)
    const rows = [
      ['Orden', 'Fecha', 'Vendedor', 'Método pago', 'Total'],
      ...filtered.map(o => [
        `#${o.order_number}`,
        fmtDate(o.created_at),
        o.seller?.full_name ?? '',
        o.payment_method,
        o.total,
      ]),
    ]
    const csv  = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `arm-merch-reporte-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs">
        <p className="text-zinc-400 mb-0.5">{label}</p>
        <p className="text-amber-400 font-bold">{fmt(payload[0].value)}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header + Exportar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Reportes</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{totalOrders} órdenes en el período seleccionado</p>
        </div>
        <button
          onClick={exportCSV}
          disabled={exporting}
          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700
                     text-zinc-300 font-medium rounded-xl px-4 py-2.5 text-sm transition disabled:opacity-50"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {exporting ? 'Exportando...' : 'Exportar CSV'}
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">Desde</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">Hasta</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition" />
        </div>
        <select value={sellerId} onChange={e => setSellerId(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition">
          <option value="">Todos los voluntarios</option>
          {sellers.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
        {(dateFrom || dateTo || sellerId) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setSellerId('') }}
            className="text-xs text-zinc-500 hover:text-white transition">
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Ingresos totales', value: fmt(totalRevenue),       icon: TrendingUp, color: 'text-amber-400'  },
          { label: 'Total órdenes',    value: totalOrders.toString(),   icon: ShoppingBag,color: 'text-blue-400'   },
          { label: 'Ticket promedio',  value: fmt(avgTicket),           icon: Package,    color: 'text-green-400'  },
          { label: 'Voluntarios',      value: uniqueSellers.toString(), icon: Users,      color: 'text-purple-400' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-zinc-800/50 border border-zinc-700/40 rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-700/60 flex items-center justify-center shrink-0">
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

      {/* Gráfico */}
      <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-4">
        <p className="text-sm font-medium text-white mb-4">Ventas por día</p>
        {dailyData.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-zinc-600 text-sm">Sin datos en el período</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <XAxis dataKey="day" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {dailyData.map((_, i) => <Cell key={i} fill="#f59e0b" fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top productos */}
        <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-4">
          <p className="text-sm font-medium text-white mb-3">Productos más vendidos</p>
          {topProducts.length === 0 ? <p className="text-zinc-600 text-xs py-4 text-center">Sin datos</p> : (
            <div className="flex flex-col gap-2">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-600 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-zinc-300 truncate">{p.name}</span>
                      <span className="text-xs text-zinc-500 ml-2">{p.qty} uds.</span>
                    </div>
                    <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${(p.qty / (topProducts[0]?.qty || 1)) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-amber-400 min-w-[65px] text-right">{fmt(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ventas por voluntario */}
        <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl p-4">
          <p className="text-sm font-medium text-white mb-3">Ventas por voluntario</p>
          {sellerData.length === 0 ? <p className="text-zinc-600 text-xs py-4 text-center">Sin datos</p> : (
            <div className="flex flex-col gap-2">
              {sellerData.map(s => (
                <div key={s.name} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-amber-400">{s.name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-300 truncate">{s.name}</span>
                      <span className="text-xs text-zinc-500">{s.count} órdenes</span>
                    </div>
                    <div className="h-1 bg-zinc-700 rounded-full overflow-hidden mt-0.5">
                      <div className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${(s.total / (sellerData[0]?.total || 1)) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-purple-400 min-w-[65px] text-right">{fmt(s.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabla órdenes */}
      <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-700/40">
          <p className="text-sm font-medium text-white">Detalle de órdenes</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700/60">
                {['Orden', 'Fecha', 'Vendedor', 'Método', 'Total'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map(o => (
                <tr key={o.id} className="border-b border-zinc-700/30 hover:bg-zinc-700/20 transition">
                  <td className="px-4 py-2.5 text-xs text-zinc-500 font-mono">#{o.order_number}</td>
                  <td className="px-4 py-2.5 text-xs text-zinc-400">{fmtDate(o.created_at)}</td>
                  <td className="px-4 py-2.5 text-xs text-zinc-300">{o.seller?.full_name ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-[10px] bg-zinc-700 text-zinc-400 px-2 py-0.5 rounded-full capitalize">
                      {o.payment_method}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm font-bold text-amber-400">{fmt(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-10 text-center text-zinc-600 text-sm">Sin órdenes en el período seleccionado</div>
          )}
        </div>
      </div>
    </div>
  )
}
