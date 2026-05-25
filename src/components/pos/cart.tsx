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
