'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/auth/get-current-profile'

interface OrderItem {
  product_id: string
  quantity: number
  unit_price: number
}

interface CreateOrderInput {
  items: OrderItem[]
  payment_method: 'efectivo' | 'transferencia' | 'debito' | 'credito'
  discount?: number
  notes?: string
}

export async function createOrder(input: CreateOrderInput) {
  const supabase = await createClient()

  const profileResult = await getCurrentProfile()
  if ('error' in profileResult) {
    return { error: profileResult.error }
  }

  const profile = profileResult.data

  if (!profile.campus_id && profile.role !== 'super_admin') {
    return { error: 'Usuario sin campus asignado' }
  }

  const campusId = profile.campus_id
  if (!campusId) {
    return { error: 'Campus no resuelto' }
  }

  const subtotal = input.items.reduce(
    (sum, i) => sum + i.unit_price * i.quantity,
    0
  )

  const discount = input.discount ?? 0
  const total = subtotal - discount

  for (const item of input.items) {
    const { data: inv, error: invError } = await supabase
      .from('inventory')
      .select('id, stock')
      .eq('product_id', item.product_id)
      .eq('campus_id', campusId)
      .single()

    if (invError || !inv) {
      return { error: 'Inventario no encontrado para uno de los productos' }
    }

    if (inv.stock < item.quantity) {
      return { error: 'Stock insuficiente para uno de los productos' }
    }
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      seller_id: profile.id,
      campus_id: campusId,
      payment_method: input.payment_method,
      subtotal,
      discount,
      total,
      notes: input.notes ?? null,
      status: 'completada',
    })
    .select('id, order_number')
    .single()

  if (orderError || !order) {
    return { error: orderError?.message ?? 'No se pudo crear la orden' }
  }

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(
      input.items.map((i) => ({
        order_id: order.id,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        subtotal: i.quantity * i.unit_price,
      }))
    )

  if (itemsError) {
    return { error: itemsError.message }
  }

  for (const item of input.items) {
    const { data: inv, error: invError } = await supabase
      .from('inventory')
      .select('id, stock')
      .eq('product_id', item.product_id)
      .eq('campus_id', campusId)
      .single()

    if (invError || !inv) {
      return { error: 'No se pudo actualizar el inventario' }
    }

    const newStock = inv.stock - item.quantity

    const { error: updateError } = await supabase
      .from('inventory')
      .update({
        stock: newStock,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inv.id)

    if (updateError) {
      return { error: updateError.message }
    }

    const { error: movementError } = await supabase
      .from('inventory_movements')
      .insert({
        product_id: item.product_id,
        campus_id: campusId,
        type: 'salida',
        quantity: item.quantity,
        notes: `Venta #${order.order_number}`,
        created_by: profile.id,
      })

    if (movementError) {
      return { error: movementError.message }
    }
  }

  revalidatePath('/pos')
  revalidatePath('/orders')
  revalidatePath('/inventory')
  revalidatePath('/dashboard')

  return {
    success: true,
    orderId: order.id,
    orderNumber: order.order_number,
  }
}

export async function getOrders() {
  const supabase = await createClient()

  const profileResult = await getCurrentProfile()
  if ('error' in profileResult) {
    return { error: profileResult.error, data: [] }
  }

  const profile = profileResult.data

  let query = supabase
    .from('orders')
    .select(`
      *,
      seller:profiles(full_name, email),
      order_items(
        *,
        product:products(name, sku)
      )
    `)
    .order('created_at', { ascending: false })

  if (profile.role !== 'super_admin' && profile.campus_id) {
    query = query.eq('campus_id', profile.campus_id)
  }

  const { data, error } = await query

  if (error) {
    return { error: error.message, data: [] }
  }

  return { data: (data ?? []) as any[] }
}