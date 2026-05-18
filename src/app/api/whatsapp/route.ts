import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

function fallbackMessage({
  clientName,
  total,
  paymentUrl,
}: {
  clientName: string;
  total: number;
  paymentUrl: string;
}) {
  return `Hola ${clientName || "Cliente"} 👋

Tu pedido ARM Merch ya está listo para pago.

💰 Total: ${formatCurrency(total)}

Puedes completar tu compra aquí:
${paymentUrl}

Gracias por apoyar ARM ❤️`;
}

function cleanWhatsAppMessage(value: string) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 900);
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getSessionUser(req);

    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const body = await req.json().catch(() => ({}));

    const type = String(body?.type || "payment_link");
    const clientName = String(body?.client_name || "Cliente").trim();
    const total = Number(body?.total || 0);
    const paymentUrl = String(body?.payment_url || "").trim();
    const campus = String(body?.campus || "ARM Merch").trim();
    const tone = String(body?.tone || "cercano, claro y profesional").trim();

    if (!paymentUrl && type === "payment_link") {
      return NextResponse.json(
        { error: "payment_url es obligatorio" },
        { status: 400 },
      );
    }

    const fallback = fallbackMessage({
      clientName,
      total,
      paymentUrl,
    });

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: true,
        provider: "fallback",
        message: fallback,
      });
    }

    const model = process.env.OPENAI_MODEL || "gpt-5-mini";

    const instructions = [
      "Eres un asistente de comunicación para ARM Merch.",
      "Genera mensajes de WhatsApp breves, humanos y transaccionales.",
      "No inventes información.",
      "No agregues descuentos, promociones ni urgencia falsa.",
      "Mantén tono cristiano/cercano sutil, sin sonar invasivo.",
      "El mensaje debe ser apto para una plantilla Utility de WhatsApp.",
      "Devuelve solo el mensaje final, sin comillas ni explicación.",
    ].join(" ");

    const input = `
Tipo de mensaje: ${type}
Cliente: ${clientName}
Campus: ${campus}
Total: ${formatCurrency(total)}
Link de pago: ${paymentUrl}
Tono: ${tone}

Genera un mensaje WhatsApp listo para enviar.
Debe incluir:
- saludo con el nombre
- total
- link de pago
- cierre breve agradeciendo apoyo a ARM
Máximo 650 caracteres.
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions,
        input,
        temperature: 0.4,
        max_output_tokens: 220,
      }),
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("[AI WhatsApp Message] OpenAI error:", data);

      return NextResponse.json({
        success: true,
        provider: "fallback",
        message: fallback,
        warning: data?.error?.message || "OpenAI no respondió correctamente",
      });
    }

    const generated = cleanWhatsAppMessage(
      data?.output_text ||
        data?.output?.[0]?.content?.[0]?.text ||
        "",
    );

    return NextResponse.json({
      success: true,
      provider: generated ? "openai" : "fallback",
      message: generated || fallback,
    });
  } catch (error: any) {
    console.error("[AI WhatsApp Message] Error:", error);

    return NextResponse.json(
      {
        error: error?.message || "Error generando mensaje IA",
      },
      { status: 500 },
    );
  }
}
