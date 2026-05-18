import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || "v22.0";

function normalizePhone(input: string) {
  const digits = String(input || "").replace(/\D/g, "");

  if (!digits) return "";
  if (digits.startsWith("56")) return digits;
  if (digits.startsWith("9") && digits.length === 9) return `56${digits}`;
  if (digits.length === 8) return `569${digits}`;

  return digits;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

async function getSessionUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return {
      errorResponse: NextResponse.json(
        { error: "No autenticado" },
        { status: 401 },
      ),
    };
  }

  const token = authHeader.replace("Bearer ", "").trim();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      errorResponse: NextResponse.json(
        { error: "Faltan variables de Supabase" },
        { status: 500 },
      ),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return {
      errorResponse: NextResponse.json(
        { error: "No autenticado" },
        { status: 401 },
      ),
    };
  }

  return { user };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getSessionUser(req);

    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const body = await req.json().catch(() => ({}));

    const phone = normalizePhone(body?.phone);
    const clientName = String(body?.client_name || "Cliente").trim();
    const orderNumber = String(body?.order_number || body?.order_id || "").trim();
    const total = Number(body?.total || 0);
    const paymentUrl = String(body?.payment_url || "").trim();

    if (!phone) {
      return NextResponse.json(
        { error: "Teléfono WhatsApp obligatorio" },
        { status: 400 },
      );
    }

    if (!paymentUrl) {
      return NextResponse.json(
        { error: "payment_url es obligatorio" },
        { status: 400 },
      );
    }

    const whatsappToken = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const templateName = process.env.WHATSAPP_TEMPLATE_LINK_PAGO || "link_pago";
    const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "es_CL";

    if (!whatsappToken || !phoneNumberId) {
      return NextResponse.json(
        {
          error:
            "Faltan variables WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID en Vercel",
        },
        { status: 500 },
      );
    }

    const totalText = formatCurrency(total);

    const payload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: templateLanguage,
        },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: clientName },
              { type: "text", text: totalText },
              { type: "text", text: paymentUrl },
            ],
          },
        ],
      },
    };

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      },
    );

    const data = await res.json().catch(() => null);

    console.log("[WhatsApp Payment Link]", {
      ok: res.ok,
      status: res.status,
      to: phone,
      templateName,
      templateLanguage,
      orderNumber,
      response: data,
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            "Meta rechazó el envío del WhatsApp",
          detail: data,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      to: phone,
      template: templateName,
      order_number: orderNumber,
      meta: data,
    });
  } catch (error: any) {
    console.error("[WhatsApp Payment Link] Error:", error);

    return NextResponse.json(
      {
        error: error?.message || "Error interno enviando WhatsApp",
      },
      { status: 500 },
    );
  }
}
