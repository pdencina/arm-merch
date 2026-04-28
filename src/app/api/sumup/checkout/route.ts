import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const apiKey       = process.env.SUMUP_API_KEY
    const merchantCode = process.env.SUMUP_MERCHANT_CODE ?? 'MGSXCYTL'

    if (!apiKey) {
      return NextResponse.json(
        { error: 'SUMUP_API_KEY no configurada en Vercel' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const { amount, description, order_id, currency = 'CLP' } = body

    if (!amount || !description) {
      return NextResponse.json(
        { error: 'amount y description son requeridos' },
        { status: 400 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://arm-merch.vercel.app'
    const checkoutRef = order_id ?? `arm-${Date.now()}`

    const checkoutRes = await fetch('https://api.sumup.com/v0.1/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        checkout_reference: String(checkoutRef),
        amount: Number(amount),
        currency: 'CLP',
        merchant_code: merchantCode,
        description: String(description),

        // IMPORTANTE: redirección correcta después del pago
        redirect_url: `${appUrl}/pos?payment=success&order_id=${checkoutRef}`,

        // Hosted checkout activo
        hosted_checkout: {
          enabled: true,
        },
      }),
    })

    // 👇 Leer respuesta REAL de SumUp (clave para debug)
    const rawText = await checkoutRes.text()
    let checkoutData: any = {}

    try {
      checkoutData = JSON.parse(rawText)
    } catch {
      checkoutData = { raw: rawText }
    }

    console.log('[SumUp] STATUS:', checkoutRes.status)
    console.log('[SumUp] RESPONSE:', checkoutData)

    if (!checkoutRes.ok) {
      return NextResponse.json(
        {
          error: checkoutData?.message ?? 'Error creando checkout en SumUp',
          sumup_error: checkoutData,
        },
        { status: checkoutRes.status }
      )
    }

    const paymentUrl = checkoutData.hosted_checkout_url

    if (!paymentUrl) {
      return NextResponse.json(
        {
          error: 'SumUp no retornó URL de pago. Revisa que Hosted Checkout esté habilitado.',
          sumup_error: checkoutData,
        },
        { status: 400 }
      )
    }

    console.log('[SumUp] Checkout creado:', checkoutData.id, paymentUrl)

    return NextResponse.json({
      success: true,
      checkout_id: checkoutData.id,
      checkout_reference: checkoutRef,
      payment_url: paymentUrl,
    })

  } catch (error: any) {
    console.error('[SumUp] ERROR:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Error interno' },
      { status: 500 }
    )
  }
}