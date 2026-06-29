"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CheckCircle2,
  Clock,
  PackageCheck,
  RefreshCw,
  Shirt,
  Sparkles,
  AlertTriangle,
  Timer,
} from "lucide-react";

type ProductionItem = {
  id?: string;
  quantity?: number;
  size?: string | null;
  fulfillment_type?: string | null;
  production_started_at?: string | null;
  ready_pickup_at?: string | null;
  delivered_at?: string | null;
  products?: {
    name?: string | null;
    sku?: string | null;
  } | null;
};

type OrderRow = {
  id: string;
  order_number: number | string;
  created_at: string;
  production_status?: string | null;
  tracking_token?: string | null;
  campus_id?: string | null;
  pickup_campus_id?: string | null;
  order_contacts?: {
    client_name?: string | null;
  } | null | Array<{ client_name?: string | null }>;
  campus?: { name?: string | null } | null;
  pickup_campus?: { name?: string | null } | null;
  order_items?: ProductionItem[];
};

const STATUS = {
  pending: "pending_production",
  production: "in_production",
  ready: "ready_pickup",
};

function formatTimeAgo(date: string) {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return "Ahora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  return `${Math.floor(hours / 24)}d`;
}

function getSlaLevel(date: string) {
  const diffMs = Date.now() - new Date(date).getTime();
  const hours = diffMs / (1000 * 60 * 60);
  if (hours < 24) return "ok";
  if (hours < 48) return "warning";
  if (hours < 72) return "late";
  return "critical";
}

const SLA_STYLES = {
  ok: "border-green-500/30 bg-green-500/10 text-green-400",
  warning: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  late: "border-orange-500/30 bg-orange-500/10 text-orange-400",
  critical: "border-red-500/30 bg-red-500/10 text-red-400 animate-pulse",
};

function getContactName(order: OrderRow) {
  const contact = Array.isArray(order.order_contacts)
    ? order.order_contacts[0]
    : order.order_contacts;
  return contact?.client_name || "Cliente";
}

function getCampusName(order: OrderRow) {
  return order.pickup_campus?.name || order.campus?.name || "Campus ARM";
}

function getProductionItems(order: OrderRow) {
  return (order.order_items || []).filter(
    (item) => item.fulfillment_type === "production" && !item.delivered_at
  );
}

function statusFromItems(order: OrderRow) {
  const items = getProductionItems(order);
  if (items.length === 0) return order.production_status || STATUS.pending;
  const allReady = items.every((item) => item.ready_pickup_at);
  const anyStarted = items.some((item) => item.production_started_at);
  if (allReady || order.production_status === STATUS.ready) return STATUS.ready;
  if (anyStarted || order.production_status === STATUS.production) return STATUS.production;
  return STATUS.pending;
}

function playNewOrderSound() {
  if (typeof window === "undefined") return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
    setTimeout(() => ctx.close().catch(() => null), 800);
  } catch {}
}

