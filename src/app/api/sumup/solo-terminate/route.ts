import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const sumupApiKey = process.env.SUMUP_API_KEY!;
    const sumupMerchantCode = process.env.SUMUP_MERCHANT_CODE!;
    const sumupApiBase =
      process.env.SUMUP_API_BASE || "https://api.sumup.com";

    const authClient = createClient(
      supabaseUrl,
      supabaseAnonKey
    );

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const orderId = String(body?.order_id ?? "").trim();

    if (!orderId) {
      return NextResponse.json(
        { error: "order_id requerido" },
        { status: 400 }
      );
    }

    const { data: order } = await adminClient
      .from("orders")
      .select("id, campus_id")
      .eq("id", orderId)
      .single();

    if (!order) {
      return NextResponse.json(
        { error: "Orden no encontrada" },
        { status: 404 }
      );
    }

    const { data: reader } = await adminClient
      .from("sumup_readers")
      .select("reader_id")
      .eq("campus_id", order.campus_id)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (!reader?.reader_id) {
      return NextResponse.json(
        { error: "No hay lector SOLO activo" },
        { status: 404 }
      );
    }

    const terminateRes = await fetch(
      `${sumupApiBase}/v0.1/merchants/${encodeURIComponent(
        sumupMerchantCode
      )}/readers/${encodeURIComponent(
        reader.reader_id
      )}/terminate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sumupApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const terminateData = await terminateRes
      .json()
      .catch(() => null);

    await adminClient
      .from("orders")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    return NextResponse.json({
      success: true,
      terminated: true,
      sumup: terminateData,
    });
  } catch (error: any) {
    console.error("[SOLO TERMINATE]", error);

    return NextResponse.json(
      {
        error:
          error?.message ??
          "Error cancelando transacción SOLO",
      },
      { status: 500 }
    );
  }
}