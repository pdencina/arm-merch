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

function fmtCLP(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0))
}

function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    sumupApiKey: process.env.SUMUP_API_KEY,
    sumupMerchantCode: process.env.SUMUP_MERCHANT_CODE,
    sumupApiBase: process.env.SUMUP_API_BASE || 'https://api.sumup.com',
    resendApiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL || process.env.FROM_EMAIL || 'no-reply@armerch.com',
  }
}

async function getAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 },
      ),
    }
  }

  const token = authHeader.replace('Bearer ', '').trim()
  const { supabaseUrl, supabaseAnonKey, serviceRoleKey } = getEnv()

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: 'Faltan variables de entorno de Supabase' },
        { status: 500 },
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
      errorResponse: NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 },
      ),
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
        { status: 403 },
      ),
    }
  }

  return { adminClient, user, profile }
}

function extractReaderStatus(payload: any) {
  return normalize(
    payload?.status ??
      payload?.state ??
      payload?.data?.status ??
      payload?.data?.state ??
      payload?.reader_status ??
      payload?.reader_status?.status ??
      payload?.reader_status?.state ??
      payload?.reader_status?.data?.status ??
      payload?.reader_status?.data?.state ??
      payload?.device_status ??
      payload?.device_status?.status ??
      payload?.device_status?.state ??
      payload?.checkout_status ??
      payload?.checkout?.status ??
      payload?.data?.checkout?.status ??
      payload?.transaction_status ??
      payload?.transaction?.status ??
      payload?.data?.transaction?.status ??
      payload?.last_transaction?.status ??
      payload?.data?.last_transaction?.status ??
      payload?.transactions?.[0]?.status ??
      payload?.data?.transactions?.[0]?.status
  )
}

function extractTransactionCode(payload: any) {
  return (
    payload?.transaction_code ??
    payload?.transaction?.transaction_code ??
    payload?.data?.transaction?.transaction_code ??
    payload?.last_transaction?.transaction_code ??
    payload?.data?.last_transaction?.transaction_code ??
    payload?.transactions?.[0]?.transaction_code ??
    payload?.data?.transactions?.[0]?.transaction_code ??
    payload?.transaction?.id ??
    payload?.data?.transaction?.id ??
    payload?.last_transaction?.id ??
    payload?.data?.last_transaction?.id ??
    payload?.transactions?.[0]?.id ??
    payload?.data?.transactions?.[0]?.id ??
    null
  )
}

