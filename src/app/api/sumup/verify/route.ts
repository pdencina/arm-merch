import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const apiKey       = process.env.SUMUP_API_KEY
    const merchantCode = process.env.SUMUP_MERCHANT_CODE ?? 'MGSXCYTL'

    if (!apiKey) {
      return NextResponse.json({ error: 'SUMUP_API_KEY no configurada' }, { status: 500 })
    }

    const { amount } = await req.json()
    if (!amount) {
      return NextResponse.json({ error: 'amount requerido' }, { status: 400 })
    }

    // Buscar transacciones de los últimos 15 minutos
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString()

    // Try v0.1 transactions endpoint (compatible with Smart POS)
    const res = await fetch(
      `https://api.sumup.com/v0.1/me/transactions/history` +
      `?limit=10&oldest_time=${encodeURIComponent(since)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!res.ok) {
      // Fallback to v2.1 merchant endpoint
      const res2 = await fetch(
        `https://api.sumup.com/v2.1/merchants/${merchantCode}/transactions/history` +
        `?limit=10&oldest_time=${encodeURIComponent(since)}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )
      
      if (!res2.ok) {
        const err = await res2.json().catch(() => ({}))
        console.error('[SumUp Verify] Both endpoints failed:', err)
        return NextResponse.json(
          { error: 'Error consultando SumUp', details: err, endpoint_tried: 'v2.1' },
          { status: 400 }
        )
      }
      
      const data2 = await res2.json()
      return processTransactions(data2, amount)
    }

    const data = await res.json()
    return processTransactions(data, amount)

  } catch (error: any) {
    console.error('[SumUp Verify] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function processTransactions(data: any, amount: number) {
  const allTx: any[] = data.items ?? data.transactions ?? []
  
  console.log('[SumUp Verify] Total transactions found:', allTx.length)
  console.log('[SumUp Verify] Statuses:', allTx.map(t => `${t.status}:${t.amount}`).join(', '))

  // Accept any successful status variant
  const successStatuses = ['SUCCESSFUL', 'successful', 'PAID', 'paid', 'APPROVED', 'approved', 'COMPLETED', 'completed']
  const transactions = allTx.filter(tx => successStatuses.includes(tx.status))

  if (transactions.length === 0) {
    // Return all transactions for debugging
    return NextResponse.json({
      found: false,
      message: `No hay transacciones exitosas recientes. Total encontradas: ${allTx.length}`,
      debug_all_statuses: allTx.map(t => ({ status: t.status, amount: t.amount, timestamp: t.timestamp })),
    })
  }

  const targetAmount = Number(amount)
  // Match within ±100 CLP tolerance (in case of rounding)
  const match = transactions.find(tx => Math.abs(Number(tx.amount) - targetAmount) <= 100)

  if (!match) {
    const found = transactions.map(tx => `$${tx.amount}`).join(', ')
    return NextResponse.json({
      found: false,
      message: `No hay transacción de $${targetAmount.toLocaleString('es-CL')} en los últimos 15 minutos. Encontradas: ${found}`,
      debug_transactions: transactions.map(t => ({ status: t.status, amount: t.amount })),
    })
  }

  return NextResponse.json({
    found: true,
    transaction: {
      id:           match.id,
      tx_code:      match.transaction_code,
      amount:       match.amount,
      currency:     match.currency,
      status:       match.status,
      card_type:    match.card_type,
      timestamp:    match.timestamp,
      payment_type: match.payment_type,
    },
  })
}
