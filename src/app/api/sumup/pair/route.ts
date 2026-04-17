import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const apiKey = process.env.SUMUP_API_KEY
    const merchantCode = process.env.SUMUP_MERCHANT_CODE

    if (!apiKey || !merchantCode) {
      return NextResponse.json(
        { error: 'Faltan SUMUP_API_KEY o SUMUP_MERCHANT_CODE' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const pairingCode = String(body?.pairing_code ?? '').trim()
    const name = String(body?.name ?? 'ARM Merch POS').trim()

    if (!pairingCode) {
      return NextResponse.json(
        { error: 'Debes enviar pairing_code' },
        { status: 400 }
      )
    }

    const res = await fetch(
      `https://api.sumup.com/v0.1/merchants/${merchantCode}/readers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pairing_code: pairingCode,
          name,
        }),
      }
    )

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      return NextResponse.json(
        {
          error: 'Error emparejando reader',
          detail: data,
        },
        { status: res.status }
      )
    }

    return NextResponse.json({
      success: true,
      reader: data,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message ?? 'Error interno al emparejar reader',
      },
      { status: 500 }
    )
  }
}