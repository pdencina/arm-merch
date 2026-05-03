import { NextRequest, NextResponse } from 'next/server'

// ─── POST /api/sumup/verify ───────────────────────────────────────────────────
// Busca una transacción específica de SumUp por código de transacción.
// El vendedor ingresa el código que aparece en el Smart POS (ej: TAAA2UTDS4R).
// ─────────────────────────────────────────────────────────────────────────────

const log = (...args: any[]) => process.env.NODE_ENV !== 'production' && console.log(...args)


export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.SUMUP_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'SUMUP_API_KEY no configurada' }, { status: 500 })
    }

    const { tx_code, amount } = await req.json()

    if (!tx_code?.trim()) {
      return NextResponse.json({ error: 'Código de transacción requerido' }, { status: 400 })
    }

    const code = tx_code.trim().toUpperCase()

    // Buscar la transacción exacta por código
    const res = await fetch(
      `https://api.sumup.com/v0.1/me/transactions?transaction_code=${code}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[SumUp Verify] API error:', err)
      return NextResponse.json(
        { error: 'Error consultando SumUp', details: err },
        { status: 400 }
      )
    }

    const tx = await res.json()
    log('[SumUp Verify] Transaction found:', tx?.status, tx?.amount, tx?.transaction_code)

    if (!tx || !tx.transaction_code) {
      return NextResponse.json({
        found: false,
        message: `No se encontró la transacción con código ${code}`,
      })
    }

    const successStatuses = ['SUCCESSFUL', 'PAID', 'APPROVED']
    if (!successStatuses.includes(tx.status?.toUpperCase())) {
      return NextResponse.json({
        found: false,
        message: `La transacción ${code} tiene estado: ${tx.status} — no está aprobada`,
      })
    }

    // Validar que el monto coincida (si se envía)
    if (amount && Math.abs(Number(tx.amount) - Number(amount)) > 1) {
      return NextResponse.json({
        found: false,
        message: `El monto de la transacción ($${tx.amount}) no coincide con el carrito ($${amount})`,
        tx_amount: tx.amount,
        cart_amount: amount,
      })
    }

    return NextResponse.json({
      found: true,
      transaction: {
        id:           tx.id,
        tx_code:      tx.transaction_code,
        amount:       tx.amount,
        currency:     tx.currency,
        status:       tx.status,
        card_type:    tx.card_type,
        timestamp:    tx.timestamp,
        payment_type: tx.payment_type,
      },
    })

  } catch (error: any) {
    console.error('[SumUp Verify] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
