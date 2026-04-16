import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const apiKey = process.env.SUMUP_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Falta SUMUP_API_KEY en variables de entorno' },
        { status: 500 }
      )
    }

    const res = await fetch('https://api.sumup.com/v0.1/me', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!res.ok) {
      const errorText = await res.text()
      return NextResponse.json(
        { error: 'Error conectando con SumUp', detail: errorText },
        { status: 500 }
      )
    }

    const data = await res.json()

    return NextResponse.json({
      success: true,
      merchant: data,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    )
  }
}