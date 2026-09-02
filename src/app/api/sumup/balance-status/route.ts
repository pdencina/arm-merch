import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Verifica contra SumUp si el COBRO DE SALDO de una orden fue realmente pagado.
 *
 * Motivo: antes el saldo se marcaba como cobrado en el momento de enviar la
 * instrucción al lector, sin esperar que el cliente pasara la tarjeta. Si la
 * tarjeta se rechazaba, el saldo quedaba registrado como pagado igual.
 *
 * Este endpoint solo aplica el cobro cuando SumUp confirma la transacción.
 */

const PAID_STATUSES = [
  'PAID', 'PAID_OUT', 'SUCCESS', 'SUCCESSFUL', 'APPROVED',
  'COMPLETED', 'COMPLETE', 'FINISHED', 'CHECKOUT_FINISHED',
  'ACCEPTED', 'AUTHORISED', 'AUTHORIZED',
]

const FAILED_STATUSES = [
  'FAILED', 'FAIL', 'CANCELLED', 'CANCELED', 'DECLINED',
  'REJECTED', 'EXPIRED', 'TIMEOUT', 'TIMED_OUT', 'ERROR',
]

function normalize(value: unknown) {
  return String(value ?? '').trim().toUpperCase()
}

function getTxStatus(tx: any) {
  return normalize(
    tx?.status ?? tx?.transaction_status ?? tx?.state ?? tx?.payment_status ??
    tx?.checkout_status ?? tx?.transactions?.[0]?.status ?? tx?.transaction?.status,
  )
}

function getTxAmount(tx: any) {
  const value =
    tx?.amount ?? tx?.total_amount?.value ?? tx?.amount_money?.amount ??
    tx?.transaction_amount ?? tx?.gross_amount ??
    tx?.transactions?.[0]?.amount ?? tx?.transaction?.amount

  const parsed = Number(value ?? 0)

  const minorUnit = Number(
    tx?.total_amount?.minor_unit ??
    tx?.amount_money?.minor_unit ??
    tx?.transactions?.[0]?.total_amount?.minor_unit ?? 0,
  )

  if (parsed > 1000 && minorUnit === 2) return Math.round(parsed / 100)
  return Math.round(parsed)
}

function getTxCode(tx: any) {
  return String(
    tx?.transaction_code ?? tx?.transaction_id ??
    tx?.client_transaction_id ?? tx?.id ?? '',
  ).trim()
}