async function sendVoucherEmail({
  adminClient,
  order,
  transactionCode,
}: {
  adminClient: any
  order: any
  transactionCode?: string | null
}) {
  const { resendApiKey, fromEmail } = getEnv()

  if (!resendApiKey) {
    console.warn('[SOLO Status] RESEND_API_KEY no configurada')
    return false
  }

  try {
    const { data: contact } = await adminClient
      .from('order_contacts')
      .select('client_name, client_email')
      .eq('order_id', order.id)
      .maybeSingle()

    if (!contact?.client_email || !String(contact.client_email).includes('@')) {
      console.warn('[SOLO Status] Orden sin email de cliente')
      return false
    }

    const { data: itemsData } = await adminClient
      .from('order_items')
      .select('quantity, unit_price, size, products(name)')
      .eq('order_id', order.id)

    const rows = (itemsData ?? [])
      .map((item: any) => {
        const productName = esc(item.products?.name ?? 'Producto')
        const sizeLabel = item.size
          ? `<br/><span style="font-size:11px;color:#71717a;">Talla: ${esc(item.size)}</span>`
          : ''
        const lineTotal = Number(item.unit_price ?? 0) * Number(item.quantity ?? 0)

        return `
          <tr>
            <td style="padding:12px 8px;border-bottom:1px solid #e4e4e7;font-size:14px;color:#18181b;">
              ${productName}${sizeLabel}
            </td>
            <td style="padding:12px 8px;border-bottom:1px solid #e4e4e7;text-align:center;font-size:14px;color:#52525b;">
              ${Number(item.quantity ?? 0)}
            </td>
            <td style="padding:12px 8px;border-bottom:1px solid #e4e4e7;text-align:right;font-size:14px;font-weight:700;color:#18181b;">
              ${fmtCLP(lineTotal)}
            </td>
          </tr>
        `
      })
      .join('')

    const html = `
<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="background:#111827;padding:28px 32px;text-align:center;">
              <div style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#f59e0b;font-weight:700;">
                ARM Merch
              </div>
              <h1 style="margin:12px 0 0;font-size:26px;line-height:1.2;color:#ffffff;">
                Compra confirmada
              </h1>
              <p style="margin:8px 0 0;font-size:14px;color:#d4d4d8;">
                Orden #${esc(order.order_number)}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;">
                Hola <strong>${esc(contact.client_name || 'Cliente')}</strong>, gracias por tu compra. Tu pago fue confirmado correctamente mediante SumUp SOLO.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:16px;">
                <thead>
                  <tr>
                    <th style="padding:10px 8px;text-align:left;font-size:12px;color:#71717a;font-weight:700;border-bottom:2px solid #e4e4e7;">PRODUCTO</th>
                    <th style="padding:10px 8px;text-align:center;font-size:12px;color:#71717a;font-weight:700;border-bottom:2px solid #e4e4e7;">CANT.</th>
                    <th style="padding:10px 8px;text-align:right;font-size:12px;color:#71717a;font-weight:700;border-bottom:2px solid #e4e4e7;">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows || '<tr><td colspan="3" style="padding:12px;color:#71717a;">Sin detalle de productos</td></tr>'}
                </tbody>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                <tr>
                  <td style="padding:12px 0;font-size:17px;font-weight:700;color:#18181b;">Total pagado</td>
                  <td style="padding:12px 0;font-size:22px;font-weight:800;color:#18181b;text-align:right;">${fmtCLP(Number(order.total ?? 0))}</td>
                </tr>
              </table>

              ${transactionCode ? `
              <p style="margin:10px 0 0;font-size:12px;color:#71717a;">
                Transacción: ${esc(transactionCode)}
              </p>
              ` : ''}
            </td>
          </tr>

          <tr>
            <td style="background:#f9fafb;padding:22px 32px;text-align:center;border-top:1px solid #e4e4e7;">
              <p style="margin:0 0 6px;font-size:13px;color:#71717a;">
                ¿Tienes alguna consulta? Contáctanos y menciona tu número de orden.
              </p>
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                ARM Merch · ARM Global · armerch.com
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

    const { Resend } = await import('resend')
    const resend = new Resend(resendApiKey)

    const { error: mailError } = await resend.emails.send({
      from: `ARM Merch <${fromEmail}>`,
      to: contact.client_email,
      subject: `Comprobante Orden #${order.order_number}`,
      html,
    })

    if (mailError) {
      console.error('[SOLO Status] Voucher email error:', mailError)
      return false
    }

    console.log('[SOLO Status] Voucher enviado')
    return true
  } catch (error) {
    console.error('[SOLO Status] Error enviando voucher:', error)
    return false
  }
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
    return { emailSent: false, alreadyPaid: true }
  }

  const { error: updateError } = await adminClient
    .from('orders')
    .update({
      status: 'paid',
      notes: `SumUp SOLO pagado | Reader: ${readerId ?? 'N/A'} | TX: ${
        transactionCode ?? 'N/A'
      } | Estado: ${rawStatus ?? 'PAID'}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)

  if (updateError) {
    throw new Error(updateError.message)
  }

  // Stock: solo se descuenta aquí, después del pago aprobado.
  // Si el pago falla/cancela/expira, este bloque no se ejecuta.
  for (const item of order.order_items ?? []) {
    const { error: movementError } = await adminClient
      .from('inventory_movements')
      .insert({
        product_id: item.product_id,
        campus_id: order.campus_id,
        type: 'salida',
        quantity: item.quantity,
        notes: `SumUp SOLO - Orden #${order.order_number} - TX ${
          transactionCode ?? 'N/A'
        }`,
      })

    if (movementError) {
      console.error('[SOLO Status] Inventory movement error:', movementError)
    }
  }

  const emailSent = await sendVoucherEmail({
    adminClient,
    order,
    transactionCode,
  })

  return { emailSent, alreadyPaid: false }
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

  // Importante: en pagos rechazados/cancelados NO se descuenta inventario.
  const { error } = await adminClient
    .from('orders')
    .update({
      status: 'cancelled',
      notes: `SumUp SOLO rechazado/cancelado | Reader: ${
        readerId ?? 'N/A'
      } | Estado: ${rawStatus ?? 'FAILED'}`,
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
        {
          success: false,
          error: 'Faltan variables SUMUP_API_KEY o SUMUP_MERCHANT_CODE',
        },
        { status: 500 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const orderId = String(body?.order_id ?? '').trim()
    const readerIdFromBody = body?.reader_id ? String(body.reader_id) : null

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'order_id es obligatorio' },
        { status: 400 },
      )
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
        { status: 404 },
      )
    }

    if (order.status === 'paid') {
      return NextResponse.json({
        success: true,
        final: true,
        paid: true,
        status: 'paid',
        order_status: 'paid',
        message: 'Pago confirmado',
        order_number: order.order_number,
        email_sent: false,
      })
    }

    if (order.status === 'cancelled') {
      return NextResponse.json({
        success: true,
        final: true,
        paid: false,
        status: 'cancelled',
        order_status: 'cancelled',
        message: 'Pago cancelado o rechazado',
        order_number: order.order_number,
        email_sent: false,
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
        return NextResponse.json(
          { success: false, error: readerError.message },
          { status: 400 },
        )
      }

      readerId = reader?.reader_id ?? null
    }

    if (!readerId) {
      return NextResponse.json(
        {
          success: false,
          error: 'No hay lector SumUp SOLO activo para esta orden',
        },
        { status: 404 },
      )
    }

    const statusUrl = `${sumupApiBase}/v0.1/merchants/${encodeURIComponent(
      sumupMerchantCode,
    )}/readers/${encodeURIComponent(readerId)}/status`

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
          order_status: 'error',
          message: 'No se pudo consultar el estado del SOLO',
          detail: sumupStatusPayload,
        },
        { status: 400 },
      )
    }

    const readerStatus = extractReaderStatus(sumupStatusPayload)
    const transactionCode = extractTransactionCode(sumupStatusPayload)

    if (PAID_STATUSES.includes(readerStatus)) {
      const { emailSent } = await markOrderPaid({
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
        order_status: 'paid',
        message: '✅ Pago aprobado en SumUp SOLO',
        order_number: order.order_number,
        transaction_code: transactionCode,
        reader_status: readerStatus,
        email_sent: emailSent,
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
        order_status: 'cancelled',
        message: '❌ Pago rechazado/cancelado en SumUp SOLO',
        order_number: order.order_number,
        reader_status: readerStatus,
        email_sent: false,
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
      order_status: 'pending',
      message: '⏳ Esperando respuesta del cliente en SumUp SOLO',
      order_number: order.order_number,
      reader_status: waitingStatus,
      transaction_code: transactionCode,
      email_sent: false,
      sumup: sumupStatusPayload,
    })
  } catch (error: any) {
    console.error('[SOLO Status] Error:', error)

    return NextResponse.json(
      {
        success: false,
        final: false,
        status: 'error',
        order_status: 'error',
        error: error?.message ?? 'Error interno del servidor',
      },
      { status: 500 },
    )
  }
}
