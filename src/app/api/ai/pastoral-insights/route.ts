import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Severity = "success" | "warning" | "danger" | "info";

function money(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value || 0);
}

async function getAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { errorResponse: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anon) {
    return { errorResponse: NextResponse.json({ error: "Faltan variables de Supabase" }, { status: 500 }) };
  }

  const userClient = createClient(url, anon);
  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error || !user) {
    return { errorResponse: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }

  return {
    user,
    supabase: createClient(url, service || anon, { auth: { persistSession: false } }),
  };
}

function daysAgoISO(days: number) {
  const now = new Date();
  now.setDate(now.getDate() - days);
  return now.toISOString();
}

function startOfMonthISO() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function orderTotal(order: any) {
  return Number(order?.total || order?.total_amount || order?.amount || 0);
}

function itemQty(item: any) {
  return Number(item?.quantity || item?.qty || 1);
}

function productName(item: any) {
  return item?.inventory?.name || item?.product_name || item?.name || "Producto sin nombre";
}

function campusName(order: any) {
  return order?.campus?.name || order?.campus_name || order?.campus || "Sin campus";
}

function paymentMethod(order: any) {
  return String(order?.payment_method || "sin método");
}

function stockValue(product: any) {
  return Number(product?.stock || product?.quantity || product?.available_stock || product?.current_stock || 0);
}

async function aiExecutiveSummary(summary: any) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const model = process.env.OPENAI_MODEL || "gpt-5-mini";
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        instructions: "Eres asesor ejecutivo para un pastor principal. Resume ARM Merch en tono pastoral-ejecutivo, claro, breve, estratégico y en español chileno. No inventes datos.",
        input: `Datos ARM Merch:\\n${JSON.stringify(summary, null, 2)}\\n\\nDevuelve un resumen ejecutivo de máximo 700 caracteres con una recomendación concreta.`,
        temperature: 0.35,
        max_output_tokens: 260,
      }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) return null;

    return String(data?.output_text || data?.output?.[0]?.content?.[0]?.text || "").trim().slice(0, 900);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    const supabase = auth.supabase!;
    const monthISO = startOfMonthISO();
    const last30ISO = daysAgoISO(30);

    const [monthOrdersRes, last30OrdersRes, itemsRes, productsRes, pendingRes] = await Promise.all([
      supabase.from("orders").select("*, campus(name)").gte("created_at", monthISO).order("created_at", { ascending: false }).limit(2000),
      supabase.from("orders").select("*, campus(name)").gte("created_at", last30ISO).order("created_at", { ascending: false }).limit(3000),
      supabase.from("order_items").select("*, inventory(name, sku)").gte("created_at", last30ISO).limit(3000),
      supabase.from("inventory").select("*").limit(1500),
      supabase.from("orders").select("*").in("delivery_status", ["pending", "in_production", "ready"]).limit(1000),
    ]);

    const monthOrders = monthOrdersRes.data || [];
    const last30Orders = last30OrdersRes.data || [];
    const items = itemsRes.data || [];
    const inventory = productsRes.data || [];
    const pendingOrders = pendingRes.data || [];

    const monthSales = monthOrders.reduce((sum, o) => sum + orderTotal(o), 0);
    const last30Sales = last30Orders.reduce((sum, o) => sum + orderTotal(o), 0);

    const campusMap = new Map<string, { total: number; orders: number }>();
    for (const o of last30Orders) {
      const key = campusName(o);
      const current = campusMap.get(key) || { total: 0, orders: 0 };
      current.total += orderTotal(o);
      current.orders += 1;
      campusMap.set(key, current);
    }

    const paymentMap = new Map<string, { total: number; orders: number }>();
    for (const o of last30Orders) {
      const key = paymentMethod(o);
      const current = paymentMap.get(key) || { total: 0, orders: 0 };
      current.total += orderTotal(o);
      current.orders += 1;
      paymentMap.set(key, current);
    }

    const productMap = new Map<string, { quantity: number }>();
    for (const item of items) {
      const key = productName(item);
      const current = productMap.get(key) || { quantity: 0 };
      current.quantity += itemQty(item);
      productMap.set(key, current);
    }

    const campus_breakdown = Array.from(campusMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total).slice(0, 8);
    const payment_breakdown = Array.from(paymentMap.entries()).map(([method, v]) => ({ method, ...v })).sort((a, b) => b.total - a.total).slice(0, 8);
    const top_products = Array.from(productMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.quantity - a.quantity).slice(0, 8);
    const critical_stock = inventory.map((p: any) => ({
      id: p.id,
      name: p.name || p.title || "Producto",
      sku: p.sku || p.code || null,
      stock: stockValue(p),
    })).filter((p) => p.stock <= 3).sort((a, b) => a.stock - b.stock).slice(0, 10);

    const summary = {
      month_sales: monthSales,
      month_orders: monthOrders.length,
      last_30_days_sales: last30Sales,
      last_30_days_orders: last30Orders.length,
      top_campus: campus_breakdown[0]?.name || "",
      top_product: top_products[0]?.name || "",
      pending_orders: pendingOrders.length,
      critical_stock_count: critical_stock.length,
      campus_breakdown,
      payment_breakdown,
      top_products,
      critical_stock,
      generated_at: new Date().toISOString(),
    };

    const cards: Array<{ title: string; value: string; detail: string; severity: Severity }> = [
      { title: "Ventas del mes", value: money(monthSales), detail: `${monthOrders.length} órdenes registradas este mes.`, severity: monthSales > 0 ? "success" : "info" },
      { title: "Ventas 30 días", value: money(last30Sales), detail: "Panorámica reciente de movimiento comercial.", severity: "info" },
      { title: "Campus líder", value: summary.top_campus || "Sin datos", detail: "Campus con mayor venta en el periodo.", severity: summary.top_campus ? "success" : "info" },
      { title: "Producto más vendido", value: summary.top_product || "Sin datos", detail: "Producto con mayor rotación reciente.", severity: summary.top_product ? "success" : "info" },
      { title: "Pedidos pendientes", value: String(summary.pending_orders), detail: "Pendientes, en producción o listos para retiro.", severity: summary.pending_orders > 0 ? "warning" : "success" },
      { title: "Stock crítico", value: String(summary.critical_stock_count), detail: "Productos con 3 unidades o menos.", severity: summary.critical_stock_count > 0 ? "warning" : "success" },
    ];

    const fallback = monthSales > 0
      ? `ARM Merch registra ${money(monthSales)} este mes en ${monthOrders.length} órdenes. ${summary.top_campus ? `El campus con mayor movimiento es ${summary.top_campus}. ` : ""}${summary.critical_stock_count > 0 ? "Se recomienda revisar stock crítico y preparar reposición antes del próximo domingo." : "El stock se mantiene sin alertas críticas principales."}`
      : "ARM Merch aún no registra ventas relevantes este mes. Se recomienda revisar visibilidad del catálogo, disponibilidad de productos y activar comunicación por WhatsApp.";

    const executive = await aiExecutiveSummary(summary);

    return NextResponse.json({
      success: true,
      summary,
      cards,
      executive_summary: executive || fallback,
      source: executive ? "openai" : "fallback",
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Pastoral Dashboard] Error:", error);
    return NextResponse.json({ error: error?.message || "Error generando dashboard pastoral" }, { status: 500 });
  }
}