function getTransactionArray(payload: any): any[] {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.transactions)) return payload.transactions
  if (Array.isArray(payload?.data)) return payload.data
  if (payload?.id || payload?.transaction_id || payload?.status) return [payload]
  return []
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '').trim()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const sumupApiKey = process.env.SUMUP_API_KEY
    const sumupApiBase = process.env.SUMUP_API_BASE || 'https://api.sumup.com'

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !sumupApiKey) {
      return NextResponse.json({ error: 'Faltan variables de entorno' }, { status: 500 })
    }

    const authClient = createClient(supabaseUrl, anonKey)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: { user }, error: userError } = await authClient.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, role, campus_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const orderId = String(body?.order_id ?? '').trim()

    if (!orderId) {
      return NextResponse.json({ error: 'order_id es obligatorio' }, { status: 400 })
    }

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, order_number, total, amount_paid, balance_due, payment_status, notes, campus_id, pickup_campus_id')
      .eq('id', orderId)
      .maybeSingle()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    const pickupCampusId = order.pickup_campus_id || order.campus_id

    const canCollect =
      profile.role === 'super_admin' ||
      profile.role === 'adm_merch' ||
      profile.role === 'admin' ||
      profile.campus_id === pickupCampusId

    if (!canCollect) {
      return NextResponse.json(
        { error: 'No autorizado para cobrar el saldo de esta orden' },
        { status: 403 },
      )
    }

    const balanceDue = Math.round(Number(order.balance_due ?? 0))

    // Si ya no hay saldo, el cobro ya fue aplicado (posible doble polling).
    if (balanceDue <= 0) {
      return NextResponse.json({
        success: true,
        final: true,
        paid: true,
        message: 'El saldo ya fue cobrado',
        order_number: order.order_number,
      })
    }

    // Historial reciente de SumUp
    const historyUrl = `${sumupApiBase}/v0.1/me/transactions/history?limit=50&order=descending`

    const historyRes = await fetch(historyUrl, {
      headers: {
        Authorization: `Bearer ${sumupApiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    let transactions: any[] = []

    if (historyRes.ok) {
      const payload = await historyRes.json().catch(() => ({}))
      transactions = getTransactionArray(payload)
    }

    const now = Date.now()
    const existingNotes = String(order.notes ?? '')

    // Candidatos: transacción final, reciente y por el monto EXACTO del saldo.
    // El monto se compara solo contra balance_due: usar el total o el abono
    // podría matchear la transacción original del abono.
    const candidates = transactions.filter((tx) => {
      const status = getTxStatus(tx)

      const statusIsFinal =
        PAID_STATUSES.includes(status) || FAILED_STATUSES.includes(status)

      if (!statusIsFinal) return false

      const txTimestamp = tx?.timestamp
        ? new Date(tx.timestamp).getTime()
        : tx?.date
          ? new Date(tx.date).getTime()
          : 0

      const secondsDiff =
        txTimestamp > 0 ? Math.abs(now - txTimestamp) / 1000 : Number.POSITIVE_INFINITY

      // Solo cobros recientes (15 min) para no tomar transacciones antiguas.
      if (secondsDiff > 900) return false

      return Math.abs(getTxAmount(tx) - balanceDue) <= 1
    })

    // Descartar transacciones ya registradas en esta orden (ej: el abono inicial,
    // que en un 50/50 tiene el mismo monto que el saldo).
    const unusedCandidates = candidates.filter((tx) => {
      const txCode = getTxCode(tx)
      if (!txCode) return false
      return !existingNotes.includes(`TX: ${txCode}`)
    })

    let match: any = null

    for (const tx of unusedCandidates) {
      const txCode = getTxCode(tx)

      // Tampoco puede estar asociada a otra orden.
      const { data: alreadyUsed } = await adminClient
        .from('orders')
        .select('id')
        .ilike('notes', `%TX: ${txCode}%`)
        .neq('id', order.id)
        .limit(1)

      if (!alreadyUsed || alreadyUsed.length === 0) {
        match = tx
        break
      }
    }

    if (!match) {
      return NextResponse.json({
        success: true,
        final: false,
        paid: false,
        message: 'Esperando confirmación del pago en el lector',
        order_number: order.order_number,
        balance_due: balanceDue,
      })
    }

    const status = getTxStatus(match)
    const transactionCode = getTxCode(match) || null

    if (FAILED_STATUSES.includes(status)) {
      return NextResponse.json({
        success: true,
        final: true,
        paid: false,
        rejected: true,
        message: 'El pago fue rechazado o cancelado. El saldo NO se cobró.',
        order_number: order.order_number,
        sumup_status: status,
      })
    }

    // Pago confirmado → aplicar el cobro del saldo
    const newAmountPaid = Math.round(Number(order.total ?? 0))

    const { error: updateError } = await adminClient
      .from('orders')
      .update({
        amount_paid: newAmountPaid,
        balance_due: 0,
        payment_status: 'paid',
        payment_type: 'full_payment',
        notes: [existingNotes, `Saldo cobrado SumUp SOLO`, `TX: ${transactionCode ?? 'N/A'}`]
          .filter(Boolean)
          .join(' | '),
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    await adminClient.from('order_status_history').insert({
      order_id: order.id,
      status: 'balance_paid',
      title: 'Saldo pagado',
      message: `Saldo pagado con SumUp Solo y confirmado por la transacción ${transactionCode ?? 'N/A'}.`,
      created_by: profile.id,
    })

    await adminClient.from('order_payments').insert({
      order_id: order.id,
      amount: balanceDue,
      payment_method: 'solo',
      payment_type: 'balance',
      notes: `Cobro saldo confirmado en SumUp — TX: ${transactionCode ?? 'N/A'}`,
      created_by: profile.id,
    })

    return NextResponse.json({
      success: true,
      final: true,
      paid: true,
      message: 'Pago del saldo confirmado',
      order_number: order.order_number,
      amount_collected: balanceDue,
      transaction_code: transactionCode,
      sumup_status: status,
    })
  } catch (error: any) {
    console.error('[Balance Status] Error:', error)

    return NextResponse.json(
      { error: error?.message ?? 'Error interno del servidor' },
      { status: 500 },
    )
  }
}
