import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/inventory?campus_id=xxx
export async function GET(req: NextRequest) {
  try {
    const campusId = req.nextUrl.searchParams.get('campus_id')
    const sb = admin()

    // Traer productos activos
    const { data: products, error: pErr } = await sb
      .from('products')
      .select('id, name, description, price, sku, image_url, category_id, category:categories(name)')
      .eq('active', true)
      .order('name')

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

    // Traer inventario filtrado por campus
    let invQuery = sb.from('inventory').select('id, product_id, stock, low_stock_alert, campus_id')
    if (campusId) invQuery = invQuery.eq('campus_id', campusId)

    const { data: inventory, error: iErr } = await invQuery
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 })

    // Combinar — para cada producto, buscar su fila de inventario exacta
    const invMap: Record<string, any> = {}
    ;(inventory ?? []).forEach((i: any) => {
      // Solo guardar la fila del campus correcto
      if (!campusId || i.campus_id === campusId) {
        invMap[i.product_id] = i
      }
    })

    const result = (products ?? []).map((p: any) => {
      const inv = invMap[p.id]
      return {
        inventory_id:    inv?.id ?? null,
        campus_id:       inv?.campus_id ?? null,
        id:              p.id,
        name:            p.name,
        price:           p.price,
        sku:             p.sku,
        image_url:       p.image_url,
        category_id:     p.category_id,
        category_name:   (p.category as any)?.name ?? null,
        stock:           inv?.stock ?? 0,
        low_stock_alert: inv?.low_stock_alert ?? 5,
        low_stock:       (inv?.stock ?? 0) <= (inv?.low_stock_alert ?? 5),
      }
    })

    return NextResponse.json({ products: result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH /api/inventory — actualizar stock por inventory_id
export async function PATCH(req: NextRequest) {
  try {
    const { inventory_id, stock } = await req.json()
    if (!inventory_id) return NextResponse.json({ error: 'inventory_id requerido' }, { status: 400 })

    const sb = admin()
    
    // Verificar que el registro existe antes de actualizar
    const { data: existing } = await sb
      .from('inventory')
      .select('id, campus_id, stock')
      .eq('id', inventory_id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })

    const { error } = await sb
      .from('inventory')
      .update({ stock, updated_at: new Date().toISOString() })
      .eq('id', inventory_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, inventory_id, stock, campus_id: existing.campus_id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
