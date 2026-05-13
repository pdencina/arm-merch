import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const apiKey = process.env.SUMUP_API_KEY
    const merchantCode = process.env.SUMUP_MERCHANT_CODE
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://armerch.com').replace(/\/$/, '')

    if (!apiKey) {
      return NextResponse.json(
        { error: 'SUMUP_API_KEY no configurada en Vercel' },
        { status: 500 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const amount = Number(body?.amount)
    const currency = String(body?.currency ?? 'CLP').toUpperCase()
    const description = String(body?.description ?? 'Compra ARM Merch')
    const orderId = String(body?.order_id ?? `arm-${Date.now()}`)

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'amount es requerido y debe ser mayor a 0' },
        { status: 400 },
      )
    }

    const checkoutReference = orderId.startsWith('arm-')
      ? orderId
      : `arm-${orderId}-${Date.now()}`

    const sumupPayload: Record<string, any> = {
      checkout_reference: checkoutReference,
      amount: Number(amount.toFixed(2)),
      currency,
      description,
      hosted_checkout: {
        enabled: true,
      },
      redirect_url: `${appUrl}/payment/success?checkout_reference=${encodeURIComponent(checkoutReference)}`,
    }

    if (merchantCode) {
      sumupPayload.merchant_code = merchantCode
    }

    console.log('[SumUp Checkout] Request payload:', sumupPayload)

    const checkoutRes = await fetch('https://api.sumup.com/v0.1/checkouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sumupPayload),
      cache: 'no-store',
    })

    const checkoutText = await checkoutRes.text()
    let checkoutData: any = {}

    try {
      checkoutData = JSON.parse(checkoutText)
    } catch {
      checkoutData = { raw: checkoutText }
    }

    console.log('[SumUp Checkout] Status:', checkoutRes.status)
    console.log('[SumUp Checkout] Response:', checkoutData)

    if (!checkoutRes.ok) {
      return NextResponse.json(
        {
          error: checkoutData?.message ?? checkoutData?.error_message ?? 'Error creando checkout en SumUp',
          sumup_error: checkoutData,
          sent_payload: {
            ...sumupPayload,
            // no secrets here
          },
        },
        { status: checkoutRes.status },
      )
    }

    const paymentUrl =
      checkoutData?.hosted_checkout_url ??
      checkoutData?.payment_url ??
      checkoutData?.checkout_url ??
      checkoutData?.links?.find?.((link: any) => link?.rel === 'checkout')?.href

    if (!paymentUrl) {
      return NextResponse.json(
        {
          error: 'SumUp creó el checkout pero no retornó URL de pago.',
          sumup_response: checkoutData,
        },
        { status: 400 },
      )
    }

    return NextResponse.json({
      success: true,
      checkout_id: checkoutData?.id,
      checkout_reference: checkoutData?.checkout_reference ?? checkoutReference,
      payment_url: paymentUrl,
      status: checkoutData?.status ?? 'PENDING',
    })
  } catch (error: any) {
    console.error('[SumUp Checkout] Error:', error)

    return NextResponse.json(
      { error: error?.message ?? 'Error interno creando checkout SumUp' },
      { status: 500 },
    )
  }
}
