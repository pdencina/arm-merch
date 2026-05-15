import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    sumupApiKey: process.env.SUMUP_API_KEY,
    merchantCode: process.env.SUMUP_MERCHANT_CODE,
    sumupApiBase: process.env.SUMUP_API_BASE || 'https://api.sumup.com',
  }
}

function jsonError(message: string, status = 400, detail?: any) {
  return NextResponse.json({ success: false, error: message, detail }, { status })
}

async function getAdminClient(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return { errorResponse: jsonError('No autenticado', 401) }
  }

  const token = authHeader.replace('Bearer ', '').trim()
  const { supabaseUrl, supabaseAnonKey, serviceRoleKey } = getEnv()

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return { errorResponse: jsonError('Faltan variables Supabase', 500) }
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

  return { adminClient, user }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAdminClient(req)
    if (ctx.errorResponse) return ctx.errorResponse

    const { adminClient } = ctx
    const { sumupApiKey, merchantCode, sumupApiBase } = getEnv()

    const body = await req.json().catch(() => ({}))
    const orderId = String(body?.order_id ?? '').trim()

    if (!orderId) return jsonError('order_id es obligatorio')

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, order_number, campus_id, status, total, sumup_checkout_id, notes')
      .eq('id', orderId)
      .maybeSingle()

    if (orderError) return jsonError('Error consultando orden', 500, orderError)
    if (!order) return jsonError('Orden no encontrada', 404)

    let readerStatus: any = null

    if (sumupApiKey && merchantCode && order.campus_id) {
      const { data: reader } = await adminClient
        .from('sumup_readers')
        .select('reader_id, name')
        .eq('campus_id', order.campus_id)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (reader?.reader_id) {
        const statusRes = await fetch(
          `${sumupApiBase}/v0.1/merchants/${encodeURIComponent(merchantCode)}/readers/${encodeURIComponent(reader.reader_id)}/status`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${sumupApiKey}`,
              'Content-Type': 'application/json',
            },
            cache: 'no-store',
          },
        )

        const text = await statusRes.text()
        try {
          readerStatus = JSON.parse(text)
        } catch {
          readerStatus = { raw: text }
        }
      }
    }

    return NextResponse.json({
      success: true,
      order_id: order.id,
      order_number: order.order_number,
      order_status: order.status,
      sumup_checkout_id: order.sumup_checkout_id,
      reader_status: readerStatus,
    })
  } catch (error: any) {
    console.error('[SOLO Status] Error:', error)
    return jsonError(error?.message ?? 'Error consultando estado SOLO', 500)
  }
}
