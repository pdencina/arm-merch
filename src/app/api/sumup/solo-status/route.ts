import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PAID_STATUSES = [
  'PAID',
  'SUCCESS',
  'SUCCESSFUL',
  'APPROVED',
  'COMPLETED',
  'COMPLETE',
  'FINISHED',
  'CHECKOUT_FINISHED',
]

const FAILED_STATUSES = [
  'FAILED',
  'FAIL',
  'CANCELLED',
  'CANCELED',
  'DECLINED',
  'REJECTED',
  'EXPIRED',
  'TIMEOUT',
  'TIMED_OUT',
  'ERROR',
]

const WAITING_STATUSES = [
  'ONLINE',
  'PROCESSING',
  'WAITING_FOR_CARD',
  'WAITING_FOR_PIN',
  'WAITING_FOR_CUSTOMER',
  'PENDING',
  'SENT_TO_READER',
  'CREATED',
]

function normalize(value: unknown) {
  return String(value ?? '').trim().toUpperCase()
}

function getEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    sumupApiKey: process.env.SUMUP_API_KEY,
    sumupMerchantCode: process.env.SUMUP_MERCHANT_CODE,
    sumupApiBase: process.env.SUMUP_API_BASE || 'https://api.sumup.com',
  }
}

async function getAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      errorResponse: NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 }),
    }
  }

  const token = authHeader.replace('Bearer ', '').trim()
  const { supabaseUrl, supabaseAnonKey, serviceRoleKey } = getEnv()

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: 'Faltan variables de entorno de Supabase' },
        { status: 500 }
      ),
    }
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
    return {
      errorResponse: NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 }),
    }
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role, campus_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: 'No se pudo cargar el perfil' },
        { status: 403 }
      ),
    }
  }

  return { adminClient, user, profile }
}

function extractReaderStatus(payload: any) {
  return normalize(
    payload?.status ??
    payload?.reader_status ??
    payload?.device_status ??
    payload?.checkout_status ??
    payload?.transaction_status ??
    payload?.last_transaction?.status ??
    payload?.transaction?.status
  )
}

function extractTransactionCode(payload: any) {
  return (
    payload?.transaction_code ??
    payload?.transaction?.transaction_code ??
    payload?.last_transaction?.transaction_code ??
    payload?.transactions?.[0]?.transaction_code ??
    payload?.transaction?.id ??
    payload?.last_transaction?.id ??
    payload?.transactions?.[0]?.id ??
    null
  )
}

async function markOrderPaid({
  adminClient,
  order,
  transactionCode,
  readerId,
  rawStatus,
}: {
  adminClient: any
  order: any
  transactionCode?: string | null
  readerId?: string | null
  rawStatus?: string | null
}) {
  if (order.status === 'paid') {
    return
  }

  const { error: updateError } = await adminClient
    .from('orders')
    .update({
      status: 'paid',
      notes: `SumUp SOLO pagado | Reader: ${readerId ?? 'N/A'} | TX: ${transactionCode ?? 'N/A'} | Estado: ${rawStatus ?? 'PAID'}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)

  if (updateError) {
    throw new Error(updateError.message)
  }

  for (const item of order.order_items ?? []) {
    const { error: movementError } = await adminClient
      .from('inventory_movements')
      .insert({
        product_id: item.product_id,
        campus_id: order.campus_id,
        type: 'salida',
        quantity: item.quantity,
        notes: `SumUp SOLO - Orden #${order.order_number} - TX ${transactionCode ?? 'N/A'}`,
      })

    if (movementError) {
      console.error('[SOLO Status] Inventory movement error:', movementError)
    }
  }
}

