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
	let checkoutId = body?.checkout_id;
    const checkoutReferenceFromBody = body?.checkout_reference;
    const forceCancel = Boolean(body?.force_cancel);

	if (!orderId) {
	return NextResponse.json(
    { error: "order_id requerido" },
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
    "id, order_number, campus_id, pickup_campus_id, status, notes, tracking_token, production_status, sumup_checkout_id, order_items(product_id, quantity, size)",
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
   if (!checkoutId) {
  checkoutId = order?.sumup_checkout_id;
}

if (!checkoutId) {
  return NextResponse.json({
    ok: true,
    action: "pending",
    status: "pending",
    order_status: "pending",
    sumup_status: "WAITING_CHECKOUT_ID",
    order_number: order.order_number,
  });
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

    const resolvedStatus = transactionStatus || checkoutStatus;

    // Pago aprobado: descontar stock una sola vez.
    if (paidStatuses.includes(transactionStatus) || paidStatuses.includes(checkoutStatus)) {
      const { error: updateError } = await adminClient
        .from("orders")
        .update({
          status: "paid",
          notes: `Pagado via SumUp | Ref: ${checkoutReference ?? ""} | TXN: ${transactionCode}`,
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

      // ── Enviar voucher SOLO cuando SumUp confirmó el pago ──
      // Si el pago queda rejected/cancelled/expired, este bloque nunca se ejecuta.
      let emailSent = false;

      try {
        const { data: contact, error: contactError } = await adminClient
          .from("order_contacts")
          .select("client_name, client_email, client_phone")
          .eq("order_id", order.id)
          .maybeSingle();

        if (contactError) {
          console.error("[SumUp Check Checkout] Contact query error:", contactError);
        }

        if (contact?.client_email && process.env.RESEND_API_KEY) {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);

          const { data: orderItemsData, error: orderItemsQueryError } = await adminClient
            .from("order_items")
            .select(`
              quantity,
              unit_price,
              size,
              products(name)
            `)
            .eq("order_id", order.id);

          if (orderItemsQueryError) {
            console.error("[SumUp Check Checkout] Order items query error:", orderItemsQueryError);
          }

          const fmtCLP = (n: number) =>
            new Intl.NumberFormat("es-CL", {
              style: "currency",
              currency: "CLP",
              maximumFractionDigits: 0,
            }).format(n);

          const escHtml = (value: string) =>
            String(value ?? "")
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");

          const voucherItems = (orderItemsData ?? []).map((item: any) => {
            const productName = item.products?.name ?? "Producto";
            const quantity = Number(item.quantity ?? 0);
            const unitPrice = Number(item.unit_price ?? 0);

            return {
              name: productName,
              quantity,
              unitPrice,
              size: item.size ?? null,
              lineTotal: quantity * unitPrice,
            };
          });

          const totalPaid = voucherItems.reduce(
            (sum: number, item: any) => sum + item.lineTotal,
            0,
          );

          const itemsHtml = voucherItems
            .map((item: any) => {
              const sizeLabel = item.size
                ? `<br/><span style="color:#888;font-size:11px;">Talla: ${escHtml(item.size)}</span>`
                : "";

              return `<tr>
                <td style="padding:12px 8px;border-bottom:1px solid #f0f0f0;font-size:14px;">
                  ${escHtml(item.name)}${sizeLabel}
                </td>
                <td style="padding:12px 8px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:14px;color:#666;">${item.quantity}</td>
                <td style="padding:12px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;font-weight:600;">${fmtCLP(item.lineTotal)}</td>
              </tr>`;
            })
            .join("");

          const orderDate = new Date().toLocaleDateString("es-CL", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          });

          const fromEmail = process.env.RESEND_FROM_EMAIL ?? "no-reply@armerch.com";

          const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
      <tr><td style="background:#18181b;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
        <p style="margin:0 0 4px;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">ARM Merch</p>
        <p style="margin:0;font-size:13px;color:#a1a1aa;">Sistema de Merch · ARM Global</p>
      </td></tr>

      <tr><td style="background:#16a34a;padding:16px 40px;text-align:center;">
        <p style="margin:0;font-size:15px;font-weight:600;color:#ffffff;">✓ &nbsp;Pago confirmado</p>
      </td></tr>

      <tr><td style="background:#ffffff;padding:36px 40px;">
        <p style="margin:0 0 24px;font-size:16px;color:#18181b;">
          Hola <strong>${escHtml(contact.client_name ?? "Cliente")}</strong>, gracias por tu compra.
          Aquí está el resumen de tu pedido confirmado por SumUp.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;margin-bottom:28px;">
          <tr>
            <td style="padding:16px 20px;border-bottom:1px solid #f0f0f0;">
              <span style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;">Número de orden</span><br/>
              <span style="font-size:18px;font-weight:700;color:#18181b;">#${order.order_number}</span>
            </td>
            <td style="padding:16px 20px;border-bottom:1px solid #f0f0f0;text-align:right;">
              <span style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;">Fecha</span><br/>
              <span style="font-size:14px;font-weight:500;color:#18181b;">${orderDate}</span>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding:16px 20px;">
              <span style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;">Método de pago</span><br/>
              <span style="font-size:14px;font-weight:500;color:#18181b;">Link de pago SumUp</span>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;">Detalle de compra</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:10px 8px;text-align:left;font-size:12px;color:#71717a;font-weight:600;border-bottom:2px solid #e4e4e7;">PRODUCTO</th>
              <th style="padding:10px 8px;text-align:center;font-size:12px;color:#71717a;font-weight:600;border-bottom:2px solid #e4e4e7;">CANT.</th>
              <th style="padding:10px 8px;text-align:right;font-size:12px;color:#71717a;font-weight:600;border-bottom:2px solid #e4e4e7;">TOTAL</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:12px 0;font-size:18px;font-weight:700;color:#18181b;">Total pagado</td>
            <td style="padding:12px 0;font-size:22px;font-weight:800;color:#18181b;text-align:right;">${fmtCLP(totalPaid)}</td>
          </tr>
        </table>

      </td></tr>

      <tr><td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;border-top:1px solid #e4e4e7;">
        <p style="margin:0 0 8px;font-size:13px;color:#71717a;">
          ¿Tienes alguna consulta? Contáctanos y menciona tu número de orden.
        </p>
        <p style="margin:0;font-size:12px;color:#a1a1aa;">
          ARM Merch · ARM Global · armerch.com
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

          const { error: mailError } = await resend.emails.send({
            from: `ARM Merch <${fromEmail}>`,
            to: contact.client_email,
            subject: `Comprobante Orden #${order.order_number}`,
            html,
          });

          if (mailError) {
            console.error("[SumUp Check Checkout] Voucher email error:", mailError);
          } else {
            emailSent = true;
            console.log("[SumUp Check Checkout] Voucher enviado");
          }
        }
      } catch (emailError) {
        console.error("[SumUp Check Checkout] Error enviando voucher:", emailError);
      }

// Enviar tracking SOLO para pedidos en producción
if (order.production_status === 'pending_production') {
  try {
    await sendTrackingEmail({
      orderId: order.id,
      status: 'pending_production',
      appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://armerch.com',
    })
  } catch (trackingEmailError) {
    console.error('[SumUp Check Checkout] Tracking email error:', trackingEmailError)
  }
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
      failedStatuses.includes(transactionStatus) ||
      failedStatuses.includes(checkoutStatus) ||
      forceCancel
    ) {
      const cancelReason = forceCancel ? "timeout" : (transactionStatus || checkoutStatus || "cancelled");

      const { error: cancelError } = await adminClient
        .from("orders")
        .update({
          status: "cancelled",
          notes: `Pago ${String(cancelReason).toLowerCase()} via SumUp | Ref: ${checkoutReference ?? ""}`,
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
