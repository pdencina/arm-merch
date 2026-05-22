import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PAID_STATUSES = [
  'PAID',
  'PAID_OUT',
  'SUCCESS',
  'SUCCESSFUL',
  'APPROVED',
  'COMPLETED',
  'COMPLETE',
  'FINISHED',
  'CHECKOUT_FINISHED',
  'ACCEPTED',
  'AUTHORISED',
  'AUTHORIZED',
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
    sumupApiBase: process.env.SUMUP_API_BASE || 'https://api.sumup.com',
    resendApiKey: process.env.RESEND_API_KEY,
    fromEmail:
      process.env.RESEND_FROM_EMAIL ||
      process.env.FROM_EMAIL ||
      'no-reply@armerch.com',
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

  const {
    supabaseUrl,
    supabaseAnonKey,
    serviceRoleKey,
  } = getEnv()

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
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
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

  return {
    adminClient,
    user,
  }
}

function extractReferenceFromNotes(notes?: string | null) {
  const text = String(notes ?? '')

  const refMatch =
    text.match(/Ref:\s*([^|]+)/i) ||
    text.match(/checkout_reference:\s*([^|]+)/i) ||
    text.match(/arm-merch-order-[^\s|]+/i)

  return String(refMatch?.[1] ?? refMatch?.[0] ?? '').trim()
}

function getTransactionArray(payload: any): any[] {
  if (!payload) return []

  if (Array.isArray(payload)) return payload

  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.checkouts)) return payload.checkouts
  if (Array.isArray(payload?.transactions)) return payload.transactions
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  if (Array.isArray(payload?.data?.checkouts)) return payload.data.checkouts
  if (Array.isArray(payload?.data?.transactions)) return payload.data.transactions

  if (
    payload?.id ||
    payload?.transaction_id ||
    payload?.transaction_code ||
    payload?.status
  ) {
    return [payload]
  }

  return []
}

function getTxStatus(tx: any) {
  return normalize(
    tx?.status ??
      tx?.transaction_status ??
      tx?.state ??
      tx?.payment_status ??
      tx?.checkout_status ??
      tx?.transactions?.[0]?.status ??
      tx?.transaction?.status,
  )
}

function getTxReference(tx: any) {
  return String(
    tx?.checkout_reference ??
      tx?.reference ??
      tx?.foreign_transaction_id ??
      tx?.client_transaction_id ??
      tx?.transaction_id ??
      tx?.id ??
      tx?.transaction_code ??
      tx?.transactions?.[0]?.transaction_code ??
      tx?.transactions?.[0]?.id ??
      tx?.transaction?.transaction_code ??
      tx?.transaction?.id ??
      tx?.description ??
      '',
  )
}

function getTxAmount(tx: any) {
  const value =
    tx?.amount ??
    tx?.total_amount?.value ??
    tx?.amount_money?.amount ??
    tx?.transaction_amount ??
    tx?.gross_amount ??
    tx?.transactions?.[0]?.amount ??
    tx?.transactions?.[0]?.total_amount?.value ??
    tx?.transaction?.amount ??
    tx?.transaction?.total_amount?.value

  const parsed = Number(value ?? 0)

  const minorUnit =
    Number(
      tx?.total_amount?.minor_unit ??
        tx?.amount_money?.minor_unit ??
        tx?.transactions?.[0]?.total_amount?.minor_unit ??
        tx?.transaction?.total_amount?.minor_unit ??
        0,
    )

  // Algunos endpoints devuelven CLP como 2000 y otros como 200000 con minor_unit 2.
  if (parsed > 1000 && minorUnit === 2) {
    return Math.round(parsed / 100)
  }

  return Math.round(parsed)
}

