import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const sumupApiKey = process.env.SUMUP_API_KEY
  const sumupMerchantCode = process.env.SUMUP_MERCHANT_CODE
  const sumupAffiliateKey = process.env.SUMUP_AFFILIATE_KEY
  const sumupApiBase = process.env.SUMUP_API_BASE || 'https://api.sumup.com'

  return {
    supabaseUrl,
    supabaseAnonKey,
    serviceRoleKey,
    sumupApiKey,
    sumupMerchantCode,
    sumupAffiliateKey,
    sumupApiBase,
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

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Faltan variables de entorno de Supabase' },
        { status: 500 }
      ),
    }
  }

  const authClient = createClient(
    supabaseUrl,
    supabaseAnonKey
  )

  const adminClient = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(token)

  if (userError || !user) {
    return {
      errorResponse: NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      ),
    }
  }

  const {
    data: profile,
    error: profileError,
  } = await adminClient
    .from('profiles')
    .select('id, role, campus_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return {
      errorResponse: NextResponse.json(
        { error: 'No se pudo cargar el perfil del usuario' },
        { status: 403 }
      ),
    }
  }

  return {
    adminClient,
    user,
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

    if (!sumupApiKey || !sumupMerchantCode) {
      return NextResponse.json(
        {
          error:
            'Faltan variables SUMUP_API_KEY o SUMUP_MERCHANT_CODE',
        },
        { status: 500 }
      )
    }

    const body = await req.json().catch(() => ({}))

    const orderId = String(body?.order_id ?? '').trim()

    const amount = Math.round(
      Number(body?.amount ?? body?.total ?? 0)
    )

    const currency = String(
      body?.currency ?? 'CLP'
    ).toUpperCase()

    if (!orderId) {
      return NextResponse.json(
        { error: 'order_id es obligatorio' },
        { status: 400 }
      )
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'amount inválido' },
        { status: 400 }
      )
    }

    const {
      data: order,
      error: orderError,
    } = await adminClient
      .from('orders')
      .select('id, order_number, campus_id, status, total')
      .eq('id', orderId)
      .maybeSingle()

    if (orderError || !order) {
      return NextResponse.json(
        {
          error:
            'Orden no encontrada para iniciar cobro SOLO',
        },
        { status: 404 }
      )
    }

    if (order.status === 'paid') {
      return NextResponse.json(
        { error: 'La orden ya está pagada' },
        { status: 400 }
      )
    }

    const campusId =
      order.campus_id ?? profile.campus_id

    if (!campusId) {
      return NextResponse.json(
        {
          error: 'La orden no tiene campus asociado',
        },
        { status: 400 }
      )
    }

    const {
      data: reader,
      error: readerError,
    } = await adminClient
      .from('sumup_readers')
      .select(
        'id, reader_id, name, status, active, campus_id'
      )
      .eq('campus_id', campusId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (readerError) {
      return NextResponse.json(
        { error: readerError.message },
        { status: 400 }
      )
    }

    if (!reader?.reader_id) {
      return NextResponse.json(
        {
          error:
            'No hay lector SumUp SOLO activo para este campus',
        },
        { status: 404 }
      )
    }

    /*
      IMPORTANTE:

      SumUp SOLO espera montos en CENTAVOS cuando
      minor_unit = 2.

      Ejemplo:
      $100 CLP  -> value: 10000
      $1.500    -> value: 150000
    */

    const checkoutReference = `arm-merch-order-${order.order_number}-${Date.now()}`

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://armerch.com').replace(/\/$/, '')

    const payload: any = {
      total_amount: {
        currency,
        minor_unit: 2,
        value: amount * 100,
      },

      checkout_reference: finalCheckoutReference,

      description: `ARM Merch Orden #${order.order_number}`,

      webhook_url: `${appUrl}/api/sumup/solo-webhook`,

      metadata: {
        order_id: order.id,
        order_number: order.order_number,
        checkout_reference: finalCheckoutReference,
      },
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${sumupApiKey}`,
      'Content-Type': 'application/json',
    }

    if (sumupAffiliateKey) {
      headers['X-Affiliate-Key'] =
        sumupAffiliateKey
    }

    const sumupRes = await fetch(
      `${sumupApiBase}/v0.1/merchants/${encodeURIComponent(
        sumupMerchantCode
      )}/readers/${encodeURIComponent(
        reader.reader_id
      )}/checkout`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        cache: 'no-store',
      }
    )

    const rawText = await sumupRes.text()

    let sumupCheckout: any = {}

    try {
      sumupCheckout = JSON.parse(rawText)
    } catch {
      sumupCheckout = { raw: rawText }
    }

    console.log(
      '[SumUp SOLO Checkout] request payload:',
      payload
    )

    console.log(
      '[SumUp SOLO Checkout] response:',
      sumupRes.status,
      sumupCheckout
    )

    console.log(
      '[SumUp SOLO Checkout] KEYS:',
      Object.keys(sumupCheckout || {})
    )

    console.log(
      '[SumUp SOLO Checkout] DATA KEYS:',
      Object.keys(sumupCheckout?.data || {})
    )

    if (!sumupRes.ok) {
      return NextResponse.json(
        {
          error:
            sumupCheckout?.message ??
            sumupCheckout?.error ??
            'SumUp rechazó el checkout SOLO',

          detail: sumupCheckout,
        },
        { status: 400 }
      )
    }

    const checkoutId =
      sumupCheckout?.id ??
      sumupCheckout?.checkout_id ??
      sumupCheckout?.checkout?.id ??
      sumupCheckout?.client_transaction_id ??
      sumupCheckout?.client_transaction?.id ??
      sumupCheckout?.transaction_id ??
      sumupCheckout?.transaction?.id ??
      sumupCheckout?.transaction?.transaction_id ??
      sumupCheckout?.transaction?.client_transaction_id ??
      sumupCheckout?.data?.id ??
      sumupCheckout?.data?.checkout_id ??
      sumupCheckout?.data?.checkout?.id ??
      sumupCheckout?.data?.client_transaction_id ??
      sumupCheckout?.data?.transaction_id ??
      sumupCheckout?.data?.transaction?.id ??
      sumupCheckout?.data?.transaction?.transaction_id ??
      sumupCheckout?.data?.transaction?.client_transaction_id ??
      null

    const finalCheckoutReference =
      sumupCheckout?.checkout_reference ??
      sumupCheckout?.checkout?.checkout_reference ??
      sumupCheckout?.data?.checkout_reference ??
      sumupCheckout?.data?.checkout?.checkout_reference ??
      checkoutReference

    const { error: updateOrderError } =
      await adminClient
        .from('orders')
        .update({
          status: 'pending',
          payment_method: 'solo',
          sumup_checkout_id: checkoutId,
          notes: checkoutId
            ? `SumUp SOLO | Reader: ${reader.reader_id} | Ref: ${finalCheckoutReference} | Checkout: ${checkoutId}`
            : `SumUp SOLO | Reader: ${reader.reader_id} | Ref: ${finalCheckoutReference} | SIN_CHECKOUT_ID | Keys: ${Object.keys(sumupCheckout || {}).join(',')}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

    if (updateOrderError) {
      console.error(
        '[SumUp SOLO Checkout] order update error:',
        updateOrderError
      )
    }

    return NextResponse.json({
      success: true,

      order_id: order.id,

      order_number: order.order_number,

      amount_sent_to_sumup: amount * 100,

      currency,

      minor_unit: 2,

      reader_id: reader.reader_id,

      reader_name: reader.name,

      checkout_id: checkoutId,

      checkout_reference: finalCheckoutReference,

      has_checkout_id: Boolean(checkoutId),

      response_keys: Object.keys(sumupCheckout || {}),

      data_keys: Object.keys(sumupCheckout?.data || {}),

      status:
        sumupCheckout?.status ??
        sumupCheckout?.reader_status ??
        sumupCheckout?.data?.status ??
        'sent_to_reader',

      sumup: sumupCheckout,
    })
  } catch (error: any) {
    console.error(
      '[SumUp SOLO Checkout] Error:',
      error
    )

    return NextResponse.json(
      {
        error:
          error?.message ??
          'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}