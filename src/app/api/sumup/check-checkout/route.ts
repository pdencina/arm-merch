import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Ruta: src/app/api/sumup/check-checkout/route.ts
// Sirve para Link de Pago y SumUp SOLO.
// En SOLO, el "checkout_id" puede venir como client_transaction_id.
// Por eso este endpoint prueba Checkouts API y Transactions API.

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
  "TIMEOUT",
  "TIMED_OUT",
  "ERROR",
];

function normalizeStatus(value: any) {
  return String(value ?? "").trim().toUpperCase();
}

function fmtCLP(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function escHtml(value: any) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getFirstTransaction(payload: any) {
  if (!payload) return null;

  if (Array.isArray(payload?.transactions)) return payload.transactions[0] ?? null;
  if (Array.isArray(payload?.transaction)) return payload.transaction[0] ?? null;
  if (payload?.transaction && typeof payload.transaction === "object") return payload.transaction;
  if (payload?.last_transaction && typeof payload.last_transaction === "object") return payload.last_transaction;

  if (Array.isArray(payload?.items)) return payload.items[0] ?? null;
  if (Array.isArray(payload)) return payload[0] ?? null;

  if (
    payload?.transaction_code ||
    payload?.client_transaction_id ||
    payload?.id ||
    payload?.status
  ) {
    return payload;
  }

  return null;
}

function resolvePaymentStatus(payload: any) {
  const transaction = getFirstTransaction(payload);

  const transactionStatus = normalizeStatus(
    transaction?.status ??
      transaction?.transaction_status ??
      transaction?.state
  );

  const checkoutStatus = normalizeStatus(
    payload?.status ??
      payload?.checkout_status ??
      payload?.state
  );

  const resolvedStatus = transactionStatus || checkoutStatus || "PENDING";

  const transactionCode =
    transaction?.transaction_code ??
    transaction?.transaction_id ??
    transaction?.client_transaction_id ??
    transaction?.id ??
    payload?.transaction_code ??
    payload?.transaction_id ??
    payload?.client_transaction_id ??
    payload?.id ??
    "";

  return {
    resolvedStatus,
    transactionStatus,
    checkoutStatus,
    transactionCode,
    transaction,
  };
}

async function fetchJson(url: string, apiKey: string) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = {};

  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return {
    ok: res.ok,
    status: res.status,
    json,
    url,
  };
}

async function getSumUpStatus({
  apiBase,
  apiKey,
  checkoutId,
  checkoutReference,
}: {
  apiBase: string;
  apiKey: string;
  checkoutId?: string | null;
  checkoutReference?: string | null;
}) {
  const id = String(checkoutId ?? "").trim();
  const reference = String(checkoutReference ?? "").trim();

  const urls: string[] = [];

  if (id) {
    urls.push(`${apiBase}/v0.1/checkouts/${encodeURIComponent(id)}`);
    urls.push(`${apiBase}/v0.1/me/transactions/${encodeURIComponent(id)}`);
    urls.push(`${apiBase}/v0.1/transactions/${encodeURIComponent(id)}`);
    urls.push(`${apiBase}/v0.1/me/transactions?client_transaction_id=${encodeURIComponent(id)}`);
    urls.push(`${apiBase}/v0.1/me/transactions?foreign_transaction_id=${encodeURIComponent(id)}`);
  }

  if (reference) {
    urls.push(`${apiBase}/v0.1/checkouts?checkout_reference=${encodeURIComponent(reference)}`);
    urls.push(`${apiBase}/v0.1/me/transactions?foreign_transaction_id=${encodeURIComponent(reference)}`);
  }

  let lastResponse: any = null;

  for (const url of urls) {
    const result = await fetchJson(url, apiKey);
    lastResponse = result;

    console.log("[SumUp Check Checkout] GET:", url, "HTTP:", result.status);
    console.log("[SumUp Check Checkout] Response:", JSON.stringify(result.json));

    if (!result.ok) continue;

    const payload = Array.isArray(result.json?.items)
      ? result.json.items[0]
      : Array.isArray(result.json)
        ? result.json[0]
        : result.json;

    const statusInfo = resolvePaymentStatus(payload);

    if (
      paidStatuses.includes(statusInfo.resolvedStatus) ||
      failedStatuses.includes(statusInfo.resolvedStatus)
    ) {
      return {
        found: true,
        payload,
        raw: result.json,
        source_url: url,
        ...statusInfo,
      };
    }
  }

  return {
    found: false,
    payload: null,
    raw: lastResponse?.json ?? null,
    source_url: lastResponse?.url ?? null,
    resolvedStatus: "PENDING",
    transactionStatus: "",
    checkoutStatus: "",
    transactionCode: "",
    transaction: null,
  };
}

