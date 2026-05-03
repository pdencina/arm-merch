import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── POST /api/sumup/checkout ──────────────────────────────────────────────────
// Crea un Hosted Checkout en SumUp y retorna la URL de pago.
// El frontend envía esa URL por WhatsApp al cliente.
// ─────────────────────────────────────────────────────────────────────────────

const log = (...args: any[]) => process.env.NODE_ENV !== 'production' && console.log(...args)


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

    // ── Crear Hosted Checkout en SumUp ────────────────────────────────────────
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
        currency: currency ?? 'CLP',
        merchant_code: merchantCode,
        description,
        hosted_checkout: {
          enabled: true,
        },
        // return_url = webhook que SumUp llama cuando el pago se completa
        return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://armerch-poud.vercel.app'}/api/sumup/webhook`,
        // redirect_url = donde va el cliente tras pagar (página de éxito)
        redirect_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://armerch-poud.vercel.app'}/pos?payment=success`,
      }),
    })

    const checkoutData = await checkoutRes.json()

    if (!checkoutRes.ok) {
      console.error('[SumUp] Checkout error full:', JSON.stringify(checkoutData))
      return NextResponse.json(
        {
          error: checkoutData?.message ?? 'Error creando checkout en SumUp',
          sumup_error: checkoutData,
          api_key_present: !!apiKey,
          merchant_code: merchantCode,
        },
        { status: 400 }
      )
    }

    const paymentUrl = checkoutData.hosted_checkout_url
    const checkoutId = checkoutData.id

    if (!paymentUrl) {
      return NextResponse.json(
        { error: 'SumUp no retornó URL de pago. Verifica que tu cuenta tenga Hosted Checkout habilitado.' },
        { status: 400 }
      )
    }

    log('[SumUp] Checkout created:', checkoutId, paymentUrl)

    return NextResponse.json({
      success: true,
      checkout_id: checkoutId,
      checkout_reference: checkoutRef,
      payment_url: paymentUrl,
    })

  } catch (error: any) {
    console.error('[SumUp] Error:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Error interno' },
      { status: 500 }
    )
  }
}
