import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type InsightSeverity = "success" | "warning" | "danger" | "info";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

async function getSessionUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return { errorResponse: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { errorResponse: NextResponse.json({ error: "Faltan variables públicas de Supabase" }, { status: 500 }) };
  }

  const userSupabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await userSupabase.auth.getUser(token);

  if (error || !user) {
    return { errorResponse: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey || supabaseAnonKey, {
    auth: { persistSession: false },
  });

  return { user, supabase: adminSupabase };
}

function startOfDayISO() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function daysAgoISO(days: number) {
  const now = new Date();
  now.setDate(now.getDate() - days);
  return now.toISOString();
}

function getOrderTotal(order: any) {
  return Number(order?.total || order?.total_amount || order?.amount || 0);
}

function getProductName(item: any) {
  return item?.products?.name || item?.product?.name || item?.product_name || item?.name || "Producto sin nombre";
}

function getItemQuantity(item: any) {
  return Number(item?.quantity || item?.qty || 1);
}

function getStockValue(row: any) {
  return Number(row?.stock || row?.quantity || row?.available_stock || row?.current_stock || 0);
}

function buildInsights({
  todaySales,
  todayOrdersCount,
  last7Sales,
  last30Sales,
  topProduct,
  criticalStock,
  pendingOrders,
}: {
  todaySales: number;
  todayOrdersCount: number;
  last7Sales: number;
  last30Sales: number;
  topProduct: string;
  criticalStock: any[];
  pendingOrders: number;
}) {
  const insights: Array<{ title: string; value: string; detail: string; severity: InsightSeverity }> = [
    {
      title: "Ventas hoy",
      value: formatCurrency(todaySales),
      detail: `${todayOrdersCount} orden${todayOrdersCount === 1 ? "" : "es"} registradas hoy.`,
      severity: todaySales > 0 ? "success" : "info",
    },
    {
      title: "Ventas 7 días",
      value: formatCurrency(last7Sales),
      detail: "Acumulado de los últimos 7 días.",
      severity: "info",
    },
    {
      title: "Ventas 30 días",
      value: formatCurrency(last30Sales),
      detail: "Referencia mensual para decisiones de stock.",
      severity: "info",
    },
    {
      title: "Producto top",
      value: topProduct || "Sin datos",
      detail: topProduct ? "Producto con mayor movimiento según órdenes recientes." : "Aún no hay suficiente historial.",
      severity: topProduct ? "success" : "info",
    },
    {
      title: "Stock crítico",
      value: `${criticalStock.length}`,
      detail: criticalStock.length > 0 ? "Hay productos con 3 unidades o menos." : "No se detectan productos críticos.",
      severity: criticalStock.length > 0 ? "warning" : "success",
    },
    {
      title: "Pedidos pendientes",
      value: `${pendingOrders}`,
      detail: pendingOrders > 0 ? "Pedidos pendientes de entrega/producción." : "No hay pedidos pendientes detectados.",
      severity: pendingOrders > 0 ? "warning" : "success",
    },
  ];

  const recommendation = criticalStock.length > 0
    ? `Reponer o mover stock para: ${criticalStock.slice(0, 3).map((p) => p.name).join(", ")}.`
    : todaySales > 0
      ? "Mantén el foco en productos con mejor rotación y revisa stock al cierre del día."
      : "Aún no hay ventas hoy. Revisa catálogo, disponibilidad y campañas por WhatsApp.";

  return { insights, recommendation };
}

async function generateAiRecommendation(summary: any) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const model = process.env.OPENAI_MODEL || "gpt-5-mini";
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        instructions: "Eres un analista ejecutivo de retail multi-campus para ARM Merch. Entrega una recomendación breve, accionable y en español chileno. No inventes datos.",
        input: `Analiza este resumen y devuelve solo una recomendación ejecutiva de máximo 450 caracteres:\n${JSON.stringify(summary, null, 2)}`,
        temperature: 0.3,
        max_output_tokens: 180,
      }),
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("[AI Insights] OpenAI error:", data);
      return null;
    }

    return String(data?.output_text || data?.output?.[0]?.content?.[0]?.text || "").trim().slice(0, 700);
  } catch (error) {
    console.error("[AI Insights] AI recommendation error:", error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getSessionUser(req);
    if (auth.errorResponse) return auth.errorResponse;

    const supabase = auth.supabase!;
    const todayISO = startOfDayISO();
    const sevenISO = daysAgoISO(7);
    const thirtyISO = daysAgoISO(30);

    const [todayOrdersRes, last7OrdersRes, last30OrdersRes, orderItemsRes, productsRes, pendingOrdersRes] = await Promise.all([
      supabase.from("orders").select("*").gte("created_at", todayISO).order("created_at", { ascending: false }).limit(500),
      supabase.from("orders").select("*").gte("created_at", sevenISO).order("created_at", { ascending: false }).limit(1000),
      supabase.from("orders").select("*").gte("created_at", thirtyISO).order("created_at", { ascending: false }).limit(2000),
      supabase.from("order_items").select("*, products(name, sku)").gte("created_at", thirtyISO).limit(2000),
      supabase.from("products").select("*").limit(1000),
      supabase.from("orders").select("*").in("delivery_status", ["pending", "in_production", "ready"]).limit(500),
    ]);

    const todayOrders = todayOrdersRes.data || [];
    const last7Orders = last7OrdersRes.data || [];
    const last30Orders = last30OrdersRes.data || [];
    const orderItems = orderItemsRes.data || [];
    const products = productsRes.data || [];
    const pendingOrders = pendingOrdersRes.data || [];

    const todaySales = todayOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
    const last7Sales = last7Orders.reduce((sum, order) => sum + getOrderTotal(order), 0);
    const last30Sales = last30Orders.reduce((sum, order) => sum + getOrderTotal(order), 0);

    const productCounter = new Map<string, number>();
    orderItems.forEach((item) => {
      const name = getProductName(item);
      productCounter.set(name, (productCounter.get(name) || 0) + getItemQuantity(item));
    });

    const topProduct = Array.from(productCounter.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

    const criticalStock = products
      .map((product: any) => ({
        id: product.id,
        name: product.name || product.title || "Producto",
        stock: getStockValue(product),
        sku: product.sku || product.code || null,
      }))
      .filter((product) => product.stock <= 3)
      .sort((a, b) => a.stock - b.stock);

    const summary = {
      today_sales: todaySales,
      today_orders: todayOrders.length,
      last_7_days_sales: last7Sales,
      last_30_days_sales: last30Sales,
      top_product: topProduct,
      critical_stock: criticalStock.slice(0, 10),
      pending_orders: pendingOrders.length,
      generated_at: new Date().toISOString(),
    };

    const basic = buildInsights({
      todaySales,
      todayOrdersCount: todayOrders.length,
      last7Sales,
      last30Sales,
      topProduct,
      criticalStock,
      pendingOrders: pendingOrders.length,
    });

    const aiRecommendation = await generateAiRecommendation(summary);

    return NextResponse.json({
      success: true,
      summary,
      insights: basic.insights,
      recommendation: aiRecommendation || basic.recommendation,
      source: aiRecommendation ? "openai" : "fallback",
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[AI Insights] Error:", error);
    return NextResponse.json({ error: error?.message || "Error generando insights" }, { status: 500 });
  }
}
