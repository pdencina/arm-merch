"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useCart, type CartItem } from "@/lib/hooks/use-cart";
import {
  showCustomerCart,
  showCustomerPayment,
  showCustomerPaid,
  showCustomerRejected,
  clearCustomerDisplay,
} from "@/lib/customer-display";
import {
  ShoppingCart,
  Trash2,
  CreditCard,
  Landmark,
  Banknote,
  Wallet,
  X,
  Receipt,
  Minus,
  Plus,
  Package,
  Clock,
  Link,
  Volume2,
  Building2,
  Sparkles,
  UserRound,
} from "lucide-react";
import SaleSuccessModal from "@/components/pos/sale-success-modal";
import { QRCodeCanvas } from "qrcode.react";

declare global {
  interface Window {
    __sumupCheckoutRef?: string;
  }
}

// ─── helpers ───────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);

type SoloStatus = "waiting" | "processing" | "found" | "rejected" | "timeout";

const SOLO_TIMEOUT_SECONDS = 180;

const soloStatusCopy: Record<
  SoloStatus,
  {
    icon: string;
    title: string;
    subtitle: string;
    badge: string;
    badgeClass: string;
    ringClass: string;
  }
> = {
  waiting: {
    icon: "💳",
    title: "Esperando pago en SumUp SOLO",
    subtitle: "Pídele al cliente que acerque, inserte o deslice su tarjeta en la máquina.",
    badge: "Esperando tarjeta",
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    ringClass: "border-amber-500/30 bg-amber-500/10",
  },
  processing: {
    icon: "🔄",
    title: "Procesando pago",
    subtitle: "El sistema está consultando la confirmación de SumUp. No cierres esta ventana.",
    badge: "Procesando",
    badgeClass: "border-blue-500/20 bg-blue-500/10 text-blue-300",
    ringClass: "border-blue-500/30 bg-blue-500/10",
  },
  found: {
    icon: "✅",
    title: "Pago confirmado",
    subtitle: "Venta registrada correctamente. Cerrando automáticamente...",
    badge: "Aprobado",
    badgeClass: "border-green-500/20 bg-green-500/10 text-green-300",
    ringClass: "border-green-500/30 bg-green-500/10",
  },
  rejected: {
    icon: "❌",
    title: "Pago rechazado",
    subtitle: "El pago fue rechazado, cancelado o expiró. El stock no fue descontado.",
    badge: "Rechazado",
    badgeClass: "border-red-500/20 bg-red-500/10 text-red-300",
    ringClass: "border-red-500/30 bg-red-500/10",
  },
  timeout: {
    icon: "⏱️",
    title: "Seguimos esperando confirmación",
    subtitle: "No se recibió respuesta automática en el tiempo esperado. Revisa la máquina antes de entregar el producto.",
    badge: "Tiempo agotado",
    badgeClass: "border-zinc-500/20 bg-zinc-500/10 text-zinc-300",
    ringClass: "border-zinc-500/30 bg-zinc-500/10",
  },
};

type LastSale = {
  id: string;
  number: number | string;
  total: number;
  method: string;
  clientName?: string | null;
  at: string;
};

function playPaymentSuccessSound() {
  if (typeof window === "undefined") return;

  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;

    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);

    [
      { freq: 880, start: 0, duration: 0.12 },
      { freq: 1174.66, start: 0.12, duration: 0.14 },
      { freq: 1567.98, start: 0.26, duration: 0.18 },
    ].forEach((note) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.start);
      osc.connect(gain);
      osc.start(ctx.currentTime + note.start);
      osc.stop(ctx.currentTime + note.start + note.duration);
    });

    setTimeout(() => ctx.close().catch(() => null), 900);
  } catch (error) {
    console.warn("No se pudo reproducir sonido de aprobación:", error);
  }
}

function focusSkuSearchInput() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent("arm-merch-focus-search"));

  setTimeout(() => {
    const inputs = Array.from(
      document.querySelectorAll("input"),
    ) as HTMLInputElement[];

    const searchInput =
      inputs.find((input) =>
        String(input.placeholder ?? "").toLowerCase().includes("sku"),
      ) ||
      inputs.find((input) =>
        String(input.placeholder ?? "").toLowerCase().includes("buscar"),
      );

    searchInput?.focus();
    searchInput?.select?.();
  }, 250);
}

function formatCustomerName(value: string) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

type CustomerSuggestion = {
  name: string;
  email: string | null;
  phone: string | null;
};


// ─── CartItemRow ────────────────────────────────────────────────────────────
function CartItemRow({
  item,
  onUpdateQty,
  onRemove,
  isProduction,
  onToggleProduction,
}: {
  item: CartItem;
  onUpdateQty: (qty: number) => void;
  onRemove: () => void;
  isProduction?: boolean;
  onToggleProduction: () => void;
}) {
  const lineTotal = item.unit_price * item.quantity;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 30, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl border border-white/6 bg-white/[0.025] p-3"
    >
      <div className="flex items-start gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-xl">
          {item.product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.product.image_url}
              alt={item.product.name}
              className="h-10 w-10 rounded-xl object-cover"
            />
          ) : (
            "📦"
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-white">
            {item.product.name}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {fmt(item.unit_price)} c/u
            {(item.variant_value || item.size) && (
              <span className="ml-1.5 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-400">
                {item.variant_type === 'tamaño'
                  ? `Tamaño ${item.variant_value}`
                  : `Talla ${item.variant_value ?? item.size}`}
              </span>
            )}
          </p>
        </div>

        <button
          onClick={onRemove}
          className="rounded-lg p-1 text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
          aria-label="Quitar"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-xl bg-black/30 px-1.5 py-1">
          <button
            onClick={() => onUpdateQty(item.quantity - 1)}
            className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 text-white transition hover:bg-white/10"
          >
            <Minus size={11} />
          </button>
          <span className="w-7 text-center text-sm font-bold text-white">
            {item.quantity}
          </span>
          <button
            onClick={() => onUpdateQty(item.quantity + 1)}
            disabled={item.quantity >= item.product.stock}
            className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 text-white transition hover:bg-white/10 disabled:opacity-30"
          >
            <Plus size={11} />
          </button>
        </div>
        <span className="text-sm font-bold text-white">{fmt(lineTotal)}</span>
      </div>

      <button
        type="button"
        onClick={onToggleProduction}
        className={`mt-3 flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
          isProduction
            ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
            : "border-white/8 bg-white/[0.025] text-zinc-500 hover:border-white/15 hover:text-zinc-300"
        }`}
      >
        <span className="flex items-center gap-2">
          {isProduction ? <Clock size={13} /> : <Package size={13} />}
          {isProduction ? "Enviar a producción" : "Entrega inmediata"}
        </span>

        <span
          className={`h-4 w-7 rounded-full p-0.5 transition ${
            isProduction ? "bg-violet-500" : "bg-zinc-700"
          }`}
        >
          <span
            className={`block h-3 w-3 rounded-full bg-white transition ${
              isProduction ? "translate-x-3" : "translate-x-0"
            }`}
          />
        </span>
      </button>
    </motion.div>
  );
}