async function markOrderFailed({
  adminClient,
  order,
  readerId,
  rawStatus,
}: {
  adminClient: any
  order: any
  readerId?: string | null
  rawStatus?: string | null
}) {
  if (order.status === 'paid' || order.status === 'cancelled') {
    return
  }

  const { error } = await adminClient
    .from('orders')
    .update({
      status: 'cancelled',
      notes: `SumUp SOLO rechazado/cancelado | Reader: ${readerId ?? 'N/A'} | Estado: ${rawStatus ?? 'FAILED'}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)

  if (error) {
    throw new Error(error.message)
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth(req)
    if (auth.errorResponse) return auth.errorResponse

    const { adminClient, profile } = auth
    const { sumupApiKey, sumupMerchantCode, sumupApiBase } = getEnv()

    if (!sumupApiKey || !sumupMerchantCode) {
      return NextResponse.json(
        { success: false, error: 'Faltan variables SUMUP_API_KEY o SUMUP_MERCHANT_CODE' },
        { status: 500 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const orderId = String(body?.order_id ?? '').trim()
    const readerIdFromBody = body?.reader_id ? String(body.reader_id) : null

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'order_id es obligatorio' }, { status: 400 })
    }

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select(`
        id,
        order_number,
        campus_id,
        status,
        total,
        sumup_checkout_id,
        notes,
        order_items(product_id, quantity, unit_price, size)
      `)
      .eq('id', orderId)
      .maybeSingle()

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Orden no encontrada' },
        { status: 404 }
      )
    }

    if (order.status === 'paid') {
      return NextResponse.json({
        success: true,
        final: true,
        paid: true,
        status: 'paid',
        message: 'Pago confirmado',
        order_number: order.order_number,
      })
    }

    if (order.status === 'cancelled') {
      return NextResponse.json({
        success: true,
        final: true,
        paid: false,
        status: 'cancelled',
        message: 'Pago cancelado o rechazado',
        order_number: order.order_number,
      })
    }

    const campusId = order.campus_id ?? profile.campus_id

    let readerId = readerIdFromBody

    if (!readerId) {
      const { data: reader, error: readerError } = await adminClient
        .from('sumup_readers')
        .select('reader_id, name')
        .eq('campus_id', campusId)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (readerError) {
        return NextResponse.json({ success: false, error: readerError.message }, { status: 400 })
      }

      readerId = reader?.reader_id ?? null
    }

    if (!readerId) {
      return NextResponse.json(
        { success: false, error: 'No hay lector SumUp SOLO activo para esta orden' },
        { status: 404 }
      )
    }

    const statusUrl = `${sumupApiBase}/v0.1/merchants/${encodeURIComponent(sumupMerchantCode)}/readers/${encodeURIComponent(readerId)}/status`

    const sumupRes = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${sumupApiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    const rawText = await sumupRes.text()
    let sumupStatusPayload: any = {}

    try {
      sumupStatusPayload = JSON.parse(rawText)
    } catch {
      sumupStatusPayload = { raw: rawText }
    }

    console.log('[SOLO Status] SumUp HTTP:', sumupRes.status)
    console.log('[SOLO Status] SumUp payload:', JSON.stringify(sumupStatusPayload))

    if (!sumupRes.ok) {
      return NextResponse.json(
        {
          success: false,
          final: false,
          status: 'error',
          message: 'No se pudo consultar el estado del SOLO',
          detail: sumupStatusPayload,
        },
        { status: 400 }
      )
    }

    const readerStatus = extractReaderStatus(sumupStatusPayload)
    const transactionCode = extractTransactionCode(sumupStatusPayload)

    if (PAID_STATUSES.includes(readerStatus)) {
      await markOrderPaid({
        adminClient,
        order,
        transactionCode,
        readerId,
        rawStatus: readerStatus,
      })

      return NextResponse.json({
        success: true,
        final: true,
        paid: true,
        status: 'paid',
        message: '✅ Pago aprobado en SumUp SOLO',
        order_number: order.order_number,
        transaction_code: transactionCode,
        reader_status: readerStatus,
        sumup: sumupStatusPayload,
      })
    }

    if (FAILED_STATUSES.includes(readerStatus)) {
      await markOrderFailed({
        adminClient,
        order,
        readerId,
        rawStatus: readerStatus,
      })

      return NextResponse.json({
        success: true,
        final: true,
        paid: false,
        status: 'cancelled',
        message: '❌ Pago rechazado/cancelado en SumUp SOLO',
        order_number: order.order_number,
        reader_status: readerStatus,
        sumup: sumupStatusPayload,
      })
    }

    const waitingStatus =
      WAITING_STATUSES.includes(readerStatus) || readerStatus.length > 0
        ? readerStatus
        : 'WAITING'

    return NextResponse.json({
      success: true,
      final: false,
      paid: false,
      status: 'pending',
      message: '⏳ Esperando respuesta del cliente en SumUp SOLO',
      order_number: order.order_number,
      reader_status: waitingStatus,
      transaction_code: transactionCode,
      sumup: sumupStatusPayload,
    })
  } catch (error: any) {
    console.error('[SOLO Status] Error:', error)

    return NextResponse.json(
      {
        success: false,
        final: false,
        status: 'error',
        error: error?.message ?? 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}
