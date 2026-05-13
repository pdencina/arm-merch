import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    const apiKey = process.env.SUMUP_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'SUMUP_API_KEY no configurada' },
        { status: 500 }
      )
    }

    const body = await req.json()

    const {
      order_id,
      tx_code,
      amount,
    } = body

    if (!order_id || !tx_code) {
      return NextResponse.json(
        { error: 'order_id y tx_code requeridos' },
        { status: 400 }
      )
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Buscar orden
    const { data: order } = await adminClient
      .from('orders')
      .select(`
        id,
        order_number,
        campus_id,
        status,
        total,
        order_items (
          product_id,
          quantity
        )
      `)
      .eq('id', order_id)
      .single()

    if (!order) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      )
    }

    // Ya pagada
    if (order.status === 'paid') {
      return NextResponse.json({
        success: true,
        already_paid: true,
      })
    }

    // Buscar transacción exacta
    const res = await fetch(
      `https://api.sumup.com/v0.1/me/transactions?transaction_code=${tx_code}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const tx = await res.json()

    console.log('[SMART POS VERIFY]', tx)

    if (!tx?.transaction_code) {
      return NextResponse.json({
        success: false,
        message: 'Transacción no encontrada',
      })
    }

    const status = String(tx.status ?? '').toUpperCase()

    const approvedStatuses = [
      'SUCCESSFUL',
      'PAID',
      'APPROVED',
    ]

    if (!approvedStatuses.includes(status)) {
      return NextResponse.json({
        success: false,
        message: `Transacción rechazada (${status})`,
      })
    }

    // Validar monto
    const txAmount = Number(tx.amount ?? 0)
    const orderAmount = Number(amount ?? order.total ?? 0)

    if (Math.abs(txAmount - orderAmount) > 1) {
      return NextResponse.json({
        success: false,
        message: 'Monto no coincide',
      })
    }

    // Marcar orden pagada
    await adminClient
      .from('orders')
      .update({
        status: 'paid',
        notes: `Smart POS | TX ${tx.transaction_code}`,
      })
      .eq('id', order.id)

    // Descontar stock
    for (const item of order.order_items ?? []) {
      await adminClient
        .from('inventory_movements')
        .insert({
          product_id: item.product_id,
          campus_id: order.campus_id,
          type: 'salida',
          quantity: item.quantity,
          notes: `Smart POS - Orden #${order.order_number}`,
        })
    }

    console.log(
      '[SMART POS] Pago confirmado:',
      order.order_number
    )

    return NextResponse.json({
      success: true,
      order_number: order.order_number,
      tx_code: tx.transaction_code,
    })

  } catch (error: any) {
    console.error('[SMART POS VERIFY ERROR]', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}