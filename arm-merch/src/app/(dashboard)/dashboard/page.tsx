import { createClient } from '@/lib/supabase/server'
import DashboardClient from './dashboard-client'

export default async function DashboardPage() {
  const supabase = createClient()
  const today = new Date()
  const startOfDay   = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

  const [
    { data: todayOrdersRaw },
    { data: monthOrdersRaw },
    { data: lowStock },
    { data: topProducts },
    { data: recentOrders },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('total, status, created_at')
      .gte('created_at', startOfDay)
      .eq('status', 'completada'),
    supabase
      .from('orders')
      .select('total, created_at')
      .gte('created_at', startOfMonth)
      .eq('status', 'completada'),
    supabase
      .from('products_with_stock')
      .select('id, name, stock, low_stock_alert')
      .lte('stock', 5)
      .gt('stock', 0)
      .order('stock', { ascending: true })
      .limit(5),
    supabase
      .from('order_items')
      .select('quantity, unit_price, product:products(name)')
      .order('quantity', { ascending: false })
      .limit(5),
    supabase
      .from('orders')
      .select('id, order_number, total, status, payment_method, created_at, seller:profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  // Cast explícito para evitar tipo 'never' del inferidor de Supabase
  type OrderRow = { total: number; created_at: string }
  const todayOrders  = (todayOrdersRaw  ?? []) as OrderRow[]
  const monthOrders  = (monthOrdersRaw  ?? []) as OrderRow[]

  const todayTotal = todayOrders.reduce((s, o) => s + Number(o.total), 0)
  const todayCount = todayOrders.length
  const monthTotal = monthOrders.reduce((s, o) => s + Number(o.total), 0)

  // Ventas por hora para gráfico del día
  const hourlyMap: Record<number, number> = {}
  for (let h = 8; h <= 20; h++) hourlyMap[h] = 0
  todayOrders.forEach(o => {
    const h = new Date(o.created_at).getHours()
    if (h in hourlyMap) hourlyMap[h] = (hourlyMap[h] || 0) + Number(o.total)
  })
  const hourlyData = Object.entries(hourlyMap).map(([hour, total]) => ({
    hour: `${hour}:00`,
    total,
  }))

  // Ventas por día del mes
  const dailyMap: Record<string, number> = {}
  monthOrders.forEach(o => {
    const d = new Date(o.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
    dailyMap[d] = (dailyMap[d] || 0) + Number(o.total)
  })
  const dailyData = Object.entries(dailyMap).map(([day, total]) => ({ day, total }))

  return (
    <DashboardClient
      todayTotal={todayTotal}
      todayCount={todayCount}
      monthTotal={monthTotal}
      lowStock={lowStock ?? []}
      topProducts={topProducts ?? []}
      recentOrders={recentOrders ?? []}
      hourlyData={hourlyData}
      dailyData={dailyData}
    />
  )
}
