import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const apiKey = process.env.SUMUP_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "SUMUP_API_KEY no configurada" },
        { status: 500 }
      );
    }

    const body = await req.json();

    const checkoutId = body.checkout_id;

    if (!checkoutId) {
      return NextResponse.json(
        { error: "checkout_id requerido" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://api.sumup.com/v0.1/checkouts/${checkoutId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        cache: "no-store",
      }
    );

    const data = await response.json();

    console.log("[CHECKOUT STATUS]", JSON.stringify(data, null, 2));

    const checkoutStatus = String(
      data?.status || ""
    ).toUpperCase();

    const transactionStatus = String(
      data?.transactions?.[0]?.status || ""
    ).toUpperCase();

    console.log("checkoutStatus:", checkoutStatus);
    console.log("transactionStatus:", transactionStatus);

    // ─────────────────────────────
    // APROBADO
    // ─────────────────────────────
    if (
      ["SUCCESSFUL", "PAID", "COMPLETED"].includes(
        transactionStatus
      )
    ) {
      return NextResponse.json({
        ok: true,
        status: "paid",
      });
    }

    // ─────────────────────────────
    // RECHAZADO
    // ─────────────────────────────
    if (
      [
        "FAILED",
        "DECLINED",
        "CANCELLED",
        "CANCELED",
        "EXPIRED",
      ].includes(transactionStatus)
    ) {
      return NextResponse.json({
        ok: true,
        status: "cancelled",
      });
    }

    // ─────────────────────────────
    // PENDIENTE
    // ─────────────────────────────
    return NextResponse.json({
      ok: true,
      status: "pending",
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500 }
    );
  }
}