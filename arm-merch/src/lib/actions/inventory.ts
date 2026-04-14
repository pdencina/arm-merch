'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/auth/get-current-profile'

interface MovementInput {
  product_id: string
  type: 'entrada' | 'salida' | 'ajuste'
  quantity: number
  notes?: string
}

export async function registerMovement(input: MovementInput) {
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

  const { data: inventoryRow, error: inventoryError } = await supabase
    .from('inventory')
    .select('id, stock, low_stock_alert')
    .eq('product_id', input.product_id)
    .eq('campus_id', campusId)
    .single()

  if (inventoryError || !inventoryRow) {
    return { error: 'Inventario no encontrado para este campus' }
  }

  let newStock = inventoryRow.stock

  if (input.type === 'entrada') newStock += input.quantity
  if (input.type === 'salida') newStock -= input.quantity
  if (input.type === 'ajuste') newStock = input.quantity

  if (newStock < 0) {
    return { error: 'Stock insuficiente para este movimiento' }
  }

  const { error: updateError } = await supabase
    .from('inventory')
    .update({
      stock: newStock,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', inventoryRow.id)

  if (updateError) {
    return { error: updateError.message }
  }

  const movementQuantity =
    input.type === 'ajuste'
      ? Math.abs(newStock - inventoryRow.stock)
      : input.quantity

  const { error: movementError } = await supabase
    .from('inventory_movements')
    .insert({
      product_id: input.product_id,
      campus_id: campusId,
      type: input.type,
      quantity: movementQuantity,
      notes: input.notes ?? null,
      created_by: profile.id,
    })

  if (movementError) {
    return { error: movementError.message }
  }

  revalidatePath('/inventory')
  revalidatePath('/dashboard')

  return { success: true }
}

export async function getMovements(productId?: string) {
  const supabase = await createClient()

  const profileResult = await getCurrentProfile()
  if ('error' in profileResult) {
    return { error: profileResult.error, data: [] }
  }

  const profile = profileResult.data

  let query = supabase
    .from('inventory_movements')
    .select(`
      *,
      product:products(name, sku),
      created_by_profile:profiles(full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (productId) {
    query = query.eq('product_id', productId)
  }

  if (profile.role !== 'super_admin' && profile.campus_id) {
    query = query.eq('campus_id', profile.campus_id)
  }

  const { data, error } = await query

  if (error) {
    return { error: error.message, data: [] }
  }

  return { data: (data ?? []) as any[] }
}