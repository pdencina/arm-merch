import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function jsonError(message: string, status = 400, detail?: any) {
  return NextResponse.json({ success: false, error: message, detail }, { status })
}

function getEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    sumupApiKey: process.env.SUMUP_API_KEY,
    merchantCode: process.env.SUMUP_MERCHANT_CODE,
    sumupApiBase: process.env.SUMUP_API_BASE || 'https://api.sumup.com',
    affiliateKey:
      process.env.SUMUP_AFFILIATE_KEY ||
      process.env.SUMUP_AFFILIATE_KEY?.trim() ||
      process.env.SUMUP_AFFILIATE_KEY,
    appId: process.env.SUMUP_APP_ID || 'com.arm.merch.pos',
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://armerch.com',
  }
}

async function getAuthenticatedContext(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return { errorResponse: jsonError('No autenticado', 401) }
  }

  const token = authHeader.replace('Bearer ', '').trim()
  const { supabaseUrl, supabaseAnonKey, serviceRoleKey } = getEnv()

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return { errorResponse: jsonError('Faltan variables de entorno de Supabase', 500) }
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey)
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(token)

  if (userError || !user) {
    return { errorResponse: jsonError('No autenticado', 401) }
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role, campus_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { errorResponse: jsonError('No se pudo cargar el perfil', 403) }
  }

  return { adminClient, user, profile }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedContext(req)
    if (auth.errorResponse) return auth.errorResponse

    const { adminClient, profile } = auth
    const {
      sumupApiKey,
      merchantCode,
      sumupApiBase,
      affiliateKey,
      appId,
      appUrl,
    } = getEnv()

    if (!sumupApiKey || !merchantCode) {
      return jsonError('Faltan SUMUP_API_KEY o SUMUP_MERCHANT_CODE', 500)
    }

    if (!affiliateKey || !appId) {
      return jsonError('Faltan SUMUP_AFFILIATE_KEY o SUMUP_APP_ID para Cloud API', 500)
    }

    const body = await req.json().catch(() => ({}))
    const orderId = String(body?.order_id ?? '').trim()
    const amount = Math.round(Number(body?.amount ?? 0))

    if (!orderId) return jsonError('order_id es obligatorio')
    if (!amount || amount <= 0) return jsonError('Monto inválido')

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, order_number, campus_id, status, total, notes')
      .eq('id', orderId)
      .maybeSingle()

    if (orderError) return jsonError('Error consultando la orden', 500, orderError)
    if (!order) return jsonError('Orden no encontrada', 404)
    if (order.status === 'paid') return jsonError('La orden ya está pagada')
    if (order.status === 'cancelled') return jsonError('La orden está cancelada')

    const campusId = order.campus_id || profile.campus_id

    if (!campusId) {
      return jsonError('La orden no tiene campus asociado')
    }

    const { data: reader, error: readerError } = await adminClient
      .from('sumup_readers')
      .select('*')
      .eq('campus_id', campusId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (readerError) return jsonError('Error buscando lector SumUp SOLO', 500, readerError)
    if (!reader?.reader_id) {
      return jsonError('No hay lector SumUp SOLO activo para este campus')
    }

    const foreignTransactionId = `arm-order-${order.id}`
    const returnUrl = `${appUrl.replace(/\/$/, '')}/api/sumup/solo-webhook?order_id=${encodeURIComponent(order.id)}`

    const sumupPayload = {
      total_amount: {
        currency: 'CLP',
        minor_unit: 0,
        value: amount,
      },
      description: `ARM Merch Orden #${order.order_number}`,
      return_url: returnUrl,
      affiliate: {
        app_id: appId,
        key: affiliateKey,
        foreign_transaction_id: foreignTransactionId,
        tags: {
          order_id: order.id,
          order_number: String(order.order_number ?? ''),
          campus_id: campusId,
          source: 'arm_merch_pos',
        },
      },
    }

    const sumupRes = await fetch(
      `${sumupApiBase}/v0.1/merchants/${encodeURIComponent(merchantCode)}/readers/${encodeURIComponent(reader.reader_id)}/checkout`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sumupApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sumupPayload),
        cache: 'no-store',
      },
    )

    const rawText = await sumupRes.text()
    let sumupData: any = {}

    try {
      sumupData = JSON.parse(rawText)
    } catch {
      sumupData = { raw: rawText }
    }

    if (!sumupRes.ok) {
      console.error('[SOLO Checkout] SumUp error:', sumupRes.status, sumupData)
      return jsonError(
        sumupData?.detail || sumupData?.message || sumupData?.error || 'SumUp rechazó el cobro SOLO',
        400,
        sumupData,
      )
    }

    const clientTransactionId =
      sumupData?.data?.client_transaction_id ||
      sumupData?.client_transaction_id ||
      foreignTransactionId

    await adminClient
      .from('orders')
      .update({
        status: 'pending',
        payment_method: 'sumup',
        sumup_checkout_id: clientTransactionId,
        notes: `SumUp SOLO | Reader: ${reader.reader_id} | CTX: ${clientTransactionId}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    return NextResponse.json({
      success: true,
      order_id: order.id,
      order_number: order.order_number,
      client_transaction_id: clientTransactionId,
      reader: {
        id: reader.id,
        name: reader.name,
        reader_id: reader.reader_id,
        campus_id: reader.campus_id,
      },
      sumup: sumupData,
    })
  } catch (error: any) {
    console.error('[SOLO Checkout] Error:', error)
    return jsonError(error?.message ?? 'Error interno iniciando cobro SOLO', 500)
  }
}
