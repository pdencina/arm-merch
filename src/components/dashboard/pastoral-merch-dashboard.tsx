"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  Crown,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Wallet,
  CreditCard,
  Boxes,
} from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

type Severity = "success" | "warning" | "danger" | "info";
type PeriodKey = "today" | "7d" | "month" | "30d";

type Card = {
  title: string;
  value: string;
  detail: string;
  severity: Severity;
};

type PastoralResponse = {
  success: boolean;
  cards: Card[];
  executive_summary: string;
  source: "openai" | "fallback";
  generated_at: string;
  summary: {
    period: PeriodKey;
    period_label: string;
    gross_sales: number;
    paid_sales: number;
    orders_count: number;
    paid_orders_count: number;
    pending_payment_orders: number;
    paid_rate: number;
    avg_ticket: number;
    units_sold: number;
    top_campus: string;
    top_product: string;
    pending_delivery_orders: number;
    critical_stock_count: number;
    campus_breakdown: Array<{ name: string; total: number; orders: number; units: number }>;
    payment_breakdown: Array<{ method: string; total: number; orders: number }>;
    top_products: Array<{ name: string; quantity: number; total: number }>;
    critical_stock: Array<{ id: string; name: string; sku?: string | null; stock: number }>;
  };
};

const periodOptions: Array<{ key: PeriodKey; label: string }> = [
  { key: "today", label: "Hoy" },
  { key: "7d", label: "7 días" },
  { key: "month", label: "Mes actual" },
  { key: "30d", label: "30 días" },
];

const severityClass: Record<Severity, string> = {
  success: "border-green-500/20 bg-green-500/[0.06] text-green-300",
  warning: "border-amber-500/20 bg-amber-500/[0.06] text-amber-300",
  danger: "border-red-500/20 bg-red-500/[0.06] text-red-300",
  info: "border-blue-500/20 bg-blue-500/[0.06] text-blue-300",
};

const iconMap: Record<string, any> = {
  "Ticket promedio": CreditCard,
  "Campus líder": Building2,
  "Producto top": Crown,
  "Unidades vendidas": Boxes,
  "Pagos confirmados": CheckCircle2,
  "Pedidos por entregar": PackageCheck,
  "Stock crítico": AlertTriangle,
};

