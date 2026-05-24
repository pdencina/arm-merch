import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Severity = "success" | "warning" | "danger" | "info";
type PeriodKey = "today" | "7d" | "month" | "30d";

const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "Hoy",
  "7d": "Últimos 7 días",
  month: "Mes actual",
  "30d": "Últimos 30 días",
};

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

function startOfTodayISO() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function startOfMonthISO() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function startForPeriod(period: PeriodKey) {
  if (period === "today") return startOfTodayISO();
  if (period === "7d") return daysAgoISO(7);
  if (period === "month") return startOfMonthISO();
  return daysAgoISO(30);
}

function normalizePeriod(value: string | null): PeriodKey {
  if (value === "today" || value === "7d" || value === "month" || value === "30d") {
    return value;
  }

  return "month";
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
  const method = String(order?.payment_method || "sin método");

  const labels: Record<string, string> = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    sumup: "SumUp",
    solo: "SumUp SOLO",
    link: "Link de pago",
    card: "Tarjeta",
  };

  return labels[method] || method;
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

function isPaidOrder(order: any) {
  const status = String(order?.status || "").toLowerCase();
  return ["paid", "pagado", "approved", "completed", "success", "delivered"].includes(status);
}

function isPendingPayment(order: any) {
  const status = String(order?.status || "").toLowerCase();
  return ["pending", "pending_transfer", "created", "unpaid", "waiting"].includes(status);
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
          "Eres asesor ejecutivo para un pastor principal. Resume ARM Merch en tono pastoral-ejecutivo, claro, breve, estratégico y en español chileno. No inventes datos. Usa lenguaje práctico para toma de decisiones.",
        input: `Datos ARM Merch:\n${JSON.stringify(summary, null, 2)}\n\nDevuelve un resumen ejecutivo de máximo 750 caracteres con una recomendación concreta.`,
        temperature: 0.35,
        max_output_tokens: 280,
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
      .slice(0, 950);
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
    const period = normalizePeriod(req.nextUrl.searchParams.get("period"));
    const periodLabel = PERIOD_LABELS[period];
    const periodStartISO = startForPeriod(period);

    const [
      periodOrdersRes,
      allItemsRes,
      productsRes,
      inventoryRes,
      campusRes,
      pendingDeliveryRes,
    ] = await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .gte("created_at", periodStartISO)
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase.from("order_items").select("*").limit(10000),
      supabase.from("products").select("*").limit(3000),
      supabase.from("inventory").select("*").limit(5000),
      supabase.from("campus").select("*").limit(200),
      supabase
        .from("orders")
        .select("*")
        .in("delivery_status", ["pending", "in_production", "ready"])
        .limit(1500),
    ]);

    if (periodOrdersRes.error) throw periodOrdersRes.error;

    const periodOrders = periodOrdersRes.data || [];
    const allItems = allItemsRes.data || [];
    const products = productsRes.data || [];
    const inventory = inventoryRes.data || [];
    const campusRows = campusRes.data || [];
    const pendingDeliveryOrders = pendingDeliveryRes.data || [];

    const productsById = new Map<string, any>();
    products.forEach((product: any) => productsById.set(String(product.id), product));

    const campusById = new Map<string, any>();
    campusRows.forEach((campus: any) => campusById.set(String(campus.id), campus));

    const periodOrderIds = new Set(periodOrders.map((order: any) => String(order.id)));
    const periodItems = allItems.filter((item: any) => periodOrderIds.has(String(item.order_id)));

    // KPIs financieros reales: solo órdenes pagadas.
    // Las órdenes pending/pending_transfer representan intención de compra, no venta confirmada.
    const paidOrders = periodOrders.filter(isPaidOrder);
    const paidOrderIds = new Set(paidOrders.map((order: any) => String(order.id)));
    const paidItems = allItems.filter((item: any) => paidOrderIds.has(String(item.order_id)));

    const grossSales = paidOrders.reduce((sum, order) => sum + orderTotal(order), 0);
    const paidSales = grossSales;
    const avgTicket = paidOrders.length > 0 ? grossSales / paidOrders.length : 0;
    const paidRate = periodOrders.length > 0 ? Math.round((paidOrders.length / periodOrders.length) * 100) : 0;
    const pendingPaymentOrders = periodOrders.filter(isPendingPayment).length;
    const pendingPaymentTotal = periodOrders
      .filter(isPendingPayment)
      .reduce((sum, order) => sum + orderTotal(order), 0);
    const unitsSold = paidItems.reduce((sum, item) => sum + itemQty(item), 0);

    const campusMap = new Map<string, { total: number; orders: number; units: number }>();
    for (const order of paidOrders) {
      const name = campusNameFromMap(order?.campus_id, campusById);
      const current = campusMap.get(name) || { total: 0, orders: 0, units: 0 };
      current.total += orderTotal(order);
      current.orders += 1;
      campusMap.set(name, current);
    }

    for (const item of paidItems) {
      const order = paidOrders.find((o: any) => String(o.id) === String(item.order_id));
      const name = campusNameFromMap(order?.campus_id, campusById);
      const current = campusMap.get(name) || { total: 0, orders: 0, units: 0 };
      current.units += itemQty(item);
      campusMap.set(name, current);
    }

    const paymentMap = new Map<string, { total: number; orders: number }>();
    for (const order of paidOrders) {
      const key = paymentMethod(order);
      const current = paymentMap.get(key) || { total: 0, orders: 0 };
      current.total += orderTotal(order);
      current.orders += 1;
      paymentMap.set(key, current);
    }

    const productMap = new Map<string, { quantity: number; total: number }>();
    for (const item of paidItems) {
      const productId = itemProductId(item);
      const name = productNameFromMap(productId, productsById);
      const current = productMap.get(name) || { quantity: 0, total: 0 };
      const qty = itemQty(item);
      current.quantity += qty;
      current.total += Number(item?.unit_price || item?.price || 0) * qty;
      productMap.set(name, current);
    }

    const campus_breakdown = Array.from(campusMap.entries())
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const payment_breakdown = Array.from(paymentMap.entries())
      .map(([method, value]) => ({ method, ...value }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const top_products = Array.from(productMap.entries())
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);

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
      period,
      period_label: periodLabel,
      period_start: periodStartISO,
      gross_sales: grossSales,
      paid_sales: paidSales,
      orders_count: periodOrders.length,
      paid_orders_count: paidOrders.length,
      pending_payment_orders: pendingPaymentOrders,
      pending_payment_total: pendingPaymentTotal,
      paid_rate: paidRate,
      avg_ticket: avgTicket,
      units_sold: unitsSold,
      top_campus: campus_breakdown[0]?.name || "",
      top_product: top_products[0]?.name || "",
      pending_delivery_orders: pendingDeliveryOrders.length,
      critical_stock_count: critical_stock.length,
      campus_breakdown,
      payment_breakdown,
      top_products,
      critical_stock,
      generated_at: new Date().toISOString(),
    };

    const cards: Array<{ title: string; value: string; detail: string; severity: Severity }> = [
      {
        title: `Ventas confirmadas ${periodLabel}`,
        value: money(grossSales),
        detail: `${paidOrders.length} órdenes pagadas en el periodo seleccionado.`,
        severity: grossSales > 0 ? "success" : "info",
      },
      {
        title: "Pendiente confirmación",
        value: money(pendingPaymentTotal),
        detail: `${pendingPaymentOrders} órdenes pendientes de pago o transferencia.`,
        severity: pendingPaymentOrders > 0 ? "warning" : "success",
      },
      {
        title: "Ticket promedio",
        value: money(avgTicket),
        detail: "Promedio por orden pagada del periodo.",
        severity: avgTicket > 0 ? "success" : "info",
      },
      {
        title: "Campus líder",
        value: summary.top_campus || "Sin datos",
        detail: `Mayor venta en ${periodLabel}.`,
        severity: summary.top_campus ? "success" : "info",
      },
      {
        title: "Producto top",
        value: summary.top_product || "Sin datos",
        detail: "Producto con mayor cantidad vendida.",
        severity: summary.top_product ? "success" : "info",
      },
      {
        title: "Unidades vendidas",
        value: String(unitsSold),
        detail: "Cantidad total de productos vendidos.",
        severity: unitsSold > 0 ? "success" : "info",
      },
      {
        title: "Pagos confirmados",
        value: `${paidRate}%`,
        detail: `${paidOrders.length} de ${periodOrders.length} órdenes aparecen pagadas/completadas. Pendientes: ${pendingPaymentOrders}.`,
        severity: paidRate >= 80 ? "success" : paidRate >= 50 ? "warning" : "info",
      },
      {
        title: "Pedidos por entregar",
        value: String(summary.pending_delivery_orders),
        detail: "Pendientes, en producción o listos para retiro.",
        severity: summary.pending_delivery_orders > 0 ? "warning" : "success",
      },
      {
        title: "Stock crítico",
        value: String(summary.critical_stock_count),
        detail: "Productos con 3 unidades o menos.",
        severity: summary.critical_stock_count > 0 ? "warning" : "success",
      },
    ];

    const fallback =
      grossSales > 0
        ? `En ${periodLabel}, ARM Merch registra ${money(grossSales)} confirmados en ${paidOrders.length} órdenes pagadas, con ticket promedio de ${money(avgTicket)}. ${
            summary.top_campus ? `El campus con mayor movimiento es ${summary.top_campus}. ` : ""
          }${
            summary.critical_stock_count > 0
              ? "Se recomienda revisar stock crítico y preparar reposición antes del próximo domingo."
              : "El stock se mantiene sin alertas críticas principales."
          }`
        : pendingPaymentOrders > 0
          ? `En ${periodLabel}, ARM Merch no registra ventas confirmadas, pero existen ${pendingPaymentOrders} órdenes pendientes por ${money(pendingPaymentTotal)}. Se recomienda validar pagos antes de considerar estos montos como venta real.`
          : `En ${periodLabel}, ARM Merch aún no registra ventas confirmadas. Se recomienda revisar visibilidad del catálogo, disponibilidad de productos y comunicación por WhatsApp.`;

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
