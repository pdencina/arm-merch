import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: { readerId: string } }
) {
  try {
    const apiKey = process.env.SUMUP_API_KEY
    const merchantCode = process.env.SUMUP_MERCHANT_CODE

    if (!apiKey || !merchantCode) {
      return NextResponse.json(
        { error: 'Faltan SUMUP_API_KEY o SUMUP_MERCHANT_CODE' },
        { status: 500 }
      )
    }

    const readerId = params.readerId

    if (!readerId) {
      return NextResponse.json(
        { error: 'Falta readerId' },
        { status: 400 }
      )
    }

    const res = await fetch(
      `https://api.sumup.com/v0.1/merchants/${merchantCode}/readers/${readerId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      return NextResponse.json(
        {
          error: 'Error obteniendo estado del reader',
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
        error: error?.message ?? 'Error interno consultando reader',
      },
      { status: 500 }
    )
  }
}