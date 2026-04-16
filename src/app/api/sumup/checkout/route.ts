import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const { amount, description } = body

    const apiKey = process.env.SUMUP_API_KEY
    const affiliateKey = process.env.SUMUP_AFFILIATE_KEY
    const merchantCode = process.env.SUMUP_MERCHANT_CODE

    if (!apiKey || !affiliateKey || !merchantCode) {
      return NextResponse.json(
        { error: 'Faltan variables de entorno de SumUp' },
        { status: 500 }
      )
    }

    const res = await fetch('https://api.sumup.com/v0.1/checkouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        checkout_reference: `order-${Date.now()}`,
        amount,
        currency: 'CLP',
        pay_to_email: undefined,
        description: description || 'Compra ARM Merch',

        affiliate: {
          affiliate_key: affiliateKey,
        },

        merchant_code: merchantCode,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Error creando checkout', detail: data },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      checkout: data,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    )
  }
}