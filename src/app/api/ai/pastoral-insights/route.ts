import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Severity = "success" | "warning" | "danger" | "info";

function money(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

async function getAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return {
      errorResponse: NextResponse.json(
        { error: "No autenticado" },
        { status: 401 },
      ),
    };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anon) {
    return {
      errorResponse: NextResponse.json(
        { error: "Faltan variables de Supabase" },
        { status: 500 },
      ),
    };
  }

  const userClient = createClient(url, anon);
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser(token);

  if (error || !user) {
    return {
      errorResponse: NextResponse.json(
        { error: "No autenticado" },
        { status: 401 },
      ),
    };
  }

  return {
    user,
    supabase: createClient(url, service || anon, {
      auth: { persistSession: false },
    }),
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
  return Number(order?.total || order?.subtotal || order?.amount || 0);
}

function itemQty(item: any) {
  return Number(item?.quantity || item?.qty || 1);
}

function itemProductId(item: any) {
  return String(item?.product_id || item?.productId || "");
}

function productNameFromMap(productId: string, productsById: Map<string, any>) {
  const product = productsById.get(productId);
  return product?.name || product?.title || "Producto sin nombre";
}

function campusNameFromMap(campusId: string | null | undefined, campusById: Map<string, any>) {
  if (!campusId) return "Sin campus";
  const campus = campusById.get(String(campusId));
  return campus?.name || campus?.title || campus?.campus_name || "Sin campus";
}

function paymentMethod(order: any) {
  return String(order?.payment_method || "sin método");
}

function stockValue(row: any) {
  return Number(
    row?.stock ??
      row?.quantity ??
      row?.available_stock ??
      row?.current_stock ??
      row?.qty ??
      0,
  );
}

function inventoryProductId(row: any) {
  return String(row?.product_id || row?.productId || "");
}

async function aiExecutiveSummary(summary: any) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const model = process.env.OPENAI_MODEL || "gpt-5-mini";

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions:
          "Eres asesor ejecutivo para un pastor principal. Resume ARM Merch en tono pastoral-ejecutivo, claro, breve, estratégico y en español chileno. No inventes datos.",
        input: `Datos ARM Merch:\n${JSON.stringify(summary, null, 2)}\n\nDevuelve un resumen ejecutivo de máximo 700 caracteres con una recomendación concreta.`,
        temperature: 0.35,
        max_output_tokens: 260,
      }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      console.error("[Pastoral Dashboard] OpenAI error:", data);
      return null;
    }

    return String(data?.output_text || data?.output?.[0]?.content?.[0]?.text || "")
      .trim()
      .slice(0, 900);
  } catch (error) {
    console.error("[Pastoral Dashboard] AI error:", error);
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

    const [
      monthOrdersRes,
      last30OrdersRes,
      allItemsRes,
      productsRes,
      inventoryRes,
      campusRes,
      pendingRes,
    ] = await Promise.all([
      supabase.from("orders").select("*").gte("created_at", monthISO).order("created_at", { ascending: false }).limit(3000),
      supabase.from("orders").select("*").gte("created_at", last30ISO).order("created_at", { ascending: false }).limit(5000),
      supabase.from("order_items").select("*").limit(6000),
      supabase.from("products").select("*").limit(2000),
      supabase.from("inventory").select("*").limit(3000),
      supabase.from("campus").select("*").limit(100),
      supabase.from("orders").select("*").in("delivery_status", ["pending", "in_production", "ready"]).limit(1000),
    ]);

    if (monthOrdersRes.error) throw monthOrdersRes.error;
    if (last30OrdersRes.error) throw last30OrdersRes.error;

    const monthOrders = monthOrdersRes.data || [];
    const last30Orders = last30OrdersRes.data || [];
    const allItems = allItemsRes.data || [];
    const products = productsRes.data || [];
    const inventory = inventoryRes.data || [];
    const campusRows = campusRes.data || [];
    const pendingOrders = pendingRes.data || [];

    const productsById = new Map<string, any>();
    products.forEach((product: any) => productsById.set(String(product.id), product));

    const campusById = new Map<string, any>();
    campusRows.forEach((campus: any) => campusById.set(String(campus.id), campus));

    const monthSales = monthOrders.reduce((sum, order) => sum + orderTotal(order), 0);
    const last30Sales = last30Orders.reduce((sum, order) => sum + orderTotal(order), 0);

    const last30OrderIds = new Set(last30Orders.map((order: any) => String(order.id)));
    const recentItems = allItems.filter((item: any) => last30OrderIds.has(String(item.order_id)));

    const campusMap = new Map<string, { total: number; orders: number }>();
    for (const order of last30Orders) {
      const name = campusNameFromMap(order?.campus_id, campusById);
      const current = campusMap.get(name) || { total: 0, orders: 0 };
      current.total += orderTotal(order);
      current.orders += 1;
      campusMap.set(name, current);
    }

    const paymentMap = new Map<string, { total: number; orders: number }>();
    for (const order of last30Orders) {
      const key = paymentMethod(order);
      const current = paymentMap.get(key) || { total: 0, orders: 0 };
      current.total += orderTotal(order);
      current.orders += 1;
      paymentMap.set(key, current);
    }

    const productMap = new Map<string, { quantity: number }>();
    for (const item of recentItems) {
      const productId = itemProductId(item);
      const name = productNameFromMap(productId, productsById);
      const current = productMap.get(name) || { quantity: 0 };
      current.quantity += itemQty(item);
      productMap.set(name, current);
    }

    const campus_breakdown = Array.from(campusMap.entries()).map(([name, value]) => ({ name, ...value })).sort((a, b) => b.total - a.total).slice(0, 8);
    const payment_breakdown = Array.from(paymentMap.entries()).map(([method, value]) => ({ method, ...value })).sort((a, b) => b.total - a.total).slice(0, 8);
    const top_products = Array.from(productMap.entries()).map(([name, value]) => ({ name, ...value })).sort((a, b) => b.quantity - a.quantity).slice(0, 8);

    const stockByProduct = new Map<string, number>();
    for (const row of inventory) {
      const productId = inventoryProductId(row);
      if (!productId) continue;
      stockByProduct.set(productId, (stockByProduct.get(productId) || 0) + stockValue(row));
    }

    const critical_stock = Array.from(stockByProduct.entries())
      .map(([productId, stock]) => {
        const product = productsById.get(productId);
        return {
          id: productId,
          name: product?.name || product?.title || "Producto",
          sku: product?.sku || product?.code || null,
          stock,
        };
      })
      .filter((product) => product.stock <= 3)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10);

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

    const fallback =
      monthSales > 0
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
    return NextResponse.json(
      { error: error?.message || "Error generando dashboard pastoral" },
      { status: 500 },
    );
  }
}
