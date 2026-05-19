"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Brain,
  CheckCircle2,
  Package,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

type InsightSeverity = "success" | "warning" | "danger" | "info";

type Insight = {
  title: string;
  value: string;
  detail: string;
  severity: InsightSeverity;
};

type InsightsResponse = {
  success: boolean;
  summary: {
    today_sales: number;
    today_orders: number;
    last_7_days_sales: number;
    last_30_days_sales: number;
    top_product: string;
    critical_stock: Array<{
      id: string;
      name: string;
      stock: number;
      sku?: string | null;
    }>;
    pending_orders: number;
    generated_at: string;
  };
  insights: Insight[];
  recommendation: string;
  source: "openai" | "fallback";
  generated_at: string;
};

const severityClass: Record<InsightSeverity, string> = {
  success: "border-green-500/20 bg-green-500/[0.06] text-green-300",
  warning: "border-amber-500/20 bg-amber-500/[0.06] text-amber-300",
  danger: "border-red-500/20 bg-red-500/[0.06] text-red-300",
  info: "border-blue-500/20 bg-blue-500/[0.06] text-blue-300",
};

const iconMap: Record<string, any> = {
  "Ventas hoy": Wallet,
  "Ventas 7 días": TrendingUp,
  "Ventas 30 días": TrendingUp,
  "Producto top": Sparkles,
  "Stock crítico": AlertTriangle,
  "Pedidos pendientes": Package,
};

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

export default function AiInsights() {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadInsights(isRefresh = false) {
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

      const res = await fetch("/api/ai/insights", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        setError(json?.error || "No se pudieron obtener insights.");
        return;
      }

      setData(json);
    } catch (err: any) {
      setError(err?.message || "Error cargando insights.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadInsights();
  }, []);

  return (
    <div className="min-h-screen bg-[#08090d] px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 rounded-[2rem] border border-white/8 bg-white/[0.03] p-6 md:flex-row md:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">
              <Brain size={14} />
              ARM Insights
            </div>

            <h1 className="text-3xl font-black tracking-tight md:text-4xl">
              Dashboard IA Ejecutivo
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Análisis inteligente de ventas, stock, pedidos y oportunidades
              operativas para ARM Merch.
            </p>
          </div>

          <button
            onClick={() => loadInsights(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            Actualizar análisis
          </button>
        </div>

        {error && (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : data ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.insights.map((insight, index) => {
                const Icon = iconMap[insight.title] || Zap;

                return (
                  <motion.div
                    key={insight.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="rounded-3xl border border-white/8 bg-[#111217] p-5 shadow-2xl shadow-black/20"
                  >
                    <div className="mb-5 flex items-center justify-between">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${severityClass[insight.severity]}`}
                      >
                        <Icon size={19} />
                      </div>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${severityClass[insight.severity]}`}
                      >
                        {insight.severity}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-zinc-400">
                      {insight.title}
                    </p>

                    <p className="mt-2 text-2xl font-black tracking-tight text-white">
                      {insight.value}
                    </p>

                    <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                      {insight.detail}
                    </p>
                  </motion.div>
                );
              })}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="rounded-[2rem] border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.10] via-white/[0.03] to-white/[0.02] p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-black text-amber-300">
                  <Bot size={18} />
                  Recomendación IA
                </div>

                <p className="text-lg font-semibold leading-relaxed text-white">
                  {data.recommendation}
                </p>

                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-zinc-400">
                  <CheckCircle2 size={14} className="text-green-400" />
                  Fuente: {data.source === "openai" ? "OpenAI" : "Fallback seguro"}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/8 bg-white/[0.03] p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-black text-white">
                  <AlertTriangle size={18} className="text-amber-300" />
                  Stock crítico
                </div>

                {data.summary.critical_stock.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No se detectan productos críticos por ahora.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.summary.critical_stock.slice(0, 6).map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">
                            {product.name}
                          </p>
                          <p className="text-xs text-zinc-600">
                            {product.sku || "Sin SKU"}
                          </p>
                        </div>

                        <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-300">
                          {product.stock} uds
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <p className="text-center text-xs text-zinc-600">
              Último análisis:{" "}
              {new Date(data.generated_at).toLocaleString("es-CL")}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
