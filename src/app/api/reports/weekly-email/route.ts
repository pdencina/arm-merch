import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// Vercel Cron: cada lunes a las 8AM Chile (UTC-4 = 12:00 UTC)
// vercel.json: "0 12 * * 1"

const REPORT_TO = 'pencina@armglobal.org'
const CRON_SECRET = 'arm-merch-cron-2026'

function fmt(n: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n || 0)
}

function pct(current: number, previous: number) {
  if (previous === 0) return current > 0 ? '+100%' : '0%'
  const change = ((current - previous) / previous) * 100
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(1)}%`
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function GET(req: NextRequest) {
  try {
    // Validar secret
    const secret = req.nextUrl.searchParams.get('secret')
    if (secret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const resendApiKey = process.env.RESEND_API_KEY!

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const resend = new Resend(resendApiKey)

    // Calcular rangos de fechas
    const now = new Date()
    const thisMonday = getMonday(now)
    const lastMonday = new Date(thisMonday)
    lastMonday.setDate(lastMonday.getDate() - 7)
    const twoWeeksAgo = new Date(lastMonday)
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 7)

    // Semana pasada: lastMonday → thisMonday
    const weekStart = lastMonday.toISOString()
    const weekEnd = thisMonday.toISOString()
    // Semana anterior: twoWeeksAgo → lastMonday
    const prevWeekStart = twoWeeksAgo.toISOString()
    const prevWeekEnd = lastMonday.toISOString()

    // Cargar órdenes de ambas semanas
    const { data: thisWeekOrders } = await supabase
      .from('orders')
      .select('id, total, amount_paid, campus_id, seller_id, payment_method, created_at')
      .eq('status', 'paid')
      .gte('created_at', weekStart)
      .lt('created_at', weekEnd)

    const { data: prevWeekOrders } = await supabase
      .from('orders')
      .select('id, total, amount_paid, campus_id')
      .eq('status', 'paid')
      .gte('created_at', prevWeekStart)
      .lt('created_at', prevWeekEnd)

    // Total histórico
    const { data: allOrders } = await supabase
      .from('orders')
      .select('total, amount_paid')
      .eq('status', 'paid')

    // Campus
    const { data: campuses } = await supabase
      .from('campus')
      .select('id, name')
      .eq('active', true)

    // Vendedores
    const { data: sellers } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('active', true)

    // Order items para top productos
    const orderIds = (thisWeekOrders ?? []).map(o => o.id)
    let topProducts: { name: string; qty: number; revenue: number }[] = []

    if (orderIds.length > 0) {
      // Cargar en batches de 100
      const allItems: any[] = []
      for (let i = 0; i < orderIds.length; i += 100) {
        const batch = orderIds.slice(i, i + 100)
        const { data: items } = await supabase
          .from('order_items')
          .select('quantity, unit_price, product:products(name)')
          .in('order_id', batch)
        if (items) allItems.push(...items)
      }

      const productMap = new Map<string, { name: string; qty: number; revenue: number }>()
      for (const item of allItems) {
        const product = Array.isArray(item.product) ? item.product[0] : item.product
        const name = product?.name ?? 'Producto'
        const existing = productMap.get(name) ?? { name, qty: 0, revenue: 0 }
        existing.qty += Number(item.quantity ?? 0)
        existing.revenue += Number(item.quantity ?? 0) * Number(item.unit_price ?? 0)
        productMap.set(name, existing)
      }
      topProducts = Array.from(productMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 10)
    }

    // Cálculos
    const campusMap = new Map((campuses ?? []).map(c => [c.id, c.name]))
    const sellerMap = new Map((sellers ?? []).map(s => [s.id, s.full_name]))

    const thisWeekTotal = (thisWeekOrders ?? []).reduce((s, o) => s + Number(o.amount_paid ?? o.total ?? 0), 0)
    const thisWeekCount = (thisWeekOrders ?? []).length
    const prevWeekTotal = (prevWeekOrders ?? []).reduce((s, o) => s + Number(o.amount_paid ?? o.total ?? 0), 0)
    const prevWeekCount = (prevWeekOrders ?? []).length
    const historicTotal = (allOrders ?? []).reduce((s, o) => s + Number(o.amount_paid ?? o.total ?? 0), 0)
    const historicCount = (allOrders ?? []).length

    // Ventas por campus
    const campusSales = new Map<string, { name: string; total: number; count: number }>()
    for (const o of (thisWeekOrders ?? [])) {
      const name = campusMap.get(o.campus_id) ?? 'Sin campus'
      const existing = campusSales.get(o.campus_id) ?? { name, total: 0, count: 0 }
      existing.total += Number(o.amount_paid ?? o.total ?? 0)
      existing.count += 1
      campusSales.set(o.campus_id, existing)
    }

    // Top vendedores
    const sellerSales = new Map<string, { name: string; total: number; count: number }>()
    for (const o of (thisWeekOrders ?? [])) {
      const name = sellerMap.get(o.seller_id) ?? 'Desconocido'
      const existing = sellerSales.get(o.seller_id) ?? { name, total: 0, count: 0 }
      existing.total += Number(o.amount_paid ?? o.total ?? 0)
      existing.count += 1
      sellerSales.set(o.seller_id, existing)
    }

    const topSellers = Array.from(sellerSales.values()).sort((a, b) => b.total - a.total).slice(0, 5)
    const campusRanking = Array.from(campusSales.values()).sort((a, b) => b.total - a.total)

    // Formatear fechas para el email
    const weekLabel = `${lastMonday.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} — ${new Date(thisMonday.getTime() - 86400000).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}`

    // Construir HTML del email
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #f4f4f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
    .header { text-align: center; margin-bottom: 32px; }
    .header h1 { font-size: 28px; font-weight: 900; color: #f59e0b; margin: 0; }
    .header p { color: #71717a; font-size: 14px; margin-top: 8px; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 20px; margin-bottom: 16px; }
    .card h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; color: #71717a; margin: 0 0 12px; }
    .big-number { font-size: 32px; font-weight: 900; color: #ffffff; }
    .sub { font-size: 13px; color: #71717a; margin-top: 4px; }
    .growth { font-size: 14px; font-weight: 700; margin-top: 8px; }
    .growth.up { color: #34d399; }
    .growth.down { color: #f87171; }
    .row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #27272a; }
    .row:last-child { border-bottom: none; }
    .row-label { color: #a1a1aa; font-size: 14px; }
    .row-value { color: #ffffff; font-weight: 700; font-size: 14px; }
    .row-sub { color: #71717a; font-size: 12px; }
    .badge { display: inline-block; background: #f59e0b22; color: #f59e0b; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; }
    .footer { text-align: center; margin-top: 32px; color: #52525b; font-size: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 480px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ARM Merch</h1>
      <p>Reporte semanal · ${weekLabel}</p>
    </div>

    <!-- Resumen principal -->
    <div class="grid">
      <div class="card">
        <h3>Esta semana</h3>
        <div class="big-number">${fmt(thisWeekTotal)}</div>
        <div class="sub">${thisWeekCount} órdenes</div>
        <div class="growth ${thisWeekTotal >= prevWeekTotal ? 'up' : 'down'}">
          ${pct(thisWeekTotal, prevWeekTotal)} vs semana anterior
        </div>
      </div>
      <div class="card">
        <h3>Semana anterior</h3>
        <div class="big-number">${fmt(prevWeekTotal)}</div>
        <div class="sub">${prevWeekCount} órdenes</div>
      </div>
    </div>

    <!-- Total histórico -->
    <div class="card">
      <h3>Total acumulado histórico</h3>
      <div class="big-number" style="color: #f59e0b;">${fmt(historicTotal)}</div>
      <div class="sub">${historicCount.toLocaleString('es-CL')} órdenes desde el inicio</div>
    </div>

    <!-- Ventas por campus -->
    <div class="card">
      <h3>Ventas por campus</h3>
      ${campusRanking.length === 0 ? '<div class="sub">Sin datos</div>' : campusRanking.map((c, i) => `
        <div class="row">
          <div>
            <span class="row-label">${i + 1}. ${c.name}</span>
            <div class="row-sub">${c.count} órdenes</div>
          </div>
          <span class="row-value">${fmt(c.total)}</span>
        </div>
      `).join('')}
    </div>

    <!-- Top productos -->
    <div class="card">
      <h3>Top 10 productos</h3>
      ${topProducts.length === 0 ? '<div class="sub">Sin datos</div>' : topProducts.map((p, i) => `
        <div class="row">
          <div>
            <span class="row-label">${i + 1}. ${p.name}</span>
            <div class="row-sub">${p.qty} unidades</div>
          </div>
          <span class="row-value">${fmt(p.revenue)}</span>
        </div>
      `).join('')}
    </div>

    <!-- Top vendedores -->
    <div class="card">
      <h3>Top vendedores</h3>
      ${topSellers.length === 0 ? '<div class="sub">Sin datos</div>' : topSellers.map((s, i) => `
        <div class="row">
          <div>
            <span class="row-label">${i + 1}. ${s.name}</span>
            <div class="row-sub">${s.count} ventas</div>
          </div>
          <span class="row-value">${fmt(s.total)}</span>
        </div>
      `).join('')}
    </div>

    <div class="footer">
      <p>ARM Merch · Reporte automático semanal</p>
      <p>Generado el ${now.toLocaleString('es-CL')}</p>
    </div>
  </div>
</body>
</html>
    `.trim()

    // Enviar email
    const { error: emailError } = await resend.emails.send({
      from: 'ARM Merch <no-reply@armerch.com>',
      to: REPORT_TO,
      subject: `📊 Reporte semanal ARM Merch · ${weekLabel} · ${fmt(thisWeekTotal)}`,
      html,
    })

    if (emailError) {
      console.error('[Weekly Report] Email error:', emailError)
      return NextResponse.json({ error: emailError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      sent_to: REPORT_TO,
      week: weekLabel,
      total: thisWeekTotal,
      orders: thisWeekCount,
    })
  } catch (error: any) {
    console.error('[Weekly Report] Error:', error)
    return NextResponse.json({ error: error?.message ?? 'Error generando reporte' }, { status: 500 })
  }
}
