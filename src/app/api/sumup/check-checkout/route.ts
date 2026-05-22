import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTrackingEmail } from "@/lib/tracking-email";

// Ruta: src/app/api/sumup/check-checkout/route.ts
// Consulta SumUp por el checkout, actualiza la orden y devuelve siempre status + order_status.

const paidStatuses = ["PAID", "SUCCESSFUL", "SUCCESS", "COMPLETED", "APPROVED"];
const failedStatuses = [
  "FAILED",
  "DECLINED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
  "CANCELED",
  "CANCELLED_BY_USER",
  "CANCELED_BY_USER",
];

function getMostRelevantTransaction(checkout: any) {
  const transactions = Array.isArray(checkout?.transactions)
    ? checkout.transactions
    : Array.isArray(checkout?.transaction)
      ? checkout.transaction
      : [];

  return transactions?.[0] ?? null;
}

function normalizeStatus(value: any) {
  return String(value ?? "").trim().toUpperCase();
}

function appendNotes(current: string | null | undefined, ...parts: Array<string | null | undefined>) {
  return [current ?? "", ...parts]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" | ");
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const apiKey = process.env.SUMUP_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "SUMUP_API_KEY no configurada" },
        { status: 500 },
      );
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase admin env no configurada" },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const orderId = body?.order_id;
    const checkoutId = body?.checkout_id;
    const checkoutReferenceFromBody = body?.checkout_reference;
    const forceCancel = Boolean(body?.force_cancel);

    if (!orderId || !checkoutId) {
      return NextResponse.json(
        { error: "order_id y checkout_id son requeridos" },
        { status: 400 },
      );
    }

    const checkoutRes = await fetch(
      `https://api.sumup.com/v0.1/checkouts/${checkoutId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      },
    );

    const checkoutText = await checkoutRes.text();
    let checkout: any = {};

    try {
      checkout = JSON.parse(checkoutText);
    } catch {
      checkout = { raw: checkoutText };
    }

    console.log("[SumUp Check Checkout] HTTP Status:", checkoutRes.status);
    console.log("[SumUp Check Checkout] Checkout Response:", JSON.stringify(checkout, null, 2));

    if (!checkoutRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          status: "pending",
          order_status: "pending",
          sumup_status: null,
          detail: checkout,
        },
        { status: checkoutRes.status },
      );
    }

    const checkoutStatus = normalizeStatus(checkout?.status);
    const transaction = getMostRelevantTransaction(checkout);
    const transactionStatus = normalizeStatus(transaction?.status);
    const checkoutReference = checkout?.checkout_reference ?? checkoutReferenceFromBody;
    const transactionCode = transaction?.transaction_code ?? transaction?.id ?? "";

    console.log("[SumUp Check Checkout] checkoutStatus:", checkoutStatus);
    console.log("[SumUp Check Checkout] transactionStatus:", transactionStatus);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select(
        "id, order_number, campus_id, status, notes, payment_method, order_items(product_id, quantity, size, fulfillment_type)",
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      console.error("[SumUp Check Checkout] Order query error:", orderError);
      return NextResponse.json(
        { ok: false, error: "order_query_error" },
        { status: 500 },
      );
    }

    if (!order) {
      return NextResponse.json(
        { ok: false, error: "order_not_found" },
        { status: 404 },
      );
    }

    if (order.status === "paid" || order.status === "cancelled") {
      return NextResponse.json({
        ok: true,
        action: "already_processed",
        status: order.status,
        order_status: order.status,
        sumup_status: transactionStatus || checkoutStatus,
        order_number: order.order_number,
      });
    }

    const resolvedStatus = checkoutStatus || transactionStatus;
    const isPaid =
      paidStatuses.includes(checkoutStatus) ||
      paidStatuses.includes(transactionStatus) ||
      paidStatuses.includes(resolvedStatus);

    const isFailed =
      failedStatuses.includes(checkoutStatus) ||
      failedStatuses.includes(transactionStatus) ||
      failedStatuses.includes(resolvedStatus);

    // Pago aprobado: descontar stock una sola vez.
    if (isPaid) {
      const { error: updateError } = await adminClient
        .from("orders")
        .update({
          status: "paid",
          notes: appendNotes(
            order.notes,
            "Pagado vía SumUp Wallet/Link",
            `Ref: ${checkoutReference ?? ""}`,
            `TXN: ${transactionCode || "N/A"}`,
            `Estado: ${resolvedStatus || "PAID"}`,
          ),
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (updateError) {
        console.error("[SumUp Check Checkout] Error updating paid order:", updateError);
        return NextResponse.json(
          { ok: false, error: "paid_update_error" },
          { status: 500 },
        );
      }


      await adminClient.from("order_status_history").insert({
        order_id: order.id,
        status: "payment_confirmed",
        title: "Pago confirmado",
        message: "El pago fue confirmado correctamente por SumUp Wallet/Link.",
        created_at: new Date().toISOString(),
      }).then(() => null);

      for (const item of order.order_items ?? []) {
        if (item.fulfillment_type === "production") continue;

        const { error: movementError } = await adminClient
          .from("inventory_movements")
          .insert({
            product_id: item.product_id,
            campus_id: order.campus_id,
            type: "salida",
            quantity: item.quantity,
            notes: `Pago link SumUp - Orden #${order.order_number} - TXN ${transactionCode}`,
          });

        if (movementError) {
          console.error("[SumUp Check Checkout] Inventory movement error:", movementError);
        }
      }

      // ── Enviar voucher unificado cuando SumUp confirmó el pago ──
      // Todos los medios de pago usan el mismo template desde src/lib/tracking-email.ts
      let emailSent = false;

      try {
        const emailResult = await sendTrackingEmail({
          orderId: order.id,
          status: "purchase_confirmed",
          appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://armerch.com",
        });

        emailSent = Boolean(emailResult.sent);

        if (!emailResult.sent) {
          console.error("[SumUp Check Checkout] Tracking email error:", emailResult.error);
        }
      } catch (emailError) {
        console.error("[SumUp Check Checkout] Error enviando voucher unificado:", emailError);
      }

      return NextResponse.json({
        ok: true,
        action: "paid",
        status: "paid",
        order_status: "paid",
        sumup_status: resolvedStatus,
        order_number: order.order_number,
        email_sent: emailSent,
      });
    }

    // Pago rechazado, expirado o cancelación forzada por timeout del POS.
    if (
      isFailed ||
      forceCancel
    ) {
      const cancelReason = forceCancel ? "timeout" : (transactionStatus || checkoutStatus || "cancelled");

      const { error: cancelError } = await adminClient
        .from("orders")
        .update({
          status: "cancelled",
          notes: appendNotes(
            order.notes,
            `Pago ${String(cancelReason).toLowerCase()} vía SumUp Wallet/Link`,
            `Ref: ${checkoutReference ?? ""}`,
          ),
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (cancelError) {
        console.error("[SumUp Check Checkout] Error cancelling order:", cancelError);
        return NextResponse.json(
          { ok: false, error: "cancel_update_error" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        ok: true,
        action: "cancelled",
        status: "cancelled",
        order_status: "cancelled",
        sumup_status: resolvedStatus || "TIMEOUT",
        order_number: order.order_number,
      });
    }

    return NextResponse.json({
      ok: true,
      action: "pending",
      status: "pending",
      order_status: "pending",
      sumup_status: resolvedStatus || "PENDING",
      order_number: order.order_number,
    });
  } catch (error: any) {
    console.error("[SumUp Check Checkout] Error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "Error interno",
      },
      { status: 500 },
    );
  }
}
