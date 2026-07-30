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
      .select('total, amount_paid, campus_id')
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

    // Total histórico por campus
    const historicByCampus = new Map<string, { name: string; total: number; count: number }>()
    for (const o of (allOrders ?? [])) {
      const name = campusMap.get(o.campus_id) ?? 'Sin campus'
      const existing = historicByCampus.get(o.campus_id) ?? { name, total: 0, count: 0 }
      existing.total += Number(o.amount_paid ?? o.total ?? 0)
      existing.count += 1
      historicByCampus.set(o.campus_id, existing)
    }
    const historicCampusRanking = Array.from(historicByCampus.values()).sort((a, b) => b.total - a.total)

    // Ticket promedio de la semana
    const avgTicketWeek = thisWeekCount > 0 ? thisWeekTotal / thisWeekCount : 0

    // Formatear fechas para el email
    const weekLabel = `${lastMonday.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} — ${new Date(thisMonday.getTime() - 86400000).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}`

    // Construir HTML del email
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte Semanal ARM Merch</title>
</head>
<body style="margin:0;padding:0;background:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#111111;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

        <!-- Header -->
        <tr><td align="center" style="padding-bottom:32px;">
          <h1 style="margin:0;font-size:26px;font-weight:900;color:#f59e0b;">ARM Merch</h1>
          <p style="margin:8px 0 0;font-size:13px;color:#71717a;">Reporte semanal &middot; ${weekLabel}</p>
        </td></tr>

        <!-- Resumen semanal -->
        <tr><td style="padding-bottom:12px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="48%" style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;vertical-align:top;">
                <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#71717a;font-weight:700;">Esta semana</p>
                <p style="margin:10px 0 0;font-size:28px;font-weight:900;color:#ffffff;">${fmt(thisWeekTotal)}</p>
                <p style="margin:4px 0 0;font-size:12px;color:#71717a;">${thisWeekCount} ordenes</p>
                <p style="margin:8px 0 0;font-size:13px;font-weight:700;color:${thisWeekTotal >= prevWeekTotal ? '#34d399' : '#f87171'};">${pct(thisWeekTotal, prevWeekTotal)} vs semana anterior</p>
              </td>
              <td width="4%"></td>
              <td width="48%" style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;vertical-align:top;">
                <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#71717a;font-weight:700;">Semana anterior</p>
                <p style="margin:10px 0 0;font-size:28px;font-weight:900;color:#ffffff;">${fmt(prevWeekTotal)}</p>
                <p style="margin:4px 0 0;font-size:12px;color:#71717a;">${prevWeekCount} ordenes</p>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Ticket promedio -->
        <tr><td style="padding-bottom:12px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#18181b;border:1px solid #27272a;border-radius:12px;">
            <tr><td style="padding:18px 20px;">
              <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#71717a;font-weight:700;">Ticket promedio</p>
              <p style="margin:8px 0 0;font-size:24px;font-weight:900;color:#ffffff;">${fmt(avgTicketWeek)}</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Ventas por campus esta semana -->
        <tr><td style="padding-bottom:12px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#18181b;border:1px solid #27272a;border-radius:12px;">
            <tr><td style="padding:20px;">
              <p style="margin:0 0 14px;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#71717a;font-weight:700;">Ventas por campus esta semana</p>
              ${campusRanking.map(c => `
              <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #27272a;margin-bottom:8px;padding-bottom:8px;">
                <tr>
                  <td style="padding:6px 0;">
                    <p style="margin:0;font-size:14px;font-weight:600;color:#e4e4e7;">${c.name}</p>
                    <p style="margin:2px 0 0;font-size:11px;color:#71717a;">${c.count} ordenes</p>
                  </td>
                  <td align="right" style="padding:6px 0;">
                    <p style="margin:0;font-size:16px;font-weight:800;color:#ffffff;">${fmt(c.total)}</p>
                  </td>
                </tr>
              </table>
              `).join('')}
            </td></tr>
          </table>
        </td></tr>

        <!-- Separador -->
        <tr><td style="padding:20px 0;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #f59e0b33;"></td></tr></table>
          <p style="margin:16px 0 0;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#f59e0b;font-weight:800;">Acumulado historico</p>
        </td></tr>

        <!-- Total historico -->
        <tr><td style="padding-bottom:12px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1400;border:1px solid #f59e0b33;border-radius:12px;">
            <tr><td style="padding:24px 20px;">
              <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#71717a;font-weight:700;">Total desde inicio de operaciones</p>
              <p style="margin:12px 0 0;font-size:34px;font-weight:900;color:#f59e0b;">${fmt(historicTotal)}</p>
              <p style="margin:6px 0 0;font-size:12px;color:#71717a;">${historicCount.toLocaleString('es-CL')} ordenes completadas</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Historico por campus -->
        <tr><td style="padding-bottom:12px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#18181b;border:1px solid #27272a;border-radius:12px;">
            <tr><td style="padding:20px;">
              <p style="margin:0 0 14px;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#71717a;font-weight:700;">Total por campus</p>
              ${historicCampusRanking.map(c => `
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;"><p style="margin:0;font-size:13px;color:#a1a1aa;">${c.name}</p></td>
                  <td align="right" style="padding:6px 0;"><p style="margin:0;font-size:14px;font-weight:800;color:#f59e0b;">${fmt(c.total)}</p></td>
                </tr>
              </table>
              `).join('')}
            </td></tr>
          </table>
        </td></tr>

        <!-- Separador -->
        <tr><td style="padding:20px 0;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #27272a;"></td></tr></table>
        </td></tr>

        <!-- Top productos -->
        <tr><td style="padding-bottom:12px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#18181b;border:1px solid #27272a;border-radius:12px;">
            <tr><td style="padding:20px;">
              <p style="margin:0 0 14px;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#71717a;font-weight:700;">Top 10 productos de la semana</p>
              ${topProducts.map((p, i) => `
              <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #27272a;margin-bottom:6px;padding-bottom:6px;">
                <tr>
                  <td style="padding:8px 0;">
                    <p style="margin:0;font-size:13px;font-weight:600;color:#e4e4e7;">${i + 1}. ${p.name}</p>
                    <p style="margin:2px 0 0;font-size:10px;color:#71717a;">${p.qty} unidades</p>
                  </td>
                  <td align="right" style="padding:8px 0;">
                    <p style="margin:0;font-size:14px;font-weight:800;color:#ffffff;">${fmt(p.revenue)}</p>
                  </td>
                </tr>
              </table>
              `).join('')}
            </td></tr>
          </table>
        </td></tr>

        <!-- Top vendedores -->
        <tr><td style="padding-bottom:12px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#18181b;border:1px solid #27272a;border-radius:12px;">
            <tr><td style="padding:20px;">
              <p style="margin:0 0 14px;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#71717a;font-weight:700;">Top vendedores de la semana</p>
              ${topSellers.map((s, i) => `
              <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #27272a;margin-bottom:6px;padding-bottom:6px;">
                <tr>
                  <td style="padding:8px 0;">
                    <p style="margin:0;font-size:13px;font-weight:600;color:#e4e4e7;">${i + 1}. ${s.name}</p>
                    <p style="margin:2px 0 0;font-size:10px;color:#71717a;">${s.count} ventas</p>
                  </td>
                  <td align="right" style="padding:8px 0;">
                    <p style="margin:0;font-size:14px;font-weight:800;color:#ffffff;">${fmt(s.total)}</p>
                  </td>
                </tr>
              </table>
              `).join('')}
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="padding-top:32px;">
          <p style="margin:0;font-size:11px;color:#52525b;">ARM Merch &middot; Reporte automatico semanal</p>
          <p style="margin:4px 0 0;font-size:10px;color:#3f3f46;">Generado el ${now.toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
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
