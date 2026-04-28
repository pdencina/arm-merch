import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://armerch-poud.vercel.app'
    const checkoutRef = order_id ?? `arm-${Date.now()}`

    const checkoutRes = await fetch('https://api.sumup.com/v0.1/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        checkout_reference: checkoutRef,
        amount: Number(amount),
        currency,
        merchant_code: merchantCode,
        description,
        hosted_checkout: { enabled: true },
        // return_url = SumUp llama este endpoint (POST) cuando el checkout cambia de estado
        return_url: `${appUrl}/api/sumup/webhook`,
        // redirect_url = donde va el cliente en su browser tras pagar
        redirect_url: `${appUrl}/payment=success`,
      }),
    })

    const checkoutData = await checkoutRes.json()
    console.log('[SumUp] Checkout response:', JSON.stringify(checkoutData))

    if (!checkoutRes.ok) {
      return NextResponse.json(
        {
          error: checkoutData?.message ?? 'Error creando checkout en SumUp',
          sumup_error: checkoutData,
        },
        { status: 400 }
      )
    }

    const paymentUrl = checkoutData.hosted_checkout_url

    if (!paymentUrl) {
      return NextResponse.json(
        { error: 'SumUp no retornó URL de pago. Verifica que tu cuenta tenga Hosted Checkout habilitado.' },
        { status: 400 }
      )
    }

    console.log('[SumUp] Checkout created:', checkoutData.id, paymentUrl)

    return NextResponse.json({
      success: true,
      checkout_id: checkoutData.id,
      checkout_reference: checkoutRef,
      payment_url: paymentUrl,
    })

  } catch (error: any) {
    console.error('[SumUp] Error:', error)
    return NextResponse.json({ error: error?.message ?? 'Error interno' }, { status: 500 })
  }
}
