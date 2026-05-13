import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Ruta: src/app/api/sumup/check-checkout/route.ts
// Consulta el checkout de SumUp y actualiza la orden.
// Importante: SumUp puede dejar el checkout como PENDING aunque una transacción interna venga FAILED.
// Por eso se evalúa tanto checkout.status como transactions[0].status.

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
    console.log("[SumUp Check Checkout] Response:", JSON.stringify(checkout));

    if (!checkoutRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          order_status: "pending",
          sumup_status: null,
          detail: checkout,
        },
        { status: checkoutRes.status },
      );
    }

    const checkoutStatus = String(checkout?.status ?? "").toUpperCase();
    const transaction = Array.isArray(checkout?.transactions)
      ? checkout.transactions[0]
      : null;

    const transactionStatus = String(transaction?.status ?? "").toUpperCase();
    const transactionCode = transaction?.transaction_code ?? transaction?.id ?? "";
    const checkoutReference =
      checkout?.checkout_reference ?? checkoutReferenceFromBody ?? "";

    const paidStatuses = ["PAID", "SUCCESSFUL", "SUCCESS", "COMPLETED"];
    const failedStatuses = [
      "FAILED",
      "EXPIRED",
      "CANCELLED",
      "CANCELED",
      "REJECTED",
      "DECLINED",
      "ERROR",
    ];

    // Estado efectivo: prioriza transacción si existe, porque puede venir FAILED
    // aunque el checkout siga PENDING.
    const effectiveStatus = paidStatuses.includes(transactionStatus)
      ? "PAID"
      : failedStatuses.includes(transactionStatus)
        ? "FAILED"
        : paidStatuses.includes(checkoutStatus)
          ? "PAID"
          : failedStatuses.includes(checkoutStatus)
            ? "FAILED"
            : "PENDING";

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select(
        "id, order_number, campus_id, status, notes, order_items(product_id, quantity, size)",
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
        order_status: order.status,
        sumup_status: checkoutStatus,
        transaction_status: transactionStatus,
        effective_status: effectiveStatus,
        order_number: order.order_number,
      });
    }

    if (effectiveStatus === "PAID") {
      const { error: updateError } = await adminClient
        .from("orders")
        .update({
          status: "paid",
          notes: `Pagado via SumUp | Ref: ${checkoutReference} | TXN: ${transactionCode}`,
        })
        .eq("id", order.id);

      if (updateError) {
        console.error("[SumUp Check Checkout] Error updating paid order:", updateError);
        return NextResponse.json(
          { ok: false, error: "paid_update_error" },
          { status: 500 },
        );
      }

      for (const item of order.order_items ?? []) {
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

      return NextResponse.json({
        ok: true,
        action: "paid",
        order_status: "paid",
        sumup_status: checkoutStatus,
        transaction_status: transactionStatus,
        effective_status: effectiveStatus,
        order_number: order.order_number,
      });
    }

    if (effectiveStatus === "FAILED") {
      const { error: cancelError } = await adminClient
        .from("orders")
        .update({
          status: "cancelled",
          notes: `Pago rechazado/cancelado via SumUp | Ref: ${checkoutReference} | Checkout: ${checkoutStatus} | TX: ${transactionStatus}`,
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
        order_status: "cancelled",
        sumup_status: checkoutStatus,
        transaction_status: transactionStatus,
        effective_status: effectiveStatus,
        order_number: order.order_number,
      });
    }

    return NextResponse.json({
      ok: true,
      action: "pending",
      order_status: "pending",
      sumup_status: checkoutStatus,
      transaction_status: transactionStatus,
      effective_status: effectiveStatus,
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