function money(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function SkeletonCard() {
  return (
    <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
      <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
      <div className="mt-5 h-8 w-32 animate-pulse rounded bg-white/10" />
      <div className="mt-4 h-3 w-full animate-pulse rounded bg-white/10" />
      <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-white/10" />
    </div>
  );
}

export default function PastoralMerchDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [data, setData] = useState<PastoralResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard(selectedPeriod = period, isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Sesión expirada. Vuelve a iniciar sesión.");
        return;
      }

      const res = await fetch(`/api/ai/pastoral-insights?period=${selectedPeriod}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        setError(json?.error || "No se pudo cargar la panorámica pastoral.");
        return;
      }

      setData(json);
    } catch (err: any) {
      setError(err?.message || "Error cargando dashboard pastoral.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard(period);
  }, []);

  function handlePeriodChange(nextPeriod: PeriodKey) {
    setPeriod(nextPeriod);
    loadDashboard(nextPeriod);
  }

  return (
    <div className="min-h-screen bg-[#08090d] px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-amber-500/[0.12] via-white/[0.035] to-white/[0.02] p-7">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-300">
                <Sparkles size={14} />
                Panorámica Pastoral
              </div>

              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                ARM Merch Executive View
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300 md:text-base">
                Vista clara para liderazgo: ventas, campus, productos, pagos,
                pedidos por entregar, stock crítico y resumen ejecutivo.
              </p>
            </div>

            <button
              onClick={() => loadDashboard(period, true)}
              disabled={loading || refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-5 py-3 text-sm font-bold text-white transition hover:bg-black/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              Actualizar vista
            </button>
          </div>
        </section>

        <div className="flex flex-col justify-between gap-4 rounded-3xl border border-white/8 bg-white/[0.03] p-4 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              Periodo de análisis
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              Todos los KPIs principales usan el mismo periodo seleccionado.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 md:flex">
            {periodOptions.map((option) => (
              <button
                key={option.key}
                onClick={() => handlePeriodChange(option.key)}
                className={`rounded-2xl px-4 py-2.5 text-sm font-black transition ${
                  period === option.key
                    ? "bg-amber-500 text-black"
                    : "border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : data ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {data.cards.map((card, index) => {
                const Icon =
                  card.title.startsWith("Ventas") ? Wallet : iconMap[card.title] || ShoppingBag;

                return (
                  <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="rounded-3xl border border-white/8 bg-[#111217] p-5 shadow-2xl shadow-black/20"
                  >
                    <div className="mb-5 flex items-center justify-between">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${severityClass[card.severity]}`}>
                        <Icon size={19} />
                      </div>

                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${severityClass[card.severity]}`}>
                        {card.severity}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-zinc-400">{card.title}</p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-white">{card.value}</p>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-500">{card.detail}</p>
                  </motion.div>
                );
              })}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[2rem] border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.11] via-white/[0.03] to-white/[0.02] p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-black text-amber-300">
                  <Bot size={18} />
                  Resumen para liderazgo · {data.summary.period_label}
                </div>

                <p className="text-lg font-semibold leading-relaxed text-white">
                  {data.executive_summary}
                </p>

                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-zinc-400">
                  <CheckCircle2 size={14} className="text-green-400" />
                  Fuente: {data.source === "openai" ? "OpenAI" : "Fallback seguro"}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/8 bg-white/[0.03] p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-black text-white">
                  <Building2 size={18} className="text-blue-300" />
                  Ventas por campus · {data.summary.period_label}
                </div>

                {data.summary.campus_breakdown.length === 0 ? (
                  <p className="text-sm text-zinc-500">No hay ventas por campus para mostrar.</p>
                ) : (
                  <div className="space-y-3">
                    {data.summary.campus_breakdown.slice(0, 6).map((campus) => (
                      <div key={campus.name} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-bold text-white">{campus.name}</p>
                          <p className="font-black text-amber-300">{money(campus.total)}</p>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          {campus.orders} órdenes · {campus.units || 0} unidades
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-[2rem] border border-white/8 bg-white/[0.03] p-6">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-black text-white">
                  <Crown size={18} className="text-amber-300" />
                  Productos top · {data.summary.period_label}
                </h3>

                <div className="space-y-3">
                  {data.summary.top_products.length === 0 ? (
                    <p className="text-sm text-zinc-500">Sin productos vendidos.</p>
                  ) : (
                    data.summary.top_products.slice(0, 6).map((product) => (
                      <div key={product.name} className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">{product.name}</p>
                          <p className="text-xs text-zinc-600">{money(product.total || 0)} vendido</p>
                        </div>
                        <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-300">
                          {product.quantity} uds
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/8 bg-white/[0.03] p-6">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-black text-white">
                  <Wallet size={18} className="text-green-300" />
                  Métodos de pago · {data.summary.period_label}
                </h3>

                <div className="space-y-3">
                  {data.summary.payment_breakdown.length === 0 ? (
                    <p className="text-sm text-zinc-500">Sin pagos registrados.</p>
                  ) : (
                    data.summary.payment_breakdown.slice(0, 6).map((payment) => (
                      <div key={payment.method} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-bold capitalize text-white">{payment.method}</p>
                          <p className="font-black text-green-300">{money(payment.total)}</p>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">{payment.orders} órdenes</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/8 bg-white/[0.03] p-6">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-black text-white">
                  <AlertTriangle size={18} className="text-amber-300" />
                  Stock crítico actual
                </h3>

                <div className="space-y-3">
                  {data.summary.critical_stock.length === 0 ? (
                    <p className="text-sm text-zinc-500">Sin stock crítico detectado.</p>
                  ) : (
                    data.summary.critical_stock.slice(0, 6).map((product) => (
                      <div key={product.id} className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">{product.name}</p>
                          <p className="text-xs text-zinc-600">{product.sku || "Sin SKU"}</p>
                        </div>
                        <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-300">
                          {product.stock} uds
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-zinc-600">
              Última actualización: {new Date(data.generated_at).toLocaleString("es-CL")}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
