'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Trophy,
  Package,
} from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n)

interface ProductWithSales {
  id: string
  name: string
  price: number
  sku: string | null
  stock: number
  total_sold: number
  total_revenue: number
}

export default function PricingMarginsPage() {
  const [products, setProducts] = useState<ProductWithSales[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }

      // Cargar productos con stock
      const { data: prods } = await supabase
        .from('products')
        .select('id, name, price, sku')
        .eq('active', true)
        .order('name')

      // Cargar ventas del mes para calcular revenue
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      const { data: items } = await supabase
        .from('order_items')
        .select('product_id, quantity, unit_price, order:orders(status, created_at)')
        .gte('order.created_at', monthStart.toISOString())

      // Cargar stock
      const { data: inventory } = await supabase
        .from('inventory')
        .select('product_id, stock')

      // Agrupar
      const salesMap = new Map<string, { qty: number; revenue: number }>()
      ;(items ?? []).forEach((item: any) => {
        const o = Array.isArray(item.order) ? item.order[0] : item.order
        if (o?.status !== 'paid') return
        const existing = salesMap.get(item.product_id) ?? { qty: 0, revenue: 0 }
        existing.qty += Number(item.quantity ?? 0)
        existing.revenue += Number(item.quantity ?? 0) * Number(item.unit_price ?? 0)
        salesMap.set(item.product_id, existing)
      })

      const stockMap = new Map<string, number>()
      ;(inventory ?? []).forEach((inv: any) => {
        const current = stockMap.get(inv.product_id) ?? 0
        stockMap.set(inv.product_id, current + Number(inv.stock ?? 0))
      })

      const enriched: ProductWithSales[] = (prods ?? []).map((p: any) => {
        const sales = salesMap.get(p.id) ?? { qty: 0, revenue: 0 }
        return {
          id: p.id,
          name: p.name,
          price: Number(p.price),
          sku: p.sku,
          stock: stockMap.get(p.id) ?? 0,
          total_sold: sales.qty,
          total_revenue: sales.revenue,
        }
      })

      setProducts(enriched)
      setLoading(false)
    }

    load()
  }, [])

  const metrics = useMemo(() => {
    const totalRevenue = products.reduce((s, p) => s + p.total_revenue, 0)
    const totalSold = products.reduce((s, p) => s + p.total_sold, 0)
    const avgPrice = totalSold > 0 ? totalRevenue / totalSold : 0
    const topProduct = [...products].sort((a, b) => b.total_revenue - a.total_revenue)[0]
    const lowStock = products.filter(p => p.stock <= 3 && p.stock > 0).length
    const noStock = products.filter(p => p.stock === 0).length

    return { totalRevenue, totalSold, avgPrice, topProduct, lowStock, noStock }
  }, [products])

  const sortedProducts = useMemo(() => {
    return [...products]
      .filter(p => p.total_sold > 0)
      .sort((a, b) => b.total_revenue - a.total_revenue)
  }, [products])

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-[#111111] p-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
          Márgenes
        </div>

        <h1 className="text-4xl font-black text-white">
          Márgenes & rentabilidad
        </h1>

        <p className="mt-2 text-white/50">
          Datos reales del mes actual — rendimiento por producto.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-[#111111] p-6">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
            <TrendingUp />
          </div>
          <p className="text-sm text-white/50">Revenue mes</p>
          <h3 className="mt-2 text-3xl font-black text-white">{fmt(metrics.totalRevenue)}</h3>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#111111] p-6">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-400">
            <DollarSign />
          </div>
          <p className="text-sm text-white/50">Ticket promedio</p>
          <h3 className="mt-2 text-3xl font-black text-white">{fmt(metrics.avgPrice)}</h3>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#111111] p-6">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">
            <Trophy />
          </div>
          <p className="text-sm text-white/50">Producto top</p>
          <h3 className="mt-2 text-lg font-black text-white truncate">
            {metrics.topProduct?.name ?? '—'}
          </h3>
          <p className="text-xs text-white/40">{metrics.topProduct?.total_sold ?? 0} uds vendidas</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#111111] p-6">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
            <AlertTriangle />
          </div>
          <p className="text-sm text-white/50">Stock bajo / agotados</p>
          <h3 className="mt-2 text-3xl font-black text-white">
            {metrics.lowStock + metrics.noStock}
          </h3>
          <p className="text-xs text-white/40">{metrics.noStock} sin stock</p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-[#111111] p-6">
        <div className="mb-4 flex items-center gap-2">
          <Package size={16} className="text-amber-400" />
          <h2 className="font-semibold text-white">Productos con ventas este mes</h2>
          <span className="ml-auto text-xs text-zinc-500">{sortedProducts.length} productos</span>
        </div>

        {sortedProducts.length === 0 ? (
          <p className="text-sm text-zinc-500 py-8 text-center">Sin ventas este mes</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
                  <th className="pb-4">#</th>
                  <th className="pb-4">Producto</th>
                  <th className="pb-4">Precio</th>
                  <th className="pb-4">Vendidos</th>
                  <th className="pb-4">Revenue</th>
                  <th className="pb-4">Stock</th>
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map((item, i) => (
                  <tr key={item.id} className="border-b border-white/5 text-sm text-white">
                    <td className="py-4 text-zinc-500">{i + 1}</td>
                    <td className="py-4">
                      <p className="font-semibold">{item.name}</p>
                      {item.sku && <p className="text-[10px] text-zinc-500">SKU: {item.sku}</p>}
                    </td>
                    <td className="py-4">{fmt(item.price)}</td>
                    <td className="py-4 font-bold text-amber-400">{item.total_sold}</td>
                    <td className="py-4 font-bold text-emerald-400">{fmt(item.total_revenue)}</td>
                    <td className="py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        item.stock === 0
                          ? 'bg-red-500/10 text-red-400'
                          : item.stock <= 5
                            ? 'bg-orange-500/10 text-orange-400'
                            : 'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {item.stock}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
