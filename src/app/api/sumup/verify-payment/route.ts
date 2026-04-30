import { NextRequest, NextResponse } from 'next/server'

type SumUpTransaction = {
  id?: string
  transaction_code?: string
  amount?: number
  currency?: string
  status?: string
  timestamp?: string
  local_time?: string
  card_type?: string
  payment_type?: string
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { found: false, message: 'No autenticado' },
        { status: 401 }
      )
    }

    const apiKey = process.env.SUMUP_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { found: false, message: 'SUMUP_API_KEY no configurada' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const amount = Number(body.amount)

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { found: false, message: 'Monto inválido' },
        { status: 400 }
      )
    }

    const now = new Date()
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000)

    const url = new URL('https://api.sumup.com/v0.1/me/transactions/history')
    url.searchParams.set('limit', '20')
    url.searchParams.set('order', 'descending')

    const sumupRes = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    const rawText = await sumupRes.text()

    let sumupData: any = {}

    try {
      sumupData = JSON.parse(rawText)
    } catch {
      console.error('[SumUp Verify] ❌ No es JSON válido:', rawText)
      sumupData = { raw: rawText }
    }

    console.log('[SumUp Verify] 🔎 Status:', sumupRes.status)
    console.log('[SumUp Verify] 🔎 Data:', sumupData)

    if (!sumupRes.ok) {
      return NextResponse.json(
        {
          found: false,
          message: 'Error consultando SumUp',
          sumup_error: sumupData,
        },
        { status: sumupRes.status }
      )
    }

    // 🧠 Soporte para distintas estructuras de respuesta
    const transactions: SumUpTransaction[] =
      Array.isArray(sumupData.items)
        ? sumupData.items
        : Array.isArray(sumupData.transactions)
          ? sumupData.transactions
          : Array.isArray(sumupData.data)
            ? sumupData.data
            : Array.isArray(sumupData)
              ? sumupData
              : []

    console.log('[SumUp Verify] 📦 Transactions encontradas:', transactions.length)

    const successfulStatuses = [
      'SUCCESSFUL',
      'PAID',
      'SUCCESS',
      'COMPLETED'
    ]

    const matchingTransaction = transactions.find((tx) => {
      const txAmount = Number(tx.amount ?? 0)
      const txStatus = String(tx.status ?? '').toUpperCase()

      const txDateRaw = tx.timestamp ?? tx.local_time
      const txDate = txDateRaw ? new Date(txDateRaw) : null

      const sameAmount = Math.abs(txAmount - amount) < 1
      const isSuccessful = successfulStatuses.includes(txStatus)
      const isRecent = txDate ? txDate >= tenMinutesAgo && txDate <= now : true

      console.log('[SumUp Verify] 🔍 TX:', {
        txAmount,
        txStatus,
        txDate,
        sameAmount,
        isSuccessful,
        isRecent,
      })

      return sameAmount && isSuccessful && isRecent
    })

    if (!matchingTransaction) {
      const available = transactions.slice(0, 8).map((tx) => ({
        amount: tx.amount,
        status: tx.status,
        date: tx.timestamp ?? tx.local_time,
        tx_code: tx.transaction_code ?? tx.id,
      }))

      return NextResponse.json({
        found: false,
        message: `No se encontró una transacción aprobada por $${amount.toLocaleString('es-CL')} en los últimos 10 minutos.`,
        available_amounts: available,
      })
    }

    return NextResponse.json({
      found: true,
      transaction: {
        id: matchingTransaction.id,
        tx_code: matchingTransaction.transaction_code ?? matchingTransaction.id,
        amount: matchingTransaction.amount,
        status: matchingTransaction.status,
        card_type:
          matchingTransaction.card_type ??
          matchingTransaction.payment_type ??
          'Tarjeta',
        date: matchingTransaction.timestamp ?? matchingTransaction.local_time,
      },
    })

  } catch (error: any) {
    console.error('[SumUp Verify] ❌ Error:', error)

    return NextResponse.json(
      {
        found: false,
        message: error?.message ?? 'Error interno verificando pago',
      },
      { status: 500 }
    )
  }
}