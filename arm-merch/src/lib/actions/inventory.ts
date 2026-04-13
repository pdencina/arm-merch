'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function registerMovement(input: {
  product_id: string
  type: 'entrada' | 'salida' | 'ajuste'
  quantity: number
  notes?: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  try {
    // 1. Obtener stock actual
    const { data: invRow } = await supabase
      .from('inventory')
      .select('stock')
      .eq('product_id', input.product_id)
      .maybeSingle()

    const currentStock = invRow?.stock ?? 0
    let newStock = currentStock

    if (input.type === 'entrada') newStock += input.quantity
    else if (input.type === 'salida') newStock -= input.quantity
    else if (input.type === 'ajuste') newStock = input.quantity

    // 2. Guardar (Si no existe lo crea, si existe lo actualiza)
    const { error: upsertError } = await supabase
      .from('inventory')
      .upsert({
        product_id: input.product_id,
        stock: newStock,
        updated_at: new Date().toISOString()
      }, { onConflict: 'product_id' })

    if (upsertError) throw upsertError

    // 3. Registrar historial
    await supabase.from('inventory_movements').insert({
      product_id: input.product_id,
      type: input.type,
      quantity: input.quantity,
      notes: input.notes || '',
      created_by: user.id
    })

    revalidatePath('/inventory')
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}