// ─── PaymentPill ────────────────────────────────────────────────────────────
function PaymentPill({
  option,
  active,
  onClick,
  shortcut,
}: {
  option: { key: string; label: string; icon: React.ElementType };
  active: boolean;
  onClick: () => void;
  shortcut: string;
}) {
  const Icon = option.icon;
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 text-xs font-semibold transition-all duration-200 ${
        active
          ? "border-amber-500/60 bg-amber-500/20 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
          : "border-white/8 bg-white/[0.03] text-zinc-400 hover:border-white/15 hover:bg-white/[0.06] hover:text-zinc-200"
      }`}
    >
      <Icon size={16} />
      <span className="leading-none">{option.label}</span>
      <span
        className={`absolute right-1.5 top-1.5 text-[9px] font-bold ${
          active ? "text-amber-500/70" : "text-zinc-600"
        }`}
      >
        {shortcut}
      </span>
    </button>
  );
}

// ─── componente principal ───────────────────────────────────────────────────

export default function Cart({ onClose }: { onClose?: () => void }) {
  const supabase = createClient();
  const {
    items,
    paymentMethod,
    setPaymentMethod,
    clientName,
    clientEmail,
    notes,
    setClientName,
    setClientEmail,
    setNotes,
    updateQuantity,
    removeItem,
    clearCart,
    subtotal,
    total,
    itemCount,
  } = useCart();

  // ── UI state ──
  // Cleanup polling on unmount
  useEffect(
    () => () => {
      if (sumupPollRef.current) clearInterval(sumupPollRef.current);
      if (soloAutoCloseRef.current) clearTimeout(soloAutoCloseRef.current);
    },
    [],
  );

  const [clientPhone, setClientPhone] = useState("");
  const [cardType, setCardType] = useState<"debit" | "credit">("debit");
  const [installments, setInstallments] = useState(1);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
  const [showPaymentQR, setShowPaymentQR] = useState(false);
  const [paymentQrTotal, setPaymentQrTotal] = useState(0);
  const [paymentQrStatus, setPaymentQrStatus] = useState<
    "pending" | "paid" | "rejected"
  >("pending");
  const [paymentQrMessage, setPaymentQrMessage] = useState(
    "Esperando confirmación automática del pago...",
  );
  const [whatsappLinkStatus, setWhatsappLinkStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [whatsappLinkMessage, setWhatsappLinkMessage] = useState<string | null>(
    null,
  );
  const [paymentQrCheckoutId, setPaymentQrCheckoutId] = useState<string | null>(
    null,
  );
  const [paymentQrCheckoutRef, setPaymentQrCheckoutRef] = useState<
    string | null
  >(null);
  const [sumupSmartOpen, setSumupSmartOpen] = useState(false);
  const [sumupSmartOrder, setSumupSmartOrder] = useState<{
    id: string;
    number: string | number;
    total: number;
    checkoutId?: string | null;
    checkoutReference?: string | null;
    cardType?: "debit" | "credit";
    installments?: number;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);
  const [recentTxList, setRecentTxList] = useState<any[]>([]);
  const [txCode, setTxCode] = useState("");
  const [showTransferQR, setShowTransferQR] = useState(false);
  const [transferTotal, setTransferTotal] = useState(0);
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashReceived, setCashReceived] = useState("0");
  const [cashError, setCashError] = useState<string | null>(null);
  const [sumupPolling, setSumupPolling] = useState(false);
  const [sumupStatus, setSumupStatus] = useState<SoloStatus>("waiting");
  const [soloCountdown, setSoloCountdown] = useState(SOLO_TIMEOUT_SECONDS);
  const sumupPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soloAutoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [isPendingDelivery, setIsPendingDelivery] = useState(false);
  const [productionItems, setProductionItems] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<{
    id: string;
    number: number | string;
    total: number;
    emailSent?: boolean;
  } | null>(null);
  const [lastSale, setLastSale] = useState<LastSale | null>(null);
  const [campusBrandName, setCampusBrandName] = useState("ARM Merch");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerSuggestion[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerSuggestionsOpen, setCustomerSuggestionsOpen] = useState(false);


  const registerLastSale = (sale: LastSale) => {
    setLastSale(sale);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("arm-merch-last-sale", JSON.stringify(sale));
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedSale = window.localStorage.getItem("arm-merch-last-sale");
    if (savedSale) {
      try {
        setLastSale(JSON.parse(savedSale));
      } catch {
        window.localStorage.removeItem("arm-merch-last-sale");
      }
    }

    const savedSound = window.localStorage.getItem("arm-merch-sound-enabled");
    if (savedSound !== null) {
      setSoundEnabled(savedSound === "true");
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("arm-merch-sound-enabled", String(soundEnabled));
    }
  }, [soundEnabled]);

  useEffect(() => {
    const query = clientName.trim();

    if (query.length < 2) {
      setCustomerSuggestions([]);
      setCustomerSuggestionsOpen(false);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setCustomerSearchLoading(true);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setCustomerSearchLoading(false);
          return;
        }

        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          setCustomerSuggestions([]);
          setCustomerSuggestionsOpen(false);
          setCustomerSearchLoading(false);
          return;
        }

        const suggestions = Array.isArray(data?.customers) ? data.customers : [];

        setCustomerSuggestions(suggestions);
        setCustomerSuggestionsOpen(suggestions.length > 0);
      } catch {
        setCustomerSuggestions([]);
        setCustomerSuggestionsOpen(false);
      } finally {
        setCustomerSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [clientName, supabase]);

  function selectCustomerSuggestion(customer: CustomerSuggestion) {
    setClientName(formatCustomerName(customer.name));

    if (customer.email) {
      setClientEmail(customer.email.toLowerCase());
    }

    if (customer.phone) {
      setClientPhone(customer.phone);
    }

    setCustomerSuggestionsOpen(false);
  }


  useEffect(() => {
    let mounted = true;

    async function loadCampusBranding() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user?.id) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("campus_id")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!mounted || !profile?.campus_id) return;

        const { data: campus } = await supabase
          .from("campuses")
          .select("name")
          .eq("id", profile.campus_id)
          .maybeSingle();

        if (mounted && campus?.name) {
          setCampusBrandName(campus.name);
        }
      } catch {
        // Branding es visual y no debe interrumpir el POS.
      }
    }

    loadCampusBranding();

    return () => {
      mounted = false;
    };
  }, []);

  const cashReceivedAmount = useMemo(() => {
    const digits = cashReceived.replace(/\D/g, "");
    return Number(digits || 0);
  }, [cashReceived]);

  const cashChange = Math.max(0, cashReceivedAmount - total());
  const cashMissing = Math.max(0, total() - cashReceivedAmount);
  const cashInputDisplay = cashReceivedAmount === 0
    ? "0"
    : cashReceivedAmount.toLocaleString("es-CL");

  const setCashAmount = (value: number) => {
    const safeValue = Math.max(0, Math.round(Number(value) || 0));
    setCashReceived(String(safeValue));
    setCashError(null);
  };

  const getFulfillmentType = (productId: string) =>
    productionItems[productId] ? "production" : "immediate";

  const hasProductionItems = useMemo(
    () => items.some((item) => productionItems[item.product.id]),
    [items, productionItems],
  );

  const toggleProductionItem = (productId: string) => {
    setProductionItems((current) => ({
      ...current,
      [productId]: !current[productId],
    }));
  };

  const canSubmit = useMemo(
    () =>
      items.length > 0 &&
      clientName.trim().length > 0 &&
      !submitting &&
      !sumupPolling &&
      !sumupSmartOpen,
    [items.length, clientName, submitting, sumupPolling, sumupSmartOpen],
  );

  const paymentOptions = [
    { key: "efectivo", label: "Efectivo", icon: Banknote },
    { key: "transferencia", label: "Transfer.", icon: Landmark },
    { key: "solo", label: "SumUp SOLO", icon: CreditCard },
    { key: "link", label: "Link pago", icon: Link },
  ];

  // 🔥 Actualiza el stock visual del catálogo sin recargar la página.
  // El backend ya descuenta inventario; esto solo sincroniza la UI del POS al instante.
  const notifyLocalStockDiscount = () => {
    if (typeof window === "undefined" || items.length === 0) return;

    window.dispatchEvent(
      new CustomEvent("arm-merch-stock-update", {
        detail: {
          items: items.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
          })),
        },
      }),
    );
  };

  // ── QR SumUp: confirmar pago por webhook + polling fallback ───────────────
  useEffect(() => {
    if (!showPaymentQR || !createdOrder?.id || !paymentQrCheckoutId) return;

    let stopped = false;
    let attempts = 0;
    const maxAttempts = 45; // 45 * 4s = 3 minutos

    const stopPolling = () => {
      stopped = true;
    };

    const handleStatus = (statusValue: string | null | undefined) => {
      const status = String(statusValue ?? "").toLowerCase();
      console.log("[POS QR] Estado recibido:", status);

      if (["paid", "pagado", "approved", "completed", "success", "successful"].includes(status)) {
        setPaymentQrStatus("paid");
        setPaymentQrMessage("✅ Pago confirmado correctamente. Inventario descontado.");
        stopPolling();

        setTimeout(() => {
          if (stopped) {
            setShowPaymentQR(false);
            setPaymentLinkUrl(null);
            if (soundEnabled) playPaymentSuccessSound();
            notifyLocalStockDiscount();

            if (createdOrder) {
              showCustomerPaid({
                items: items.map((item) => ({
                  id: item.product.id,
                  name: item.product.name,
                  variant: item.variant_value ?? item.size ?? null,
                  image_url: item.product.image_url ?? null,
                  quantity: item.quantity,
                  unit_price: item.unit_price,
                  subtotal: item.unit_price * item.quantity,
                })),
                total: createdOrder.total,
                payment_method: "link",
                order_number: createdOrder.number,
              });

              registerLastSale({
                id: createdOrder.id,
                number: createdOrder.number,
                total: createdOrder.total,
                method: "Link de pago",
                clientName: clientName.trim() || null,
                at: new Date().toISOString(),
              });
            }

            setSuccessOpen(true);
            clearCart();

            setTimeout(() => {
              onClose?.();
              focusSkuSearchInput();
            }, 250);
          }
        }, 900);

        return true;
      }

      if (["cancelled", "canceled", "failed", "declined", "rejected", "expired", "timeout"].includes(status)) {
        setPaymentQrStatus("rejected");
        setPaymentQrMessage("❌ Pago rechazado, expirado o no confirmado. El stock NO fue descontado.");

        showCustomerRejected({
          items: items.map((item) => ({
            id: item.product.id,
            name: item.product.name,
            variant: item.variant_value ?? item.size ?? null,
            image_url: item.product.image_url ?? null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.unit_price * item.quantity,
          })),
          total: total(),
          payment_method: "link",
        });
        stopPolling();
        return true;
      }

      return false;
    };

    const checkOrderStatus = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("status")
        .eq("id", createdOrder.id)
        .maybeSingle();

      if (!stopped && !error && data?.status) {
        handleStatus(data.status);
      }
    };

    const checkSumUpCheckout = async (forceCancel = false) => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const res = await fetch("/api/sumup/check-checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            order_id: createdOrder.id,
            checkout_id: paymentQrCheckoutId,
            checkout_reference: paymentQrCheckoutRef,
            force_cancel: forceCancel,
          }),
        });

        const data = await res.json().catch(() => null);
        console.log("[POS QR] check-checkout response:", data);

        const status = data?.order_status ?? data?.status ?? data?.sumup_status;
        if (!stopped && status) {
          handleStatus(status);
        }
      } catch (error) {
        console.error("SumUp checkout polling error:", error);
      }
    };

    const channel = supabase
      .channel(`order-payment-${createdOrder.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${createdOrder.id}`,
        },
        (payload) => {
          handleStatus((payload.new as any)?.status);
        },
      )
      .subscribe();

    checkOrderStatus();
    checkSumUpCheckout();

    const interval = setInterval(() => {
      if (stopped) {
        clearInterval(interval);
        return;
      }

      attempts += 1;

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        checkSumUpCheckout(true);
        handleStatus("timeout");
        return;
      }

      checkOrderStatus();
      checkSumUpCheckout();
    }, 2000);

    return () => {
      stopped = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [
    showPaymentQR,
    createdOrder?.id,
    paymentQrCheckoutId,
    paymentQrCheckoutRef,
  ]);

  async function startSoloPolling(order: {
    id: string;
    number: string | number;
    total: number;
    checkoutId?: string | null;
    checkoutReference?: string | null;
    cardType?: "debit" | "credit";
    installments?: number;
  }) {
    if (sumupPollRef.current) clearInterval(sumupPollRef.current);
    if (soloAutoCloseRef.current) clearTimeout(soloAutoCloseRef.current);

    setSoloCountdown(SOLO_TIMEOUT_SECONDS);
    setSumupPolling(true);
    setSumupStatus("waiting");
    setVerifyError(null);
    setVerifySuccess("Cobro enviado a la máquina SumUp SOLO. Esperando acción del cliente...");

    let attempts = 0;
    const maxAttempts = 90; // 90 * 2s = 3 minutos

    const clearSoloPolling = () => {
      if (sumupPollRef.current) {
        clearInterval(sumupPollRef.current);
        sumupPollRef.current = null;
      }
    };

    const finishAsPaid = (data: any) => {
      clearSoloPolling();

      setSumupPolling(false);
      setSumupStatus("found");
      setSoloCountdown(0);
      setVerifyError(null);
      setVerifySuccess("Pago aprobado en SumUp SOLO. Venta registrada correctamente.");

      setCreatedOrder({
        id: order.id,
        number: data?.order_number ?? order.number,
        total: order.total,
        emailSent: Boolean(data?.email_sent),
      });

      if (soundEnabled) playPaymentSuccessSound();

      notifyLocalStockDiscount();
      registerLastSale({
        id: order.id,
        number: data?.order_number ?? order.number,
        total: order.total,
        method:
          order.cardType === "credit"
            ? `SumUp SOLO Crédito ${order.installments ?? 1} cuotas`
            : "SumUp SOLO Débito",
        clientName: clientName.trim() || null,
        at: new Date().toISOString(),
      });
      setClientPhone("");

      if (soloAutoCloseRef.current) clearTimeout(soloAutoCloseRef.current);

      soloAutoCloseRef.current = setTimeout(() => {
        setVerifyError(null);
        setVerifySuccess(null);
        setTxCode("");
        setSuccessOpen(true);
        clearCart();

        setTimeout(() => {
          onClose?.();
          focusSkuSearchInput();
        }, 250);

        setTimeout(() => {
          setSumupSmartOpen(false);
          setSumupStatus("waiting");
          setSoloCountdown(SOLO_TIMEOUT_SECONDS);
          focusSkuSearchInput();
        }, 300);
      }, 2300);
    };

    const finishAsRejected = () => {
      clearSoloPolling();

      setSumupPolling(false);
      setSumupStatus("rejected");
      setVerifySuccess(null);
      setVerifyError("El pago fue rechazado, cancelado o expiró. La orden quedó sin confirmar.");
    };

    const finishAsTimeout = () => {
      clearSoloPolling();

      setSumupPolling(false);
      setSumupStatus("timeout");
      setVerifySuccess(null);
      setVerifyError("No se recibió confirmación automática en 3 minutos. Revisa la máquina antes de entregar el producto.");
    };

    const checkOrderStatusFromDB = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("status, order_number")
        .eq("id", order.id)
        .maybeSingle();

      if (error || !data?.status) return null;

      return {
        status: String(data.status).toLowerCase(),
        order_number: data.order_number,
      };
    };

    const check = async () => {
      attempts += 1;
      const secondsLeft = Math.max(0, SOLO_TIMEOUT_SECONDS - attempts * 2);
      setSoloCountdown(secondsLeft);

      if (attempts > 1) {
        setSumupStatus((current) =>
          current === "waiting" ? "processing" : current
        );
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setVerifyError("Sesión expirada. Recarga la página.");
          clearSoloPolling();
          setSumupPolling(false);
          return;
        }

        const dbStatus = await checkOrderStatusFromDB();

        if (dbStatus?.status === "paid") {
          finishAsPaid({
            order_number: dbStatus.order_number ?? order.number,
            email_sent: true,
          });
          return;
        }

        if (["cancelled", "canceled", "failed", "declined", "rejected", "expired", "timeout"].includes(dbStatus?.status ?? "")) {
          finishAsRejected();
          return;
        }

        const res = await fetch("/api/sumup/solo-status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            order_id: order.id,
            checkout_id: order.checkoutId,
            checkout_reference: order.checkoutReference,
          }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          setVerifyError(data?.error ?? "No se pudo consultar el estado del pago SOLO.");
          return;
        }

        const orderStatus = String(
          data?.order_status ?? data?.status ?? data?.sumup_status ?? ""
        ).toLowerCase();

        const readerStatusText = String(
          data?.reader_status ??
            data?.sumup_status ??
            data?.message ??
            "Esperando respuesta del cliente..."
        );

        if (data?.final !== true && attempts > 1) {
          setSumupStatus("processing");
        }

        setVerifySuccess(`SOLO: ${readerStatusText}`);

        if (
          data?.final === true &&
          (data?.paid === true ||
            ["paid", "pagado", "approved", "completed", "success", "successful"].includes(orderStatus))
        ) {
          finishAsPaid(data);
          return;
        }

        if (
          data?.final === true &&
          (data?.paid === false ||
            ["cancelled", "canceled", "failed", "declined", "rejected", "expired", "timeout"].includes(orderStatus))
        ) {
          finishAsRejected();
          return;
        }

        if (attempts >= maxAttempts) {
          finishAsTimeout();
        }
      } catch (error: any) {
        setVerifyError(error?.message ?? "Error consultando el pago SOLO.");
      }
    };

    await check();
    sumupPollRef.current = setInterval(check, 2000);
  }

  // ── confirmar venta ──
  // ── Verificar pago Smart POS en SumUp ─────────────────────────────────────
  async function handleVerifySumup() {
    if (!sumupSmartOrder?.id) {
      setVerifyError("No hay una orden Smart POS activa.");
      return;
    }

    if (!txCode.trim()) {
      setVerifyError("Ingresa el código de transacción del Smart POS.");
      return;
    }

    setVerifying(true);
    setVerifyError(null);
    setVerifySuccess(null);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setVerifyError("Sesión expirada. Recarga la página.");
        setVerifying(false);
        return;
      }

      const res = await fetch("/api/sumup/verify-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          order_id: sumupSmartOrder.id,
          tx_code: txCode.trim().toUpperCase(),
          amount: sumupSmartOrder.total,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setVerifyError(
          data?.message || data?.error || "No se pudo validar la transacción en SumUp.",
        );
        setVerifying(false);
        return;
      }

      window.dispatchEvent(
        new CustomEvent("arm-merch-stock-update", {
          detail: {
            items: items.map((i) => ({
              product_id: i.product.id,
              quantity: i.quantity,
            })),
          },
        }),
      );

      setVerifySuccess(
        `✅ Pago verificado · TX: ${data.tx_code ?? txCode.trim().toUpperCase()}`,
      );
      setSumupStatus("found");
      setCreatedOrder({
        id: sumupSmartOrder.id,
        number: data.order_number ?? sumupSmartOrder.number,
        total: sumupSmartOrder.total,
        emailSent: data.email_sent,
      });
      if (soundEnabled) playPaymentSuccessSound();
      registerLastSale({
        id: sumupSmartOrder.id,
        number: data.order_number ?? sumupSmartOrder.number,
        total: sumupSmartOrder.total,
        method: "Smart POS",
        clientName: clientName.trim() || null,
        at: new Date().toISOString(),
      });
      setClientPhone("");
      clearCart();

            setTimeout(() => {
              onClose?.();
              focusSkuSearchInput();
            }, 250);
    } catch (e: any) {
      setVerifyError(e?.message ?? "Error inesperado validando Smart POS");
    }

    setVerifying(false);
  }

  async function sendPaymentLinkByWhatsApp({
    orderId,
    orderNumber,
    paymentUrl,
    amount,
  }: {
    orderId: string;
    orderNumber: string | number;
    paymentUrl: string;
    amount: number;
  }) {
    const phone = clientPhone.trim();

    if (!phone) {
      setWhatsappLinkStatus("idle");
      setWhatsappLinkMessage("Ingresa un WhatsApp si quieres enviar el link al cliente.");
      return;
    }

    setWhatsappLinkStatus("sending");
    setWhatsappLinkMessage("Enviando link de pago por WhatsApp...");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setWhatsappLinkStatus("error");
        setWhatsappLinkMessage("Sesión expirada. No se pudo enviar WhatsApp.");
        return;
      }

      const res = await fetch("/api/whatsapp/send-payment-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          phone,
          client_name: clientName.trim() || "Cliente",
          order_id: orderId,
          order_number: orderNumber,
          total: amount,
          payment_url: paymentUrl,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setWhatsappLinkStatus("error");
        setWhatsappLinkMessage(
          data?.error || "No se pudo enviar el link por WhatsApp.",
        );
        return;
      }

      setWhatsappLinkStatus("sent");
      setWhatsappLinkMessage("✅ Link enviado por WhatsApp correctamente.");
    } catch (error: any) {
      setWhatsappLinkStatus("error");
      setWhatsappLinkMessage(
        error?.message || "Error enviando link por WhatsApp.",
      );
    }
  }

  async function handleConfirmCashSale() {
    const orderTotal = total();

    if (cashReceivedAmount < orderTotal) {
      setCashError(
        `El efectivo recibido debe ser igual o mayor al total (${fmt(orderTotal)}).`,
      );
      return;
    }

    setCashError(null);
    setSubmitting(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Sesión expirada.");
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("campus_id")
        .eq("id", session.user.id)
        .single();

      const cashNotes = [
        notes.trim() || null,
        `Efectivo recibido: ${fmt(cashReceivedAmount)}`,
        `Vuelto: ${fmt(cashChange)}`,
      ]
        .filter(Boolean)
        .join(" | ");

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          campus_id: profile?.campus_id ?? null,
          items: items.map((i) => ({
            product_id: i.product.id,
            quantity: i.quantity,
            unit_price: i.unit_price,
            discount_pct: i.discount_pct,
            size: i.size ?? null,
            variant_type: i.variant_type ?? null,
            variant_value: i.variant_value ?? i.size ?? null,
            fulfillment_type: getFulfillmentType(i.product.id),
          })),
          client_name: clientName.trim(),
          client_email: clientEmail.trim() || null,
          client_phone: clientPhone.trim() || null,
          payment_method: "efectivo",
          discount: 0,
          notes: cashNotes || null,
          delivery_status: hasProductionItems ? "pending" : null,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Error al registrar la venta en efectivo.");
      }

      setIsPendingDelivery(false);
      setProductionItems({});
      setCreatedOrder({
        id: data.order_id,
        number: data.order_number ?? data.order_id,
        total: orderTotal,
        emailSent: data.email_sent,
      });

      setPaymentLinkUrl(null);
      if (soundEnabled) playPaymentSuccessSound();
      notifyLocalStockDiscount();
      registerLastSale({
        id: data.order_id,
        number: data.order_number ?? data.order_id,
        total: orderTotal,
        method: "Efectivo",
        clientName: clientName.trim() || null,
        at: new Date().toISOString(),
      });

      setShowCashModal(false);
      setCashReceived("0");
      setCashError(null);
      setSuccessOpen(true);
      setClientPhone("");
      clearCart();

            setTimeout(() => {
              onClose?.();
              focusSkuSearchInput();
            }, 250);
    } catch (err: any) {
      setCashError(err?.message || "Error inesperado registrando efectivo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmSale() {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token)
        throw new Error("Sesión expirada.");

      const { data: profile } = await supabase
        .from("profiles")
        .select("campus_id")
        .eq("id", session.user.id)
        .single();

      if (paymentMethod === "efectivo") {
        setCashReceived("0");
        setCashError(null);
        setShowCashModal(true);
        setSubmitting(false);
        return;
      }

      // ── SumUp SOLO Cloud API: envía el cobro directo a la máquina ──
      if (paymentMethod === "solo") {
        if (sumupSmartOpen || sumupPolling) {
          setVerifyError("Ya hay un cobro SOLO en curso. Finaliza o cancela el cobro actual antes de iniciar otro.");
          setSubmitting(false);
          return;
        }

        const orderRes = await fetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            campus_id: profile?.campus_id ?? null,
            payment_method: "sumup",
            items: items.map((i) => ({
              product_id: i.product.id,
              quantity: i.quantity,
              unit_price: i.unit_price,
              discount_pct: i.discount_pct,
              size: i.size ?? null,
            variant_type: i.variant_type ?? null,
            variant_value: i.variant_value ?? i.size ?? null,
              fulfillment_type: getFulfillmentType(i.product.id),
            })),
            client_name: clientName.trim() || null,
            client_email: clientEmail.trim() || null,
            client_phone: clientPhone.trim() || null,
            notes: "SumUp SOLO - pago enviado al lector",
            delivery_status: hasProductionItems ? "pending" : null,
          }),
        });

        const orderData = await orderRes.json().catch(() => null);

        if (!orderRes.ok) {
          setVerifyError(orderData?.error ?? "Error al registrar la orden SOLO");
          setSubmitting(false);
          return;
        }

        const orderId = orderData.order_id;
        const orderNumber = orderData.order_number ?? orderId;
        const orderTotal = total();

        const soloRes = await fetch("/api/sumup/solo-checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            order_id: orderId,
            amount: orderTotal,
            card_type: cardType,
            installments: cardType === "credit" ? installments : 1,
          }),
        });

        const soloData = await soloRes.json().catch(() => null);

        if (!soloRes.ok || !soloData?.success) {
          setVerifyError(soloData?.error ?? "No se pudo enviar el cobro a SumUp SOLO");
          setSubmitting(false);
          return;
        }

        const orderPayload = {
          id: orderId,
          number: orderNumber,
          total: orderTotal,
          checkoutId: soloData?.checkout_id ?? null,
          checkoutReference: soloData?.checkout_reference ?? null,
          cardType,
          installments: cardType === "credit" ? installments : 1,
        };

        setSumupSmartOrder(orderPayload);
        setTxCode("");
        setVerifyError(null);
        setVerifySuccess(
          `Cobro enviado a ${soloData?.reader?.name ?? "SumUp SOLO"} · ${
            cardType === "credit"
              ? `Crédito ${installments} cuotas`
              : "Débito"
          }`,
        );
        setSumupStatus("waiting");
        setSumupSmartOpen(true);
        setSubmitting(false);

        await startSoloPolling(orderPayload);
        return;
      }

      // ── Si es Smart POS, crear orden pending y pedir código TX ──
      if (paymentMethod === "sumup") {
        const supabase = createClient();
        const {
          data: { session: authSession },
        } = await supabase.auth.getSession();

        if (!authSession?.access_token) {
          setVerifyError("Sesión expirada. Recarga la página.");
          setSubmitting(false);
          return;
        }

        const orderRes = await fetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authSession.access_token}`,
          },
          body: JSON.stringify({
            payment_method: "sumup",
            items: items.map((i) => ({
              product_id: i.product.id,
              quantity: i.quantity,
              size: i.size ?? null,
            variant_type: i.variant_type ?? null,
            variant_value: i.variant_value ?? i.size ?? null,
              unit_price: i.product.price,
              fulfillment_type: getFulfillmentType(i.product.id),
            })),
            client_name: clientName.trim() || null,
            client_email: clientEmail.trim() || null,
            client_phone: clientPhone.trim() || null,
            notes: "Smart POS SumUp - pendiente de validación TX",
            delivery_status: hasProductionItems ? "pending" : null,
          }),
        });

        const orderData = await orderRes.json().catch(() => null);

        if (!orderRes.ok) {
          setVerifyError(orderData?.error ?? "Error al registrar la orden Smart POS");
          setSubmitting(false);
          return;
        }

        const orderId = orderData.order_id;
        const orderNumber = orderData.order_number ?? orderId;
        const orderTotal = total();

        setSumupSmartOrder({
          id: orderId,
          number: orderNumber,
          total: orderTotal,
        });
        setTxCode("");
        setVerifyError(null);
        setVerifySuccess(null);
        setSumupStatus("waiting");
        setSumupSmartOpen(true);
        setSubmitting(false);

        return;
      }

      // ── Si es link de pago, crear checkout en SumUp primero ──
      // ── Si es transferencia, mostrar QR antes de confirmar ──
      if (paymentMethod === "transferencia") {
        setTransferTotal(total());
        setShowTransferQR(true);
        setSubmitting(false);
        return;
      }

      if (paymentMethod === "link") {
        const {
          data: { session: authSession },
        } = await supabase.auth.getSession();
        if (!authSession?.access_token) throw new Error("Sesión expirada.");

        const checkoutRes = await fetch("/api/sumup/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authSession.access_token}`,
          },
          body: JSON.stringify({
            amount: total(),
            currency: "CLP",
            description: `Pedido ARM Merch - ${clientName.trim()}`,
            order_id: `arm-${Date.now()}`,
          }),
        });

        const checkoutData = await checkoutRes.json();

        if (!checkoutRes.ok || !checkoutData.payment_url) {
          throw new Error(
            checkoutData?.error || "No se pudo crear el link de pago SumUp.",
          );
        }

        window.__sumupCheckoutRef = checkoutData.checkout_reference;
        setPaymentLinkUrl(checkoutData.payment_url);
        setPaymentQrCheckoutId(checkoutData.checkout_id);
        setPaymentQrCheckoutRef(checkoutData.checkout_reference);
        setPaymentQrTotal(total());
        setPaymentQrStatus("pending");
        setPaymentQrMessage("Esperando confirmación automática del pago...");

        showCustomerPayment({
          items: items.map((item) => ({
            id: item.product.id,
            name: item.product.name,
            variant: item.variant_value ?? item.size ?? null,
            image_url: item.product.image_url ?? null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.unit_price * item.quantity,
          })),
          total: total(),
          payment_method: "link",
          payment_url: checkoutData.payment_url,
        });

        setWhatsappLinkStatus("idle");
        setWhatsappLinkMessage(null);
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          campus_id: profile?.campus_id ?? null,
          items: items.map((i) => ({
            product_id: i.product.id,
            quantity: i.quantity,
            unit_price: i.unit_price,
            discount_pct: i.discount_pct,
            size: i.size ?? null,
            variant_type: i.variant_type ?? null,
            variant_value: i.variant_value ?? i.size ?? null,
            fulfillment_type: getFulfillmentType(i.product.id),
          })),
          client_name: clientName.trim(),
          client_email: clientEmail.trim() || null,
          client_phone: clientPhone.trim() || null,
          payment_method: paymentMethod,
          discount: 0,
          notes:
            paymentMethod === "link" && (window as any).__sumupCheckoutRef
              ? `sumup:${(window as any).__sumupCheckoutRef}`
              : notes.trim() || null,
          delivery_status: hasProductionItems ? "pending" : null,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(data?.error || "Error al registrar la venta.");

      const orderTotal = total();

      setIsPendingDelivery(false);
      setProductionItems({});
      setCreatedOrder({
        id: data.order_id,
        number: data.order_number ?? data.order_id,
        total: orderTotal,
        emailSent: data.email_sent,
      });

      if (paymentMethod === "link") {
        if (paymentLinkUrl) {
          await sendPaymentLinkByWhatsApp({
            orderId: data.order_id,
            orderNumber: data.order_number ?? data.order_id,
            paymentUrl: paymentLinkUrl,
            amount: orderTotal,
          });
        }

        setShowPaymentQR(true);
      } else {
        setPaymentLinkUrl(null);
        if (soundEnabled) playPaymentSuccessSound();
        notifyLocalStockDiscount();
        registerLastSale({
          id: data.order_id,
          number: data.order_number ?? data.order_id,
          total: orderTotal,
          method:
            paymentMethod === "efectivo"
              ? "Efectivo"
              : paymentMethod === "transferencia"
                ? "Transferencia"
                : paymentMethod,
          clientName: clientName.trim() || null,
          at: new Date().toISOString(),
        });
        setSuccessOpen(true);
        setClientPhone("");
        clearCart();

        setTimeout(() => {
          onClose?.();
          focusSkuSearchInput();
        }, 250);
      }
    } catch (err: any) {
      setVerifyError(err?.message || "Error inesperado");
      setSubmitting(false);
    } finally {
      setSubmitting(false);
    }
  }

  // ── atajos de teclado ──
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "1") setPaymentMethod("efectivo");
      if (e.key === "2") setPaymentMethod("transferencia");
      if (e.key === "3") setPaymentMethod("solo");
      if (e.key === "4") setPaymentMethod("link");
      if (e.key === "Enter" && canSubmit) {
        e.preventDefault();
        handleConfirmSale();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canSubmit, paymentMethod, items.length, clientName]);


  // ── CUSTOMER DISPLAY LIVE SYNC ───────────────────────────────────────────
  useEffect(() => {
    if (items.length === 0) {
      clearCustomerDisplay();
      return;
    }

    showCustomerCart(
      items.map((item) => ({
        id: item.product.id,
        name: item.product.name,
        variant: item.variant_value ?? item.size ?? null,
        image_url: item.product.image_url ?? null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.unit_price * item.quantity,
      })),
      total(),
    );
  }, [items, total]);

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <>
      <aside className="flex h-full flex-col bg-[#0e0f14] text-white">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-white/6 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <ShoppingCart size={19} className="text-zinc-300" />
              <AnimatePresence>
                {itemCount() > 0 && (
                  <motion.span
                    key="badge"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-black"
                  >
                    {itemCount()}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div>
              <h2 className="text-[17px] font-bold tracking-tight">Carrito</h2>
              <div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                <Building2 size={10} />
                <span>{campusBrandName}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSoundEnabled((v) => !v)}
              className={`rounded-lg p-2 text-xs transition ${
                soundEnabled
                  ? "text-amber-400 hover:bg-amber-500/10"
                  : "text-zinc-600 hover:bg-white/5 hover:text-zinc-400"
              }`}
              title={soundEnabled ? "Sonido activado" : "Sonido desactivado"}
            >
              <Volume2 size={14} />
            </button>

            {items.length > 0 && (
              <button
                onClick={clearCart}
                disabled={sumupSmartOpen || sumupPolling}
                className="rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Vaciar
              </button>
            )}

            {onClose && (
              <button
                onClick={onClose}
                className="ml-1 rounded-xl border border-white/8 bg-white/[0.03] p-2 text-zinc-400 transition hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
                aria-label="Cerrar carrito"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* SCROLL AREA */}
        <div className="flex-1 overflow-y-auto">
          {/* ITEMS */}
          <div className="px-4 py-4">
            <AnimatePresence mode="popLayout">
              {items.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex min-h-[200px] flex-col items-center justify-center text-center"
                >
                  <ShoppingCart size={48} className="text-zinc-800" />
                  <p className="mt-3 text-sm text-zinc-600">
                    Selecciona productos del catálogo
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-2.5">
                  {items.map((item) => (
                    <CartItemRow
                      key={`${item.product.id}-${item.variant_value ?? item.size ?? 'default'}`}
                      item={item}
                      onUpdateQty={(qty) =>
                        updateQuantity(item.product.id, qty, item.variant_value ?? item.size ?? null)
                      }
                      onRemove={() => removeItem(item.product.id, item.variant_value ?? item.size ?? null)}
                      isProduction={Boolean(productionItems[item.product.id])}
                      onToggleProduction={() => toggleProductionItem(item.product.id)}
                    />
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>

          {items.length > 0 && (
            <div className="space-y-4 px-4 pb-6">
              {/* ÚLTIMA VENTA */}
              {lastSale && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-green-500/15 bg-green-500/[0.06] p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-green-300">
                      <Sparkles size={13} />
                      Última venta
                    </div>
                    <span className="rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                      {lastSale.method}
                    </span>
                  </div>

                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white">
                        #{lastSale.number}
                      </p>
                      <p className="truncate text-[11px] text-zinc-500">
                        {lastSale.clientName || "Cliente sin nombre"} ·{" "}
                        {new Date(lastSale.at).toLocaleTimeString("es-CL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <p className="text-sm font-black text-amber-400">
                      {fmt(lastSale.total)}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* DATOS DEL CLIENTE */}
              <div className="space-y-2.5">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Cliente <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    placeholder="Nombre del cliente"
                    value={clientName}
                    onChange={(e) => {
                      const formatted = formatCustomerName(e.target.value)
                      setClientName(formatted)
                      setCustomerSuggestionsOpen(true)
                    }}
                    onFocus={() => {
                      if (customerSuggestions.length > 0) {
                        setCustomerSuggestionsOpen(true)
                      }
                    }}
                    onBlur={() => {
                      const formatted = formatCustomerName(clientName).trim()
                      setClientName(formatted)

                      setTimeout(() => {
                        setCustomerSuggestionsOpen(false)
                      }, 180)
                    }}
                    className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-amber-500/40"
                  />

                  {customerSuggestionsOpen && (
                    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[80] overflow-hidden rounded-2xl border border-white/10 bg-[#15171d] shadow-2xl">
                      <div className="border-b border-white/6 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        {customerSearchLoading ? "Buscando cliente..." : "Clientes frecuentes"}
                      </div>

                      {customerSuggestions.map((customer) => (
                        <button
                          key={`${customer.name}-${customer.email ?? customer.phone ?? "sin-contacto"}`}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectCustomerSuggestion(customer)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.06]"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
                            <UserRound size={16} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-white">
                              {formatCustomerName(customer.name)}
                            </p>
                            <p className="truncate text-xs text-zinc-500">
                              {customer.email || customer.phone || "Sin correo registrado"}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  placeholder="Email (voucher por correo)"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-amber-500/40"
                />
                <input
                  placeholder="Teléfono WhatsApp (ej: +56912345678)"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  type="tel"
                  className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-amber-500/40"
                />
              </div>

              {/* NOTAS */}
              <div>
                <button
                  onClick={() => setShowNotes((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300"
                >
                  <Receipt size={12} />
                  {showNotes ? "Ocultar notas" : "Agregar nota a la venta"}
                </button>

                <AnimatePresence>
                  {showNotes && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ej: Cliente recoge mañana..."
                        rows={2}
                        className="mt-2 w-full resize-none rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-amber-500/40"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* PRODUCCIÓN POR PRODUCTO */}
              <div
                className={`rounded-2xl border p-3.5 ${
                  hasProductionItems
                    ? "border-violet-500/30 bg-violet-500/10"
                    : "border-white/6 bg-white/[0.02]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      hasProductionItems ? "bg-violet-500/20" : "bg-white/5"
                    }`}
                  >
                    {hasProductionItems ? (
                      <Clock size={16} className="text-violet-400" />
                    ) : (
                      <Package size={16} className="text-zinc-500" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold ${
                        hasProductionItems ? "text-violet-300" : "text-zinc-300"
                      }`}
                    >
                      Producción por producto
                    </p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-600">
                      Marca en cada producto si será entrega inmediata o si debe enviarse a producción.
                    </p>
                  </div>
                </div>
              </div>

              {/* MÉTODO DE PAGO */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Método de pago
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {paymentOptions.map((option, i) => (
                    <PaymentPill
                      key={option.key}
                      option={option}
                      active={paymentMethod === option.key}
                      onClick={() => setPaymentMethod(option.key)}
                      shortcut={String(i + 1)}
                    />
                  ))}
                </div>
              </div>

              {paymentMethod === "solo" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4"
                >
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      Tipo de tarjeta SOLO
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCardType("debit");
                          setInstallments(1);
                        }}
                        className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                          cardType === "debit"
                            ? "border-green-500/40 bg-green-500/15 text-green-300"
                            : "border-white/8 bg-white/[0.03] text-zinc-400 hover:border-white/15 hover:bg-white/[0.06]"
                        }`}
                      >
                        Débito
                      </button>

                      <button
                        type="button"
                        onClick={() => setCardType("credit")}
                        className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                          cardType === "credit"
                            ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                            : "border-white/8 bg-white/[0.03] text-zinc-400 hover:border-white/15 hover:bg-white/[0.06]"
                        }`}
                      >
                        Crédito
                      </button>
                    </div>
                  </div>

                  {cardType === "credit" && (
                    <div>
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                        Cuotas
                      </label>

                      <div className="grid grid-cols-5 gap-2">
                        {[1, 2, 3, 6, 12].map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => setInstallments(q)}
                            className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                              installments === q
                                ? "border-amber-500/40 bg-amber-500/20 text-amber-300"
                                : "border-white/8 bg-white/[0.03] text-zinc-400 hover:border-white/15 hover:bg-white/[0.06]"
                            }`}
                          >
                            {q}x
                          </button>
                        ))}
                      </div>

                      <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
                        Se enviará a SumUp SOLO el monto total y la cantidad de cuotas.
                        SumUp procesa el resto en el lector.
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* RESUMEN TOTAL */}
              <div className="rounded-2xl border border-white/6 bg-white/[0.025] p-4 space-y-2">
                <div className="flex justify-between text-sm text-zinc-400">
                  <span>
                    Subtotal ({itemCount()}{" "}
                    {itemCount() === 1 ? "ítem" : "ítems"})
                  </span>
                  <span>{fmt(subtotal())}</span>
                </div>

                <div className="border-t border-white/6 pt-2 flex items-end justify-between">
                  <span className="text-zinc-300 text-sm">Total a cobrar</span>
                  <motion.span
                    key={total()}
                    initial={{ scale: 1.08 }}
                    animate={{ scale: 1 }}
                    className="text-[26px] font-black tracking-tight text-white"
                  >
                    {fmt(total())}
                  </motion.span>
                </div>
              </div>

              {/* BOTÓN CONFIRMAR */}
              <motion.button
                whileHover={{ scale: canSubmit ? 1.01 : 1 }}
                whileTap={{ scale: canSubmit ? 0.98 : 1 }}
                onClick={handleConfirmSale}
                disabled={!canSubmit}
                className="relative w-full overflow-hidden rounded-3xl py-4 text-[17px] font-black text-black transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: canSubmit
                    ? isPendingDelivery
                      ? "#7c3aed"
                      : "#d97706"
                    : "#555",
                }}
              >
                {sumupSmartOpen || sumupPolling ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    Cobro SOLO en curso...
                  </span>
                ) : submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    Procesando...
                  </span>
                ) : hasProductionItems ? (
                  <span className="flex items-center justify-center gap-2">
                    <Clock size={18} />
                    Registrar venta · {fmt(total())}
                  </span>
                ) : paymentMethod === "efectivo" ? (
                  <span className="flex items-center justify-center gap-2">
                    <Banknote size={18} />
                    Cobrar efectivo · {fmt(total())}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <CreditCard size={18} />
                    Confirmar venta · {fmt(total())}
                  </span>
                )}
              </motion.button>

              <p className="text-center text-[10px] text-zinc-600">
                Presiona{" "}
                <kbd className="rounded bg-white/8 px-1 font-mono">Enter</kbd>{" "}
                para confirmar rápido
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Efectivo — Cálculo de vuelto */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            className="w-full max-w-sm rounded-3xl border border-zinc-700 bg-zinc-900 p-7 text-center shadow-2xl"
          >
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-green-500/25 bg-green-500/10 text-5xl">
              💵
            </div>

            <h2 className="mb-2 text-xl font-black text-white">
              Pago en efectivo
            </h2>

            <p className="mb-5 text-sm leading-relaxed text-zinc-400">
              Ingresa el efectivo recibido para calcular el vuelto antes de registrar la venta.
            </p>

            <div className="mb-5 space-y-3 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-4 text-left">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Total a cobrar</span>
                <span className="text-base font-black text-amber-400">
                  {fmt(total())}
                </span>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Efectivo recibido
                </label>
                <input
                  autoFocus
                  inputMode="numeric"
                  value={cashInputDisplay}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    setCashReceived(digits === "" ? "0" : String(Number(digits)));
                    setCashError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && cashReceivedAmount >= total()) {
                      e.preventDefault();
                      handleConfirmCashSale();
                    }
                  }}
                  placeholder="0"
                  className="w-full rounded-2xl border border-white/8 bg-black/25 px-4 py-3 text-center text-2xl font-black text-white placeholder-zinc-700 outline-none transition focus:border-green-500/40"
                />

                <div className="mt-3 grid grid-cols-4 gap-2">
                  {[
                    { label: "Exacto", value: total() },
                    { label: "+1K", value: total() + 1000 },
                    { label: "+5K", value: total() + 5000 },
                    { label: "+10K", value: total() + 10000 },
                  ].map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setCashAmount(option.value)}
                      className="rounded-xl border border-white/8 bg-white/[0.04] px-2 py-2 text-xs font-bold text-zinc-300 transition hover:border-green-500/30 hover:bg-green-500/10 hover:text-green-300"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/25 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Recibido</span>
                  <span className="font-bold text-white">
                    {fmt(cashReceivedAmount)}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-white/6 pt-3">
                  <span className="text-sm font-bold text-zinc-300">
                    {cashReceivedAmount >= total()
                      ? "Vuelto a entregar"
                      : "Falta por recibir"}
                  </span>
                  <span
                    className={`text-2xl font-black ${
                      cashReceivedAmount >= total()
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {cashReceivedAmount >= total()
                      ? fmt(cashChange)
                      : fmt(cashMissing)}
                  </span>
                </div>
              </div>
            </div>

            {cashError && (
              <p className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {cashError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setShowCashModal(false);
                  setCashError(null);
                  setSubmitting(false);
                }}
                className="rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.08]"
              >
                Cancelar
              </button>

              <button
                onClick={handleConfirmCashSale}
                disabled={submitting || cashReceivedAmount < total()}
                className="rounded-2xl bg-green-500 py-3 text-sm font-black text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? "Registrando..." : "Confirmar efectivo"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* SumUp SOLO — Flujo de pago */}
      {sumupSmartOpen && sumupSmartOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            className="w-full max-w-sm rounded-3xl border border-zinc-700 bg-zinc-900 p-7 text-center shadow-2xl"
          >
            {(() => {
              const copy = soloStatusCopy[sumupStatus];

              const progressPct =
                sumupStatus === "found"
                  ? 100
                  : sumupStatus === "timeout" || sumupStatus === "rejected"
                    ? 100
                    : Math.min(
                        100,
                        Math.max(
                          4,
                          ((SOLO_TIMEOUT_SECONDS - soloCountdown) /
                            SOLO_TIMEOUT_SECONDS) *
                            100,
                        ),
                      );

              return (
                <>
                  <motion.div
                    key={sumupStatus}
                    initial={{ scale: 0.86, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border text-5xl ${copy.ringClass}`}
                  >
                    {sumupStatus === "processing" ? (
                      <span className="inline-block animate-spin">↻</span>
                    ) : (
                      copy.icon
                    )}
                  </motion.div>

                  <div
                    className={`mx-auto mb-3 inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ${copy.badgeClass}`}
                  >
                    {copy.badge}
                  </div>

                  <h2 className="mb-2 text-xl font-black text-white">
                    {copy.title}
                  </h2>

                  <p className="mb-5 text-sm leading-relaxed text-zinc-400">
                    {copy.subtitle}
                  </p>

                  <div className="mb-5 space-y-3 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-4 text-left">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Orden</span>
                      <span className="font-bold text-white">
                        #{sumupSmartOrder.number}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Total enviado</span>
                      <span className="text-base font-black text-amber-400">
                        {fmt(sumupSmartOrder.total)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Tarjeta</span>
                      <span className="font-bold text-white">
                        {(sumupSmartOrder.cardType ?? cardType) === "credit"
                          ? "Crédito"
                          : "Débito"}
                      </span>
                    </div>

                    {(sumupSmartOrder.cardType ?? cardType) === "credit" && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500">Cuotas</span>
                        <span className="font-bold text-amber-400">
                          {sumupSmartOrder.installments ?? installments} cuotas
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Estado</span>
                      <span
                        className={`font-bold ${
                          sumupStatus === "found"
                            ? "text-green-400"
                            : sumupStatus === "rejected"
                              ? "text-red-400"
                              : sumupStatus === "timeout"
                                ? "text-zinc-300"
                                : "text-amber-400"
                        }`}
                      >
                        {copy.badge}
                      </span>
                    </div>

                    {(sumupStatus === "waiting" ||
                      sumupStatus === "processing") && (
                      <>
                        <div className="h-2 overflow-hidden rounded-full bg-black/35">
                          <motion.div
                            className="h-full rounded-full bg-amber-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPct}%` }}
                            transition={{ duration: 0.25 }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-zinc-500">
                          <span>Tiempo restante</span>
                          <span>{Math.max(0, soloCountdown)}s</span>
                        </div>
                      </>
                    )}
                  </div>

                  {verifySuccess && sumupStatus !== "found" && (
                    <p className="mb-3 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-300">
                      {verifySuccess}
                    </p>
                  )}

                  {verifyError && (
                    <p className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                      {verifyError}
                    </p>
                  )}

                  {sumupStatus === "found" && (
                    <p className="mb-4 rounded-xl border border-green-500/20 bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-300">
                      Venta lista. Abriendo comprobante...
                    </p>
                  )}

                  {(sumupStatus === "waiting" ||
                    sumupStatus === "processing") && (
                    <button
                      onClick={async () => {
                        try {
                          const {
                            data: { session },
                          } = await supabase.auth.getSession();

                          if (session?.access_token && sumupSmartOrder?.id) {
                            await fetch("/api/sumup/solo-terminate", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${session.access_token}`,
                              },
                              body: JSON.stringify({
                                order_id: sumupSmartOrder.id,
                              }),
                            });
                          }
                        } catch (e) {
                          console.error("Error cancelando SOLO:", e);
                        }

                        if (sumupPollRef.current)
                          clearInterval(sumupPollRef.current);
                        if (soloAutoCloseRef.current)
                          clearTimeout(soloAutoCloseRef.current);

                        setSumupPolling(false);
                        setSumupSmartOpen(false);
                        setVerifyError(null);
                        setVerifySuccess(null);
                        setTxCode("");
                        setSumupStatus("waiting");
                        setSoloCountdown(SOLO_TIMEOUT_SECONDS);
                        setSubmitting(false);
                      }}
                      className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 py-2.5 text-sm font-semibold text-red-300 transition hover:border-red-400 hover:bg-red-500/20 hover:text-white"
                    >
                      Cancelar cobro
                    </button>
                  )}

                  {sumupStatus === "timeout" && (
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={() => startSoloPolling(sumupSmartOrder)}
                        className="w-full rounded-2xl bg-amber-500 py-3 text-sm font-black text-black transition hover:bg-amber-400"
                      >
                        Reintentar monitoreo
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            const {
                              data: { session },
                            } = await supabase.auth.getSession();

                            if (session?.access_token && sumupSmartOrder?.id) {
                              await fetch("/api/sumup/solo-terminate", {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${session.access_token}`,
                                },
                                body: JSON.stringify({
                                  order_id: sumupSmartOrder.id,
                                }),
                              });
                            }
                          } catch (e) {
                            console.error("Error cancelando SOLO:", e);
                          }

                          if (sumupPollRef.current)
                            clearInterval(sumupPollRef.current);

                          setSumupPolling(false);
                          setSumupSmartOpen(false);
                          setVerifyError(null);
                          setVerifySuccess(null);
                          setTxCode("");
                          setSumupStatus("waiting");
                          setSoloCountdown(SOLO_TIMEOUT_SECONDS);
                          setSubmitting(false);
                        }}
                        className="w-full rounded-2xl border border-zinc-700 py-3 text-sm font-bold text-zinc-300 transition hover:bg-zinc-800"
                      >
                        Cancelar y volver al POS
                      </button>
                    </div>
                  )}

                  {sumupStatus === "rejected" && (
                    <button
                      onClick={() => {
                        if (sumupPollRef.current)
                          clearInterval(sumupPollRef.current);

                        setSumupPolling(false);
                        setSumupSmartOpen(false);
                        setVerifyError(null);
                        setVerifySuccess(null);
                        setTxCode("");
                        setSumupStatus("waiting");
                        setSoloCountdown(SOLO_TIMEOUT_SECONDS);
                        setSubmitting(false);
                      }}
                      className="w-full rounded-2xl bg-zinc-700 py-3 text-sm font-bold text-white transition hover:bg-zinc-600"
                    >
                      Volver al POS
                    </button>
                  )}
                </>
              );
            })()}
          </motion.div>
        </div>
      )}

      {/* Transferencia QR Modal */}
      {showTransferQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-700 bg-zinc-900 p-6 text-center shadow-2xl">
            <h2 className="mb-1 text-lg font-bold text-white">
              Pago por Transferencia
            </h2>
            <p className="mb-4 text-sm text-zinc-400">
              Muestra este QR al cliente
            </p>

            {/* QR Code - usando API gratuita */}
            <div className="mb-4 flex justify-center">
              <div className="rounded-2xl bg-white p-3">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&bgcolor=ffffff&color=000000&data=${encodeURIComponent("Banco Estado | Cta Corriente\n29100078943\nRUT 65.108.056-8\nAR Ministries\nMonto: " + new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(transferTotal))}`}
                  alt="QR Transferencia"
                  width={180}
                  height={180}
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Datos bancarios */}
            <div className="mb-5 rounded-2xl border border-zinc-700 bg-zinc-800 p-4 text-left space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Banco</span>
                <span className="font-medium text-white">Banco Estado</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Tipo</span>
                <span className="font-medium text-white">Cuenta Corriente</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Número</span>
                <span className="font-medium text-white font-mono">
                  29100078943
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">RUT</span>
                <span className="font-medium text-white">65.108.056-8</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Titular</span>
                <span className="font-medium text-white text-right max-w-[160px]">
                  Iglesia Cristiana AR Ministries
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Email</span>
                <span className="font-medium text-white">
                  donaciones@armglobal.org
                </span>
              </div>
              <div className="flex justify-between text-xs border-t border-zinc-700 pt-2 mt-2">
                <span className="text-zinc-500">Total a transferir</span>
                <span className="font-bold text-amber-400 text-sm">
                  {new Intl.NumberFormat("es-CL", {
                    style: "currency",
                    currency: "CLP",
                    maximumFractionDigits: 0,
                  }).format(transferTotal)}
                </span>
              </div>
            </div>

            <button
              onClick={async () => {
                setShowTransferQR(false);
                // Proceed with order creation
                setSubmitting(true);
                const supabase = createClient();
                const {
                  data: { session },
                } = await supabase.auth.getSession();
                const res = await fetch("/api/orders", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session?.access_token}`,
                  },
                  body: JSON.stringify({
                    payment_method: "transferencia",
                    items: items.map((i) => ({
                      product_id: i.product.id,
                      quantity: i.quantity,
                      unit_price: i.product.price,
                      size: i.size ?? null,
            variant_type: i.variant_type ?? null,
            variant_value: i.variant_value ?? i.size ?? null,
                      fulfillment_type: getFulfillmentType(i.product.id),
                    })),
                    client_name: clientName.trim(),
                    client_email: clientEmail?.trim() || "",
                    client_phone: clientPhone?.trim() || null,
                    notes: notes?.trim() || null,
                    discount: 0,
                    delivery_status: hasProductionItems ? "pending" : null,
                  }),
                });
                const data = await res.json();
                if (res.ok) {
                  setCreatedOrder({
                    id: data.order_id,
                    number: data.order_number ?? data.order_id,
                    total: transferTotal,
                    emailSent: data.email_sent,
                  });
                  if (soundEnabled) playPaymentSuccessSound();
                  notifyLocalStockDiscount();
                  registerLastSale({
                    id: data.order_id,
                    number: data.order_number ?? data.order_id,
                    total: transferTotal,
                    method: "Transferencia",
                    clientName: clientName.trim() || null,
                    at: new Date().toISOString(),
                  });
                  setSuccessOpen(true);
                  setClientPhone("");
                  setProductionItems({});
                  clearCart();
                  focusSkuSearchInput();
                }
                setSubmitting(false);
              }}
              className="w-full rounded-2xl bg-amber-500 py-3 text-sm font-bold text-black transition hover:bg-amber-400 mb-3"
            >
              ✅ Cliente ya transfirió — Confirmar venta
            </button>

            <button
              onClick={() => {
                setShowTransferQR(false);
                setSubmitting(false);
              }}
              className="w-full text-xs text-zinc-600 hover:text-zinc-400 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Payment QR Modal */}
      {showPaymentQR && paymentLinkUrl && createdOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-700 bg-zinc-900 p-6 text-center shadow-2xl">
            <div className="mb-4 text-5xl">
              {paymentQrStatus === "rejected" ? "❌" : "📲"}
            </div>

            <h2 className="mb-2 text-xl font-bold text-white">
              {paymentQrStatus === "rejected"
                ? "Pago rechazado"
                : "Escanea para pagar"}
            </h2>

            <p className="mb-5 text-sm text-zinc-400">
              {paymentQrStatus === "rejected"
                ? "El cliente puede intentar pagar nuevamente generando una nueva venta."
                : "El cliente puede pagar con Apple Pay, Google Pay o tarjeta desde su celular."}
            </p>

            {paymentQrStatus === "pending" && (
              <div className="mb-5 flex justify-center">
                <div className="rounded-3xl bg-white p-4">
                  <QRCodeCanvas value={paymentLinkUrl} size={240} level="H" />
                </div>
              </div>
            )}

            <div className="mb-5 rounded-2xl border border-zinc-700 bg-zinc-800 p-4 text-left space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Orden</span>
                <span className="font-bold text-white">
                  #{createdOrder.number}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Total a pagar</span>
                <span className="font-bold text-amber-400 text-base">
                  {fmt(paymentQrTotal || createdOrder.total)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Estado</span>
                <span
                  className={`font-semibold ${paymentQrStatus === "rejected" ? "text-red-400" : "text-amber-400"}`}
                >
                  {paymentQrStatus === "rejected"
                    ? "❌ Rechazado"
                    : "⏳ Pendiente de pago"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Stock descontado</span>
                <span className="font-semibold text-zinc-400">
                  No — se descuenta al pagar
                </span>
              </div>
            </div>

            <p
              className={`mb-3 text-xs ${paymentQrStatus === "rejected" ? "text-red-400" : "text-zinc-600"}`}
            >
              {paymentQrMessage}
            </p>

            {whatsappLinkMessage && (
              <p
                className={`mb-5 rounded-xl border px-3 py-2 text-xs ${
                  whatsappLinkStatus === "sent"
                    ? "border-green-500/20 bg-green-500/10 text-green-300"
                    : whatsappLinkStatus === "error"
                      ? "border-red-500/20 bg-red-500/10 text-red-300"
                      : "border-blue-500/20 bg-blue-500/10 text-blue-300"
                }`}
              >
                {whatsappLinkMessage}
              </p>
            )}

            {paymentQrStatus === "pending" && (
              <>
                <button
                  onClick={() => window.open(paymentLinkUrl, "_blank")}
                  className="mb-3 w-full rounded-2xl border border-zinc-700 py-3 text-sm font-bold text-zinc-300 transition hover:bg-zinc-800"
                >
                  Abrir link de pago
                </button>

                {createdOrder && clientPhone.trim() && (
                  <button
                    onClick={() =>
                      sendPaymentLinkByWhatsApp({
                        orderId: createdOrder.id,
                        orderNumber: createdOrder.number,
                        paymentUrl: paymentLinkUrl,
                        amount: paymentQrTotal || createdOrder.total,
                      })
                    }
                    disabled={whatsappLinkStatus === "sending"}
                    className="mb-3 w-full rounded-2xl border border-green-500/30 bg-green-500/10 py-3 text-sm font-bold text-green-300 transition hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {whatsappLinkStatus === "sending"
                      ? "Enviando WhatsApp..."
                      : "Reenviar link por WhatsApp"}
                  </button>
                )}
              </>
            )}

            <button
              onClick={() => {
                setShowPaymentQR(false);
                setPaymentLinkUrl(null);
                setPaymentQrCheckoutId(null);
                setPaymentQrCheckoutRef(null);
                setPaymentQrStatus("pending");
                setPaymentQrMessage(
                  "Esperando confirmación automática del pago...",
                );
                setWhatsappLinkStatus("idle");
                setWhatsappLinkMessage(null);
                setClientPhone("");
                clearCart();
              }}
              className="w-full rounded-2xl bg-amber-500 py-3 text-sm font-bold text-black transition hover:bg-amber-400"
            >
              Nueva venta
            </button>
          </div>
        </div>
      )}

      {/* MODAL ÉXITO */}
      {createdOrder && (
        <SaleSuccessModal
          open={successOpen}
          orderId={createdOrder.id}
          orderNumber={createdOrder.number}
          total={createdOrder.total}
          emailSent={createdOrder.emailSent}
          onNewSale={() => {
            setSuccessOpen(false);
            setCreatedOrder(null);
            focusSkuSearchInput();
          }}
          onClose={() => {
            setSuccessOpen(false);
            focusSkuSearchInput();
          }}
        />
      )}

    </>
  );
}