async function sendVoucherEmail({
  adminClient,
  order,
  transactionCode,
  paymentLabel,
}: {
  adminClient: any;
  order: any;
  transactionCode?: string | null;
  paymentLabel: string;
}) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn("[SumUp Check Checkout] RESEND_API_KEY no configurada");
      return false;
    }

    const { data: contact, error: contactError } = await adminClient
      .from("order_contacts")
      .select("client_name, client_email, client_phone")
      .eq("order_id", order.id)
      .maybeSingle();

    if (contactError) {
      console.error("[SumUp Check Checkout] Contact query error:", contactError);
    }

    if (!contact?.client_email || !String(contact.client_email).includes("@")) {
      console.warn("[SumUp Check Checkout] Orden sin correo de cliente");
      return false;
    }

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

    const voucherItems = (orderItemsData ?? []).map((item: any) => {
      const quantity = Number(item.quantity ?? 0);
      const unitPrice = Number(item.unit_price ?? 0);

      return {
        name: item.products?.name ?? "Producto",
        quantity,
        unitPrice,
        size: item.size ?? null,
        lineTotal: quantity * unitPrice,
      };
    });

    const totalPaid = voucherItems.reduce(
      (sum: number, item: any) => sum + Number(item.lineTotal ?? 0),
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
          <td style="padding:12px 8px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:14px;color:#666;">
            ${item.quantity}
          </td>
          <td style="padding:12px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;font-weight:600;">
            ${fmtCLP(item.lineTotal)}
          </td>
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
              <span style="font-size:14px;font-weight:500;color:#18181b;">${escHtml(paymentLabel)}</span>
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
          <tbody>${itemsHtml || '<tr><td colspan="3" style="padding:12px;color:#71717a;">Sin detalle de productos</td></tr>'}</tbody>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:12px 0;font-size:18px;font-weight:700;color:#18181b;">Total pagado</td>
            <td style="padding:12px 0;font-size:22px;font-weight:800;color:#18181b;text-align:right;">${fmtCLP(totalPaid || Number(order.total ?? 0))}</td>
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

    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { error: mailError } = await resend.emails.send({
      from: `ARM Merch <${fromEmail}>`,
      to: contact.client_email,
      subject: `Comprobante Orden #${order.order_number}`,
      html,
    });

    if (mailError) {
      console.error("[SumUp Check Checkout] Voucher email error:", mailError);
      return false;
    }

    return true;
  } catch (emailError) {
    console.error("[SumUp Check Checkout] Error enviando voucher:", emailError);
    return false;
  }
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
    const sumupApiBase = process.env.SUMUP_API_BASE || "https://api.sumup.com";

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

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select(
        "id, order_number, campus_id, pickup_campus_id, status, notes, tracking_token, production_status, sumup_checkout_id, total, order_items(product_id, quantity, size)",
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

    if (!checkoutId) {
      checkoutId = order?.sumup_checkout_id;
    }

    if (order.status === "paid" || order.status === "cancelled") {
      return NextResponse.json({
        ok: true,
        action: "already_processed",
        status: order.status,
        order_status: order.status,
        sumup_status: order.status.toUpperCase(),
        order_number: order.order_number,
        email_sent: false,
      });
    }

    if (!checkoutId && !checkoutReferenceFromBody) {
      return NextResponse.json({
        ok: true,
        action: "pending",
        status: "pending",
        order_status: "pending",
        sumup_status: "WAITING_CHECKOUT_ID",
        order_number: order.order_number,
      });
    }

    const statusInfo = await getSumUpStatus({
      apiBase: sumupApiBase,
      apiKey,
      checkoutId,
      checkoutReference: checkoutReferenceFromBody,
    });

    const resolvedStatus = normalizeStatus(statusInfo.resolvedStatus);
    const transactionCode = statusInfo.transactionCode ?? "";
    const checkoutReference =
      checkoutReferenceFromBody ??
      statusInfo.payload?.checkout_reference ??
      checkoutId ??
      "";

    console.log("[SumUp Check Checkout] resolvedStatus:", resolvedStatus);
    console.log("[SumUp Check Checkout] transactionCode:", transactionCode);

    if (paidStatuses.includes(resolvedStatus)) {
      const { error: updateError } = await adminClient
        .from("orders")
        .update({
          status: "paid",
          notes: `Pagado via SumUp | Ref: ${checkoutReference ?? ""} | TXN: ${transactionCode}`,
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

      for (const item of order.order_items ?? []) {
        const { error: movementError } = await adminClient
          .from("inventory_movements")
          .insert({
            product_id: item.product_id,
            campus_id: order.campus_id,
            type: "salida",
            quantity: item.quantity,
            notes: `Pago SumUp - Orden #${order.order_number} - TXN ${transactionCode}`,
          });

        if (movementError) {
          console.error("[SumUp Check Checkout] Inventory movement error:", movementError);
        }
      }

      const emailSent = await sendVoucherEmail({
        adminClient,
        order,
        transactionCode,
        paymentLabel: "SumUp SOLO",
      });

      return NextResponse.json({
        ok: true,
        paid: true,
        final: true,
        action: "paid",
        status: "paid",
        order_status: "paid",
        sumup_status: resolvedStatus,
        order_number: order.order_number,
        transaction_code: transactionCode,
        email_sent: emailSent,
        source_url: statusInfo.source_url,
      });
    }

    if (failedStatuses.includes(resolvedStatus) || forceCancel) {
      const cancelReason = forceCancel
        ? "TIMEOUT"
        : resolvedStatus || "CANCELLED";

      const { error: cancelError } = await adminClient
        .from("orders")
        .update({
          status: "cancelled",
          notes: `Pago ${String(cancelReason).toLowerCase()} via SumUp | Ref: ${checkoutReference ?? ""}`,
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
        paid: false,
        final: true,
        action: "cancelled",
        status: "cancelled",
        order_status: "cancelled",
        sumup_status: cancelReason,
        order_number: order.order_number,
        email_sent: false,
      });
    }

    return NextResponse.json({
      ok: true,
      paid: false,
      final: false,
      action: "pending",
      status: "pending",
      order_status: "pending",
      sumup_status: resolvedStatus || "PENDING",
      order_number: order.order_number,
      email_sent: false,
      source_url: statusInfo.source_url,
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
