"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useCart, type CartItem } from "@/lib/hooks/use-cart";
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

// ─── CartItemRow ────────────────────────────────────────────────────────────
function CartItemRow({
  item,
  onUpdateQty,
  onRemove,
}: {
  item: CartItem;
  onUpdateQty: (qty: number) => void;
  onRemove: () => void;
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
            {item.size && (
              <span className="ml-1.5 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-400">
                Talla {item.size}
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

export default function Cart() {
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
    },
    [],
  );

  const [clientPhone, setClientPhone] = useState("");
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
  const [showPaymentQR, setShowPaymentQR] = useState(false);
  const [paymentQrTotal, setPaymentQrTotal] = useState(0);
  const [paymentQrStatus, setPaymentQrStatus] = useState<
    "pending" | "paid" | "rejected"
  >("pending");
  const [paymentQrMessage, setPaymentQrMessage] = useState(
    "Esperando confirmación automática del pago...",
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
  } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);
  const [recentTxList, setRecentTxList] = useState<any[]>([]);
  const [txCode, setTxCode] = useState("");
  const [showTransferQR, setShowTransferQR] = useState(false);
  const [transferTotal, setTransferTotal] = useState(0);
  const [sumupPolling, setSumupPolling] = useState(false);
  const [sumupStatus, setSumupStatus] = useState<
    "waiting" | "found" | "timeout"
  >("waiting");
  const sumupPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [isPendingDelivery, setIsPendingDelivery] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<{
    id: string;
    number: number | string;
    total: number;
    emailSent?: boolean;
  } | null>(null);

  const canSubmit = useMemo(
    () => items.length > 0 && clientName.trim().length > 0 && !submitting,
    [items.length, clientName, submitting],
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
            notifyLocalStockDiscount();
            setSuccessOpen(true);
            clearCart();
          }
        }, 900);

        return true;
      }

      if (["cancelled", "canceled", "failed", "declined", "rejected", "expired", "timeout"].includes(status)) {
        setPaymentQrStatus("rejected");
        setPaymentQrMessage("❌ Pago rechazado, expirado o no confirmado. El stock NO fue descontado.");
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
  }) {
    if (sumupPollRef.current) clearInterval(sumupPollRef.current);

    setSumupPolling(true);
    setSumupStatus("waiting");
    setVerifyError(null);
    setVerifySuccess("💳 Cobro enviado a la máquina SumUp SOLO. Esperando pago del cliente...");

    let attempts = 0;
    const maxAttempts = 90; // 90 * 2s = 3 minutos

    const check = async () => {
      attempts += 1;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setVerifyError("Sesión expirada. Recarga la página.");
          if (sumupPollRef.current) clearInterval(sumupPollRef.current);
          setSumupPolling(false);
          return;
        }

        const res = await fetch("/api/sumup/solo-status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ order_id: order.id }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          setVerifyError(data?.error ?? "No se pudo consultar el estado del pago SOLO.");
          return;
        }

        const orderStatus = String(
          data?.order_status ?? data?.status ?? data?.sumup_status ?? ""
        ).toLowerCase();

        const readerStatusRaw =
          data?.reader_status?.data ??
          data?.reader_status ??
          data?.sumup?.data ??
          data?.sumup ??
          null;

        const readerStatusText = String(
          readerStatusRaw?.status ??
            readerStatusRaw?.state ??
            data?.reader_status ??
            "Esperando acción"
        );

        setVerifySuccess(
          `💳 SOLO: ${readerStatusText} · Esperando respuesta del cliente...`
        );

        if (
          data?.final === true &&
          (data?.paid === true ||
            ["paid", "pagado", "approved", "completed", "success", "successful"].includes(orderStatus))
        ) {
          if (sumupPollRef.current) clearInterval(sumupPollRef.current);

          setSumupPolling(false);
          setSumupStatus("found");
          setVerifySuccess("✅ Pago aprobado en SumUp SOLO. Venta registrada correctamente.");

          setCreatedOrder({
            id: order.id,
            number: data?.order_number ?? order.number,
            total: order.total,
            emailSent: Boolean(data?.email_sent),
          });

          notifyLocalStockDiscount();
          setClientPhone("");
          clearCart();

          setTimeout(() => {
            setSumupSmartOpen(false);
            setSuccessOpen(true);
            setVerifyError(null);
            setVerifySuccess(null);
            setTxCode("");
          }, 700);

          return;
        }

        if (
          data?.final === true &&
          (data?.paid === false ||
            ["cancelled", "canceled", "failed", "declined", "rejected", "expired", "timeout"].includes(orderStatus))
        ) {
          if (sumupPollRef.current) clearInterval(sumupPollRef.current);

          setSumupPolling(false);
          setSumupStatus("timeout");
          setVerifyError("El pago fue rechazado, cancelado o expiró. La orden quedó sin confirmar.");

          return;
        }

        if (attempts >= maxAttempts) {
          if (sumupPollRef.current) clearInterval(sumupPollRef.current);
          setSumupPolling(false);
          setSumupStatus("timeout");
          setVerifyError("No se recibió confirmación automática en 3 minutos. Revisa SumUp antes de entregar el producto.");
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
      setClientPhone("");
      clearCart();
    } catch (e: any) {
      setVerifyError(e?.message ?? "Error inesperado validando Smart POS");
    }

    setVerifying(false);
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

      // ── SumUp SOLO Cloud API: envía el cobro directo a la máquina ──
      if (paymentMethod === "solo") {
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
            })),
            client_name: clientName.trim() || null,
            client_email: clientEmail.trim() || null,
            client_phone: clientPhone.trim() || null,
            notes: "SumUp SOLO - pago enviado al lector",
            delivery_status: isPendingDelivery ? "pending" : null,
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
        };

        setSumupSmartOrder(orderPayload);
        setTxCode("");
        setVerifyError(null);
        setVerifySuccess(`Cobro enviado a ${soloData?.reader?.name ?? "SumUp SOLO"}`);
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
              unit_price: i.product.price,
            })),
            client_name: clientName.trim() || null,
            client_email: clientEmail.trim() || null,
            client_phone: clientPhone.trim() || null,
            notes: "Smart POS SumUp - pendiente de validación TX",
            delivery_status: isPendingDelivery ? "pending" : null,
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
          delivery_status: isPendingDelivery ? "pending" : null,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(data?.error || "Error al registrar la venta.");

      const orderTotal = total();

      setIsPendingDelivery(false);
      setCreatedOrder({
        id: data.order_id,
        number: data.order_number ?? data.order_id,
        total: orderTotal,
        emailSent: data.email_sent,
      });

      if (paymentMethod === "link") {
        setShowPaymentQR(true);
      } else {
        setPaymentLinkUrl(null);
        notifyLocalStockDiscount();
        setSuccessOpen(true);
        setClientPhone("");
        clearCart();
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
            <h2 className="text-[17px] font-bold tracking-tight">Carrito</h2>
          </div>

          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
            >
              Vaciar
            </button>
          )}
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
                      key={item.product.id}
                      item={item}
                      onUpdateQty={(qty) =>
                        updateQuantity(item.product.id, qty)
                      }
                      onRemove={() => removeItem(item.product.id)}
                    />
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>

          {items.length > 0 && (
            <div className="space-y-4 px-4 pb-6">
              {/* DATOS DEL CLIENTE */}
              <div className="space-y-2.5">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Cliente <span className="text-red-400">*</span>
                </label>
                <input
                  placeholder="Nombre del cliente"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-amber-500/40"
                />
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

              {/* PEDIDO PARA PRODUCIR */}
              <button
                onClick={() => setIsPendingDelivery((v) => !v)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                  isPendingDelivery
                    ? "border-violet-500/40 bg-violet-500/10"
                    : "border-white/6 bg-white/[0.02] hover:border-white/10"
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                    isPendingDelivery ? "bg-violet-500/20" : "bg-white/5"
                  }`}
                >
                  {isPendingDelivery ? (
                    <Clock size={16} className="text-violet-400" />
                  ) : (
                    <Package size={16} className="text-zinc-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-semibold ${isPendingDelivery ? "text-violet-300" : "text-zinc-300"}`}
                  >
                    {isPendingDelivery
                      ? "Pedido para producir"
                      : "Entrega inmediata"}
                  </p>
                  <p className="text-[10px] text-zinc-600">
                    {isPendingDelivery
                      ? "Pagado · quedará pendiente de entrega"
                      : "El producto se entrega en el momento"}
                  </p>
                </div>
                <div
                  className={`relative flex h-5 w-9 shrink-0 items-center rounded-full transition-all ${
                    isPendingDelivery ? "bg-violet-500" : "bg-zinc-700"
                  }`}
                >
                  <span
                    className={`absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-all ${
                      isPendingDelivery ? "left-[18px]" : "left-[3px]"
                    }`}
                  />
                </div>
              </button>

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
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    Procesando...
                  </span>
                ) : isPendingDelivery ? (
                  <span className="flex items-center justify-center gap-2">
                    <Clock size={18} />
                    Registrar pedido · {fmt(total())}
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

      {/* Smart POS — Esperando pago */}
      {sumupSmartOpen && sumupSmartOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-700 bg-zinc-900 p-8 text-center shadow-2xl">
            {sumupStatus === "waiting" && (
              <>
                <div className="mb-4 text-6xl">💳</div>
                <h2 className="mb-2 text-xl font-bold text-white">
                  Cobro enviado a SumUp SOLO
                </h2>
                <p className="mb-1 text-sm text-zinc-400">
                  La máquina debe mostrar el monto para que el cliente pague con tarjeta.
                </p>
                <p className="mb-5 text-xs text-zinc-600">
                  No cierres esta ventana hasta recibir confirmación automática.
                </p>

                <div className="rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-4 mb-5 text-left space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Orden</span>
                    <span className="font-bold text-white">
                      #{sumupSmartOrder.number}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Total enviado</span>
                    <span className="font-bold text-amber-400 text-base">
                      {fmt(sumupSmartOrder.total)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Estado</span>
                    <span className="text-amber-400">
                      {sumupPolling ? "⏳ Esperando pago" : "⏳ Consultando"}
                    </span>
                  </div>
                </div>

                {verifySuccess && (
                  <p className="mb-3 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-300">
                    {verifySuccess}
                  </p>
                )}

                {verifyError && (
                  <p className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {verifyError}
                  </p>
                )}

                <button
                  onClick={() => {
                    if (sumupPollRef.current) clearInterval(sumupPollRef.current);
                    setSumupPolling(false);
                    setSumupSmartOpen(false);
                    setVerifyError(null);
                    setVerifySuccess(null);
                    setTxCode("");
                  }}
                  className="w-full rounded-2xl border border-zinc-700 py-2.5 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-white"
                >
                  Cerrar monitoreo
                </button>
              </>
            )}

            {sumupStatus === "found" && (
              <>
                <div className="mb-4 text-6xl">✅</div>
                <h2 className="mb-2 text-xl font-bold text-white">
                  ¡Pago confirmado!
                </h2>
                <p className="mb-1 text-sm text-zinc-400">
                  Orden{" "}
                  <strong className="text-white">
                    #{sumupSmartOrder.number}
                  </strong>
                </p>
                <p className="mb-6 text-xs text-zinc-600">
                  El pago fue confirmado automáticamente por SumUp SOLO y la venta fue registrada.
                </p>
                <button
                  onClick={() => {
                    setSumupSmartOpen(false);
                    setSuccessOpen(true);
                    setTxCode("");
                    setVerifyError(null);
                    setVerifySuccess(null);
                  }}
                  className="w-full rounded-2xl bg-green-500 py-3 text-sm font-bold text-white transition hover:bg-green-400"
                >
                  Ver confirmación
                </button>
              </>
            )}

            {sumupStatus === "timeout" && (
              <>
                <div className="mb-4 text-6xl">⏱️</div>
                <h2 className="mb-2 text-xl font-bold text-white">
                  Tiempo de espera agotado
                </h2>
                <p className="mb-1 text-sm text-zinc-400">
                  No se detectó el pago en 3 minutos.
                </p>
                <p className="mb-6 text-xs text-zinc-600">
                  La orden #{sumupSmartOrder.number} quedó pendiente. Puedes
                  confirmarla manualmente en Órdenes si el cliente pagó.
                </p>
                <button
                  onClick={() => setSumupSmartOpen(false)}
                  className="w-full rounded-2xl bg-zinc-700 py-3 text-sm font-bold text-white transition hover:bg-zinc-600"
                >
                  Cerrar
                </button>
              </>
            )}
          </div>
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
                    })),
                    client_name: clientName.trim(),
                    client_email: clientEmail?.trim() || "",
                    client_phone: clientPhone?.trim() || null,
                    notes: notes?.trim() || null,
                    discount: 0,
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
                  notifyLocalStockDiscount();
                  setSuccessOpen(true);
                  setClientPhone("");
                  clearCart();
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
              className={`mb-5 text-xs ${paymentQrStatus === "rejected" ? "text-red-400" : "text-zinc-600"}`}
            >
              {paymentQrMessage}
            </p>

            {paymentQrStatus === "pending" && (
              <button
                onClick={() => window.open(paymentLinkUrl, "_blank")}
                className="mb-3 w-full rounded-2xl border border-zinc-700 py-3 text-sm font-bold text-zinc-300 transition hover:bg-zinc-800"
              >
                Abrir link de pago
              </button>
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
      setSuccessOpen(false)
      setCreatedOrder(null)
    }}
    onClose={() => {
      setSuccessOpen(false)
    }}
  />
)}

    </>
  );
}
