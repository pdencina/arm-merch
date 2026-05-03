import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── POST /api/orders ─────────────────────────────────────────────────────────
// FIXES:
//   1. Inserta 'subtotal' en order_items (requerido por schema original) → fix productos no visibles
//   2. Usa inventario ya consultado (no re-consulta en el loop) → previene race conditions
//   3. Compatible con order_contacts (tabla separada para datos del cliente)
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '').trim()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return NextResponse.json({ error: 'Faltan variables de entorno' }, { status: 500 })
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: { user }, error: userError } = await authClient.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await req.json()

    const items: Array<{
      product_id: string
      quantity: number
      unit_price: number
      discount_pct?: number
      size?: string | null
    }> = Array.isArray(body.items) ? body.items : []

    const paymentMethod: string  = body.payment_method ?? null
    const discount                = Number(body.discount ?? 0)
    const promoCode: string|null  = body.promo_code ?? null
    const deliveryStatus: string|null = body.delivery_status ?? null
    const extraNotes: string|null = body.notes ?? null
    const requestedCampusId: string|null = body.campus_id ?? null
    const clientName: string|null = String(body.client_name ?? '').trim() || null
    const clientEmail: string|null = String(body.client_email ?? '').trim().toLowerCase() || null
    const clientPhone: string|null = String(body.client_phone ?? '').trim() || null

    const isSmartPOS = paymentMethod === 'credito' && body.notes?.includes('Smart POS')
    if (!items.length || (!clientName && !isSmartPOS) || !paymentMethod) {
      return NextResponse.json(
        { error: 'Datos incompletos: items, nombre del cliente y método de pago son requeridos' },
        { status: 400 }
      )
    }

    // ── Perfil del vendedor ──
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role, campus_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const sellingCampusId =
      profile.role === 'super_admin'
        ? requestedCampusId || profile.campus_id
        : profile.campus_id

    if (!sellingCampusId) {
      return NextResponse.json({ error: 'Campus inválido' }, { status: 400 })
    }

    // ── Normalizar items ──
    const normalizedItems = items.map((i) => ({
      product_id: i.product_id,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      discount_pct: Number(i.discount_pct ?? 0),
      size: i.size ?? null,
    }))

    const invalidItem = normalizedItems.find(
      (i) => !i.product_id || i.quantity <= 0 || i.unit_price < 0
    )
    if (invalidItem) {
      return NextResponse.json({ error: 'Hay productos inválidos en la venta' }, { status: 400 })
    }

    // ── Verificar stock (una sola consulta) ──
    const productIds = normalizedItems.map((i) => i.product_id)
    const { data: inventoryRows, error: inventoryError } = await adminClient
      .from('inventory')
      .select('id, product_id, stock')
      .in('product_id', productIds)
      .eq('campus_id', sellingCampusId)

    if (inventoryError) {
      return NextResponse.json({ error: inventoryError.message }, { status: 400 })
    }

    const inventoryMap = new Map(
      (inventoryRows ?? []).map((row: any) => [row.product_id, row])
    )

    for (const item of normalizedItems) {
      const inv = inventoryMap.get(item.product_id)
      if (!inv) {
        return NextResponse.json(
          { error: 'Uno de los productos no tiene inventario en este campus' },
          { status: 400 }
        )
      }
      if (Number(inv.stock ?? 0) < item.quantity) {
        return NextResponse.json(
          { error: `Stock insuficiente. Disponible: ${inv.stock ?? 0}` },
          { status: 400 }
        )
      }
    }

    // ── Calcular totales ──
    const subtotalCalculado = normalizedItems.reduce(
      (sum, i) => sum + i.unit_price * i.quantity * (1 - i.discount_pct / 100),
      0
    )
    const totalCalculado = Math.max(0, subtotalCalculado - discount)

    if (discount < 0) {
      return NextResponse.json({ error: 'El descuento no puede ser negativo' }, { status: 400 })
    }

    // ── Número de orden ──
    const { data: lastOrder, error: lastOrderError } = await adminClient
      .from('orders')
      .select('order_number')
      .order('order_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastOrderError) {
      return NextResponse.json({ error: lastOrderError.message }, { status: 400 })
    }
    const orderNumber = Number(lastOrder?.order_number ?? 1000) + 1

    // ── Notas combinadas ──
    const combinedNotes = [
      promoCode ? `Cupón: ${promoCode}` : null,
      extraNotes,
    ].filter(Boolean).join(' | ') || null

    // ── Crear orden ──
    const { data: createdOrder, error: orderError } = await adminClient
      .from('orders')
      .insert({
        order_number: orderNumber,
        campus_id: sellingCampusId,
        seller_id: profile.id,
        payment_method: paymentMethod,
        discount,
        total: Math.round(totalCalculado),
        notes: combinedNotes,
        status: paymentMethod === 'link' ? 'pending' : 'paid',
        delivery_status: deliveryStatus,
        client_phone: clientPhone || null,
      })
      .select('id, order_number, status, created_at, total, discount, payment_method, notes')
      .single()

    if (orderError || !createdOrder) {
      return NextResponse.json(
        { error: orderError?.message ?? 'No se pudo crear la orden' },
        { status: 400 }
      )
    }

    // ── Guardar contacto en order_contacts ──
    if (clientName || clientEmail) {
      const { error: contactError } = await adminClient
        .from('order_contacts')
        .insert({ order_id: createdOrder.id, client_name: clientName, client_email: clientEmail, client_phone: clientPhone || null })
      if (contactError) {
        return NextResponse.json({ error: contactError.message }, { status: 400 })
      }
    }

    // ── Insertar order_items ──
    // subtotal es columna GENERADA por la BD — no se puede insertar manualmente
    const orderItemsRows = normalizedItems.map((item) => ({
      order_id: createdOrder.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      ...(item.size ? { size: item.size } : {}),
    }))

    const { error: orderItemsError } = await adminClient
      .from('order_items')
      .insert(orderItemsRows)

    if (orderItemsError) {
      return NextResponse.json({ error: orderItemsError.message }, { status: 400 })
    }

    // ── Actualizar stock vía trigger ──
    // Si es pedido pendiente NO descontar stock — se descuenta al entregar.
    if (deliveryStatus !== 'pending' && paymentMethod !== 'link') {
      for (const item of normalizedItems) {
        const { error: movementError } = await adminClient
          .from('inventory_movements')
          .insert({
            product_id: item.product_id,
            campus_id: sellingCampusId,
            type: 'salida',
            quantity: item.quantity,
            notes: `Venta ${createdOrder.order_number}`,
            created_by: profile.id,
          })

        if (movementError) {
          return NextResponse.json({ error: movementError.message }, { status: 400 })
        }
      }
    }

    // ── Email con Resend ──
    let emailSent = false
    if (clientEmail && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        const fmtCLP = (n: number) =>
          new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
        const escHtml = (v: string) =>
          String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

        // Fetch product names for the email
        const { data: productData } = await adminClient
          .from('products')
          .select('id, name')
          .in('id', normalizedItems.map(i => i.product_id))
        const productMap: Record<string, string> = {}
        ;(productData ?? []).forEach((p: any) => { productMap[p.id] = p.name })

        const itemsHtml = normalizedItems.map((item) => {
          const lineTotal = item.unit_price * item.quantity * (1 - item.discount_pct / 100)
          const productName = escHtml(productMap[item.product_id] ?? item.product_id)
          const sizeLabel = item.size ? `<br/><span style="color:#888;font-size:11px;">Talla: ${item.size}</span>` : ''
          return `<tr>
            <td style="padding:12px 8px;border-bottom:1px solid #f0f0f0;font-size:14px;">
              ${productName}${sizeLabel}
            </td>
            <td style="padding:12px 8px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:14px;color:#666;">${item.quantity}</td>
            <td style="padding:12px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;font-weight:600;">${fmtCLP(lineTotal)}</td>
          </tr>`
        }).join('')

        const orderDate = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
        const paymentLabel: Record<string,string> = {
          efectivo:'Efectivo', transferencia:'Transferencia', debito:'Débito',
          credito:'Crédito', link:'Link de pago', sumup:'Smart POS'
        }

        const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

      <!-- Header -->
      <tr><td style="background:#18181b;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
        <p style="margin:0 0 4px;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">ARM Merch</p>
        <p style="margin:0;font-size:13px;color:#a1a1aa;">Sistema de Merch · ARM Global</p>
      </td></tr>

      <!-- Green confirmation bar -->
      <tr><td style="background:#16a34a;padding:16px 40px;text-align:center;">
        <p style="margin:0;font-size:15px;font-weight:600;color:#ffffff;">✓ &nbsp;Compra confirmada</p>
      </td></tr>

      <!-- Body -->
      <tr><td style="background:#ffffff;padding:36px 40px;">

        <!-- Greeting -->
        <p style="margin:0 0 24px;font-size:16px;color:#18181b;">
          Hola <strong>${escHtml(clientName ?? 'Cliente')}</strong>, gracias por tu compra. 
          Aquí está el resumen de tu pedido.
        </p>

        <!-- Order info -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;margin-bottom:28px;">
          <tr>
            <td style="padding:16px 20px;border-bottom:1px solid #f0f0f0;">
              <span style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;">Número de orden</span><br/>
              <span style="font-size:18px;font-weight:700;color:#18181b;">#${createdOrder.order_number}</span>
            </td>
            <td style="padding:16px 20px;border-bottom:1px solid #f0f0f0;text-align:right;">
              <span style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;">Fecha</span><br/>
              <span style="font-size:14px;font-weight:500;color:#18181b;">${orderDate}</span>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding:16px 20px;">
              <span style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;">Método de pago</span><br/>
              <span style="font-size:14px;font-weight:500;color:#18181b;">${paymentLabel[paymentMethod] ?? paymentMethod}</span>
            </td>
          </tr>
        </table>

        <!-- Products table -->
        <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;">Detalle de compra</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:10px 8px;text-align:left;font-size:12px;color:#71717a;font-weight:600;border-bottom:2px solid #e4e4e7;">PRODUCTO</th>
              <th style="padding:10px 8px;text-align:center;font-size:12px;color:#71717a;font-weight:600;border-bottom:2px solid #e4e4e7;">CANT.</th>
              <th style="padding:10px 8px;text-align:right;font-size:12px;color:#71717a;font-weight:600;border-bottom:2px solid #e4e4e7;">TOTAL</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <!-- Totals -->
        ${discount > 0 ? `
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 0;font-size:14px;color:#666;">Subtotal</td>
            <td style="padding:6px 0;font-size:14px;color:#666;text-align:right;">${fmtCLP(Math.round(totalCalculado + discount))}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:14px;color:#16a34a;">Descuento</td>
            <td style="padding:6px 0;font-size:14px;color:#16a34a;text-align:right;">-${fmtCLP(discount)}</td>
          </tr>
        </table>
        <hr style="border:none;border-top:1px solid #e4e4e7;margin:12px 0;"/>
        ` : ''}
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:12px 0;font-size:18px;font-weight:700;color:#18181b;">Total pagado</td>
            <td style="padding:12px 0;font-size:22px;font-weight:800;color:#18181b;text-align:right;">${fmtCLP(Math.round(totalCalculado))}</td>
          </tr>
        </table>

      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;border-top:1px solid #e4e4e7;">
        <p style="margin:0 0 8px;font-size:13px;color:#71717a;">
          ¿Tienes alguna consulta? Contáctanos y menciona tu número de orden.
        </p>
        <p style="margin:0;font-size:12px;color:#a1a1aa;">
          ARM Merch · ARM Global · armerch.com
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`

        const { error: mailError } = await resend.emails.send({
          from: 'ARM Merch <onboarding@resend.dev>',
          to: clientEmail,
          subject: `Comprobante Orden #${createdOrder.order_number}`,
          html,
        })
        if (!mailError) emailSent = true
        else console.error('Email error:', mailError)
      } catch (e) {
        console.error('Email exception:', e)
      }
    }

    return NextResponse.json({
      success: true,
      order_id: createdOrder.id,
      order_number: createdOrder.order_number,
      status: createdOrder.status,
      email_sent: emailSent,
    })
  } catch (error: any) {
    console.error('POST /api/orders error:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
