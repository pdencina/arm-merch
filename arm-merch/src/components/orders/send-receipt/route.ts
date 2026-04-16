import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: Request) {
  try {
    const { orderId, email } = await req.json()

    if (!orderId || !email) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (!order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    const { data: items } = await supabase
      .from('order_items')
      .select(`
        quantity,
        unit_price,
        products (name)
      `)
      .eq('order_id', order.id)

    const formattedItems = (items ?? []).map((item: any) => {
      const product = Array.isArray(item.products)
        ? item.products[0]
        : item.products

      return {
        name: product?.name ?? 'Producto',
        quantity: item.quantity,
        price: item.unit_price,
        total: item.quantity * item.unit_price,
      }
    })

    const subtotal = formattedItems.reduce((sum, i) => sum + i.total, 0)

    const html = `
      <div style="font-family: Arial; max-width: 400px; margin: auto;">
        <h2 style="text-align:center;">ARM MERCH</h2>
        <p style="text-align:center;">Comprobante de compra</p>

        <hr/>

        <p><strong>Orden:</strong> #${order.order_number}</p>
        <p><strong>Fecha:</strong> ${new Date(order.created_at).toLocaleString()}</p>

        <hr/>

        ${formattedItems.map(i => `
          <div style="display:flex; justify-content:space-between;">
            <div>
              ${i.name}<br/>
              ${i.quantity} x $${i.price}
            </div>
            <div>$${i.total}</div>
          </div>
        `).join('')}

        <hr/>

        <p><strong>Subtotal:</strong> $${subtotal}</p>
        <p><strong>Descuento:</strong> $${order.discount ?? 0}</p>
        <h3>Total: $${order.total}</h3>

        <hr/>
        <p style="text-align:center;">Gracias por tu compra 🙌</p>
      </div>
    `

    await resend.emails.send({
      from: 'ARM Merch <onboarding@resend.dev>',
      to: email,
      subject: `Comprobante Orden #${order.order_number}`,
      html,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}