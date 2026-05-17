import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

    sumupApiKey: process.env.SUMUP_API_KEY,
    sumupMerchantCode: process.env.SUMUP_MERCHANT_CODE,
    sumupAffiliateKey: process.env.SUMUP_AFFILIATE_KEY,

    sumupApiBase:
      process.env.SUMUP_API_BASE ||
      'https://api.sumup.com',
  }
}

async function getSessionUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      errorResponse: NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      ),
    }
  }

  const token = authHeader.replace('Bearer ', '').trim()

  const {
    supabaseUrl,
    supabaseAnonKey,
    serviceRoleKey,
  } = getEnv()

  const authClient = createClient(
    supabaseUrl!,
    supabaseAnonKey!
  )

  const adminClient = createClient(
    supabaseUrl!,
    serviceRoleKey!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  const {
    data: { user },
  } = await authClient.auth.getUser(token)

  if (!user) {
    return {
      errorResponse: NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      ),
    }
  }

  const { data: profile } = await adminClient
    .from('profiles')
    .select('id, campus_id')
    .eq('id', user.id)
    .single()

  return {
    adminClient,
    profile,
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getSessionUser(req)

    if (auth.errorResponse) {
      return auth.errorResponse
    }

    const { adminClient, profile } = auth

    const {
      sumupApiKey,
      sumupMerchantCode,
      sumupAffiliateKey,
      sumupApiBase,
    } = getEnv()

    const body = await req.json()

    const orderId = String(body.order_id || '')
    const amount = Number(body.amount || 0)

    const { data: order } = await adminClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (!order) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      )
    }

    const campusId =
      order.campus_id || profile?.campus_id

    const { data: reader } = await adminClient
      .from('sumup_readers')
      .select('*')
      .eq('campus_id', campusId)
      .eq('active', true)
      .limit(1)
      .single()

    if (!reader?.reader_id) {
      return NextResponse.json(
        {
          error:
            'No hay lector SOLO configurado',
        },
        { status: 400 }
      )
    }

    const checkoutReference = `arm-merch-order-${order.order_number}-${Date.now()}`

    const payload = {
      total_amount: {
        currency: 'CLP',
        minor_unit: 2,
        value: Math.round(amount * 100),
      },

      checkout_reference: checkoutReference,

      description: `ARM Merch Orden #${order.order_number}`,

      return_url:
        'https://www.armerch.com/api/sumup/solo-webhook',
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${sumupApiKey}`,
      'Content-Type': 'application/json',
    }

    if (sumupAffiliateKey) {
      headers['X-Affiliate-Key'] =
        sumupAffiliateKey
    }

    const response = await fetch(
      `${sumupApiBase}/v0.1/merchants/${sumupMerchantCode}/readers/${reader.reader_id}/checkout`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      }
    )

    const data = await response.json()

    console.log(
      '[SOLO CHECKOUT RESPONSE]',
      data
    )

    const checkoutId =
      data?.id ||
      data?.checkout_id ||
      data?.data?.id ||
      null

    await adminClient
      .from('orders')
      .update({
        status: 'pending',
        payment_method: 'solo',

        sumup_checkout_id: checkoutId,

        sumup_checkout_reference:
          checkoutReference,

        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    return NextResponse.json({
      success: true,

      checkout_id: checkoutId,

      checkout_reference:
        checkoutReference,

      order_number: order.order_number,

      raw: data,
    })
  } catch (error: any) {
    console.error(
      '[SOLO CHECKOUT ERROR]',
      error
    )

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Error interno',
      },
      { status: 500 }
    )
  }
}