async function fetchRecentSumUpTransactions(
  apiBase: string,
  apiKey: string,
) {
  // SOLO Reader Checkout funciona correctamente usando SOLO history.
  // /checkouts NO sirve para SOLO.
  // /me/transactions devuelve 404 en esta cuenta.
  const url = `${apiBase}/v0.1/me/transactions/history?limit=50&order=descending`

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    const text = await res.text()

    let payload: any = {}

    try {
      payload = JSON.parse(text)
    } catch {
      payload = { raw: text }
    }

    console.log(
      '[SOLO Status] SumUp history URL:',
      url,
      'HTTP:',
      res.status,
    )

    console.log(
      '[SOLO Status] SumUp history payload:',
      JSON.stringify(payload),
    )

    if (!res.ok) {
      return []
    }

    return getTransactionArray(payload)
  } catch (error) {
    console.error('[SOLO Status] History fetch error:', error)
    return []
  }
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

        const quantity = Number(item.quantity ?? 0)
        const unitPrice = Number(item.unit_price ?? 0)
        const lineTotal = quantity * unitPrice

        return `
          <tr>
            <td style="padding:12px 8px;border-bottom:1px solid #e4e4e7;font-size:14px;color:#18181b;">
              ${productName}${sizeLabel}
            </td>
            <td style="padding:12px 8px;border-bottom:1px solid #e4e4e7;text-align:center;font-size:14px;color:#52525b;">
              ${quantity}
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
              <div style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#f59e0b;font-weight:700;">ARM Merch</div>
              <h1 style="margin:12px 0 0;font-size:26px;line-height:1.2;color:#ffffff;">Compra confirmada</h1>
              <p style="margin:8px 0 0;font-size:14px;color:#d4d4d8;">Orden #${esc(order.order_number)}</p>
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

              ${
                transactionCode
                  ? `<p style="margin:10px 0 0;font-size:12px;color:#71717a;">Transacción: ${esc(transactionCode)}</p>`
                  : ''
              }
            </td>
          </tr>

          <tr>
            <td style="background:#f9fafb;padding:22px 32px;text-align:center;border-top:1px solid #e4e4e7;">
              <p style="margin:0 0 6px;font-size:13px;color:#71717a;">¿Tienes alguna consulta? Contáctanos y menciona tu número de orden.</p>
              <p style="margin:0;font-size:12px;color:#a1a1aa;">ARM Merch · ARM Global · armerch.com</p>
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
  rawStatus,
}: {
  adminClient: any
  order: any
  transactionCode?: string | null
  rawStatus?: string | null
}) {
  if (order.status === 'paid') {
    return { emailSent: false, alreadyPaid: true }
  }

  const { error: updateError } = await adminClient
    .from('orders')
    .update({
      status: 'paid',
      notes: [
        order.notes ?? '',
        `SumUp SOLO pagado`,
        `TX: ${transactionCode ?? 'N/A'}`,
        `Estado: ${rawStatus ?? 'PAID'}`,
      ].filter(Boolean).join(' | '),
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)

  if (updateError) {
    throw new Error(updateError.message)
  }


  await adminClient.from('order_status_history').insert({
    order_id: order.id,
    status: 'payment_confirmed',
    title: 'Pago confirmado',
    message: 'El pago fue confirmado correctamente por SumUp SOLO.',
    created_at: new Date().toISOString(),
  }).then(() => null)

  // Stock: solo se descuenta aquí, después de pago aprobado.
  // Si el pago falla/cancela/expira, este bloque no se ejecuta.
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
  rawStatus,
}: {
  adminClient: any
  order: any
  rawStatus?: string | null
}) {
  if (order.status === 'paid' || order.status === 'cancelled') {
    return
  }

  const { error } = await adminClient
    .from('orders')
    .update({
      status: 'cancelled',
      notes: [
        order.notes ?? '',
        `SumUp SOLO rechazado/cancelado`,
        `Estado: ${rawStatus ?? 'FAILED'}`,
      ].filter(Boolean).join(' | '),
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

    const { adminClient } = auth
    const { sumupApiKey, sumupApiBase } = getEnv()

    if (!sumupApiKey) {
      return NextResponse.json(
        { success: false, error: 'Falta variable SUMUP_API_KEY' },
        { status: 500 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const orderId = String(body?.order_id ?? '').trim()

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
        notes,
        sumup_checkout_id,
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

    // 1) Fuente principal: la orden local.
    // Si webhook u otro endpoint ya la marcó pagada, el modal se cierra.
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

    const reference = extractReferenceFromNotes(order.notes)
    const expectedAmount = Math.round(Number(order.total ?? 0))

    // 2) Fallback SOLO: si SumUp no entrega checkout_id, buscamos en transacciones recientes.
    const transactions = await fetchRecentSumUpTransactions(sumupApiBase, sumupApiKey)

    const now = Date.now()

    const match = transactions.find((tx) => {
      const status = getTxStatus(tx)
      const txReference = getTxReference(tx)
      const txAmount = getTxAmount(tx)

      const txTimestamp = tx?.timestamp
        ? new Date(tx.timestamp).getTime()
        : tx?.date
          ? new Date(tx.date).getTime()
          : 0

      const secondsDiff = txTimestamp > 0 ? Math.abs(now - txTimestamp) / 1000 : Number.POSITIVE_INFINITY

      // Para evitar tomar transacciones históricas antiguas, solo aceptamos ventas recientes.
      // Subimos a 5 minutos por latencia de SumUp/Vercel.
      const recentEnough = secondsDiff <= 300

      const referenceMatches =
        Boolean(reference && txReference.includes(reference)) ||
        txReference.includes(String(order.order_number)) ||
        String(tx?.product_summary ?? '').includes(`Orden #${order.order_number}`) ||
        String(tx?.description ?? '').includes(String(order.order_number))

      const amountMatches =
        expectedAmount > 0 &&
        (txAmount === expectedAmount || Math.abs(txAmount - expectedAmount) <= 1)

      const statusIsFinal =
        PAID_STATUSES.includes(status) || FAILED_STATUSES.includes(status)

      return statusIsFinal && recentEnough && (referenceMatches || amountMatches)
    })

    if (match) {
      const status = getTxStatus(match)
      const transactionCode =
        match?.transaction_code ??
        match?.transaction_id ??
        match?.client_transaction_id ??
        match?.id ??
        null

      if (PAID_STATUSES.includes(status)) {
        const { emailSent } = await markOrderPaid({
          adminClient,
          order,
          transactionCode,
          rawStatus: status,
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
          sumup_status: status,
          email_sent: emailSent,
          matched_by: 'recent_transactions',
          sumup: match,
        })
      }

      if (FAILED_STATUSES.includes(status)) {
        await markOrderFailed({
          adminClient,
          order,
          rawStatus: status,
        })

        return NextResponse.json({
          success: true,
          final: true,
          paid: false,
          status: 'cancelled',
          order_status: 'cancelled',
          message: '❌ Pago rechazado/cancelado en SumUp SOLO',
          order_number: order.order_number,
          sumup_status: status,
          email_sent: false,
          matched_by: 'recent_transactions',
          sumup: match,
        })
      }
    }

    return NextResponse.json({
      success: true,
      final: false,
      paid: false,
      status: 'pending',
      order_status: 'pending',
      message: reference
        ? '⏳ Esperando confirmación del pago SumUp SOLO'
        : '⏳ Esperando confirmación del pago SumUp SOLO',
      order_number: order.order_number,
      sumup_status: 'PENDING',
      email_sent: false,
      reference,
      checked_transactions: transactions.length,
      expected_amount: expectedAmount,
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
