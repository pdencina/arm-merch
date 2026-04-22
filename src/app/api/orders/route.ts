import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// ─── POST /api/orders ────────────────────────────────────────────────────────
// Crea una nueva orden con soporte para:
//   • Descuentos por ítem (discount_pct)
//   • Descuento global (discount)
//   • Código de promoción (promo_code)
//   • Notas de venta
// ────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()

  // Autenticación
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  // Parsear body
  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const {
    campus_id,
    items,
    client_name,
    client_email,
    payment_method,
    discount = 0,
    promo_code,
    notes,
  } = body

  if (!items?.length || !client_name || !payment_method) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 422 })
  }

  // Calcular totales con descuentos por ítem
  const subtotal: number = items.reduce(
    (sum: number, i: { unit_price: number; quantity: number; discount_pct?: number }) =>
      sum + i.unit_price * i.quantity * (1 - (i.discount_pct ?? 0) / 100),
    0
  )
  const total = Math.max(0, subtotal - discount)

  try {
    // ── 1. Insertar la orden ──
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        campus_id,
        seller_id: user.id,
        client_name,
        client_email: client_email || null,
        payment_method,
        subtotal: Math.round(subtotal),
        discount: Math.round(discount),
        total: Math.round(total),
        promo_code: promo_code || null,
        notes: notes || null,
        status: 'completed',
      })
      .select()
      .single()

    if (orderError) throw orderError

    // ── 2. Insertar ítems de la orden ──
    const orderItems = items.map(
      (i: {
        product_id: string
        quantity: number
        unit_price: number
        discount_pct?: number
      }) => ({
        order_id: order.id,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount_pct: i.discount_pct ?? 0,
        line_total: Math.round(
          i.unit_price * i.quantity * (1 - (i.discount_pct ?? 0) / 100)
        ),
      })
    )

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (itemsError) throw itemsError

    // ── 3. Descontar stock ──
    for (const item of items) {
      const { error: stockError } = await supabase.rpc('decrement_stock', {
        p_product_id: item.product_id,
        p_campus_id: campus_id,
        p_quantity: item.quantity,
      })
      if (stockError) console.error('[stock]', stockError.message)
    }

    // ── 4. Enviar voucher por email (si hay email) ──
    let email_sent = false
    if (client_email) {
      try {
        const origin = req.headers.get('origin') ?? ''
        const emailRes = await fetch(`${origin}/api/orders/send-receipt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: order.id }),
        })
        email_sent = emailRes.ok
      } catch {
        email_sent = false
      }
    }

    return NextResponse.json({
      ...order,
      email_sent,
    })
  } catch (err: any) {
    console.error('[orders POST]', err)
    return NextResponse.json(
      { error: err?.message ?? 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ─── GET /api/orders ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { searchParams } = new URL(req.url)
  const page = Number(searchParams.get('page') ?? 1)
  const limit = Number(searchParams.get('limit') ?? 20)
  const campus_id = searchParams.get('campus_id')
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('orders')
    .select(
      `
      id, order_number, created_at, client_name, client_email,
      payment_method, subtotal, discount, total, status, promo_code,
      seller:profiles!seller_id(full_name),
      order_items(id, quantity, unit_price, discount_pct, line_total,
        product:products(id, name, sku, image_url))
    `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (campus_id) query = query.eq('campus_id', campus_id)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, total: count, page, limit })
}