function OrderCard({ order, isNew }: { order: OrderRow; isNew?: boolean }) {
  const items = getProductionItems(order);
  const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const slaLevel = getSlaLevel(order.created_at);

  return (
    <div
      className={`rounded-[28px] border bg-[#111318] p-5 shadow-2xl shadow-black/30 transition-all duration-500 ${
        isNew ? "border-amber-500/50 ring-2 ring-amber-500/30 animate-[pulse_1s_ease-in-out_2]" : "border-white/10"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-5xl font-black tracking-tight text-white">
            #{order.order_number}
          </div>
          <div className="mt-1.5 text-lg font-semibold text-zinc-300">
            {getContactName(order)}
          </div>
        </div>

        <div className={`rounded-xl border px-3 py-1.5 text-xs font-black ${SLA_STYLES[slaLevel]}`}>
          <div className="flex items-center gap-1.5">
            {slaLevel === "critical" || slaLevel === "late" ? <AlertTriangle size={12} /> : <Timer size={12} />}
            {formatTimeAgo(order.created_at)}
          </div>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <div className="flex-1 rounded-2xl bg-black/30 px-3 py-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Campus</p>
          <p className="mt-0.5 truncate text-sm font-black text-amber-300">{getCampusName(order)}</p>
        </div>
        <div className="rounded-2xl bg-black/30 px-3 py-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Cant</p>
          <p className="mt-0.5 text-sm font-black text-white">{totalQty}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {items.map((item, index) => (
          <div
            key={`${order.id}-${item.id || index}`}
            className="flex items-center justify-between gap-2 rounded-xl bg-black/25 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">
                {item.products?.name || "Producto"}
              </p>
              {item.size && (
                <p className="text-xs text-violet-400 font-semibold">Talla {item.size}</p>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-sm font-black text-white">
              x{Number(item.quantity || 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Column({
  title,
  subtitle,
  icon,
  accent,
  orders,
  newOrderIds,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
  orders: OrderRow[];
  newOrderIds: Set<string>;
}) {
  return (
    <section className="flex min-h-[70vh] flex-col rounded-[32px] border border-white/10 bg-white/[0.035] p-5">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`rounded-2xl p-3 ${accent}`}>{icon}</div>
          <div>
            <h2 className="text-2xl font-black text-white">{title}</h2>
            <p className="text-sm text-zinc-500">{subtitle}</p>
          </div>
        </div>
        <div className="rounded-2xl bg-black/25 px-4 py-2 text-3xl font-black text-white">
          {orders.length}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {orders.length === 0 ? (
          <div className="flex min-h-[220px] items-center justify-center rounded-[28px] border border-dashed border-white/10 text-zinc-600">
            <div className="text-center">
              <CheckCircle2 size={40} className="mx-auto mb-2 opacity-30" />
              <p>Sin pedidos</p>
            </div>
          </div>
        ) : (
          orders.map((order) => (
            <OrderCard key={order.id} order={order} isNew={newOrderIds.has(order.id)} />
          ))
        )}
      </div>
    </section>
  );
}

export default function ProductionTVPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [clock, setClock] = useState(new Date());
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const previousOrderIdsRef = useRef<Set<string>>(new Set());

  // Reloj en vivo
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  async function loadOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id, order_number, created_at, production_status, tracking_token,
        campus_id, pickup_campus_id,
        order_contacts(client_name),
        campus:campus_id(name),
        pickup_campus:pickup_campus_id(name),
        order_items(id, quantity, size, fulfillment_type, production_started_at, ready_pickup_at, delivered_at, products(name, sku))
      `)
      .in("production_status", ["pending_production", "in_production", "ready_pickup"])
      .order("created_at", { ascending: true });

    if (!error && data) {
      const currentIds = new Set(data.map((o: any) => o.id));
      const prevIds = previousOrderIdsRef.current;

      // Detectar pedidos nuevos
      const freshIds = new Set<string>();
      currentIds.forEach((id) => {
        if (!prevIds.has(id)) freshIds.add(id);
      });

      if (freshIds.size > 0 && prevIds.size > 0) {
        playNewOrderSound();
        setNewOrderIds(freshIds);
        setTimeout(() => setNewOrderIds(new Set()), 5000);
      }

      previousOrderIdsRef.current = currentIds;
      setOrders(data as OrderRow[]);
      setLastUpdated(new Date());
    }
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    const channel = supabase
      .channel("production-tv-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadOrders())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => loadOrders())
      .subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, []);

  const pending = useMemo(() => orders.filter((o) => statusFromItems(o) === STATUS.pending), [orders]);
  const inProduction = useMemo(() => orders.filter((o) => statusFromItems(o) === STATUS.production), [orders]);
  const ready = useMemo(() => orders.filter((o) => statusFromItems(o) === STATUS.ready), [orders]);
  const totalActive = pending.length + inProduction.length + ready.length;

  return (
    <main className="min-h-screen overflow-hidden bg-[#07090d] p-6 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(124,58,237,0.1),transparent_35%)]" />

      <div className="relative z-10">
        <header className="mb-6 flex items-center justify-between rounded-[32px] border border-white/10 bg-white/[0.04] px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-amber-400" />
              <p className="text-xs font-black uppercase tracking-[0.35em] text-amber-400">ARM Merch</p>
            </div>
            <h1 className="mt-2 text-5xl font-black tracking-tight">Pantalla de Producción</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Reloj */}
            <div className="rounded-3xl bg-black/30 px-5 py-3 text-center">
              <p className="text-4xl font-black tabular-nums text-white">
                {clock.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
              <p className="mt-1 text-xs font-semibold text-zinc-500">
                {clock.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "short" })}
              </p>
            </div>

            <div className="rounded-3xl bg-black/30 px-5 py-3 text-right">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Activos</p>
              <p className="text-3xl font-black text-white">{totalActive}</p>
            </div>

            <div className="rounded-3xl bg-black/30 px-5 py-3 text-right">
              <p className="flex items-center justify-end gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
                <RefreshCw size={13} className="animate-spin" style={{ animationDuration: "3s" }} />
                Auto
              </p>
              <p className="text-sm font-black text-green-400">
                {lastUpdated ? lastUpdated.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "..."}
              </p>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex h-[70vh] items-center justify-center">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-3">
            <Column
              title="Pendientes"
              subtitle="Pedidos recibidos"
              accent="bg-amber-500/15 text-amber-300"
              icon={<Clock size={30} />}
              orders={pending}
              newOrderIds={newOrderIds}
            />
            <Column
              title="En producción"
              subtitle="Preparando productos"
              accent="bg-violet-500/15 text-violet-300"
              icon={<Shirt size={30} />}
              orders={inProduction}
              newOrderIds={newOrderIds}
            />
            <Column
              title="Listos retiro"
              subtitle="Disponibles para entregar"
              accent="bg-green-500/15 text-green-300"
              icon={<PackageCheck size={30} />}
              orders={ready}
              newOrderIds={newOrderIds}
            />
          </div>
        )}
      </div>
    </main>
  );
}
