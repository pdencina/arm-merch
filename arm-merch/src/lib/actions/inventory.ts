'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface MovementInput {
  product_id: string
  type: 'entrada' | 'salida' | 'ajuste'
  quantity: number
  notes?: string
}

export async function registerMovement(input: MovementInput) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (input.type !== 'entrada') {
    const { data: invRaw } = await supabase
      .from('inventory')
      .select('stock')
      .eq('product_id', input.product_id)
      .single()

    const inv = invRaw as { stock: number } | null
    if (!inv || (inv.stock - input.quantity) < 0) {
      return { error: 'Stock insuficiente para este movimiento' }
    }
  }

  const { error } = await supabase
    .from('inventory_movements')
    .insert({
      product_id: input.product_id,
      type: input.type,
      quantity: input.quantity,
      notes: input.notes ?? null,
      created_by: user.id,
    })

  if (error) return { error: error.message }

  revalidatePath('/inventory')
  revalidatePath('/dashboard')

  return { success: true }
}

export async function getMovements(productId?: string) {
  const supabase = createClient()

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

  const { data, error } = await query
  if (error) return { error: error.message, data: [] }
  return { data: (data ?? []) as any[] }
}
