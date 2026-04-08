'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function upsertProduct(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const id          = formData.get('id') as string | null
  const name        = formData.get('name') as string
  const description = formData.get('description') as string
  const price       = parseFloat(formData.get('price') as string)
  const sku         = (formData.get('sku') as string) || null
  const category_id = (formData.get('category_id') as string) || null
  const stock       = parseInt(formData.get('stock') as string) || 0
  const low_stock_alert = parseInt(formData.get('low_stock_alert') as string) || 5
  const imageFile   = formData.get('image') as File | null

  if (!name || isNaN(price)) return { error: 'Nombre y precio son obligatorios' }

  let image_url: string | null = null
  if (imageFile && imageFile.size > 0) {
    const ext      = imageFile.name.split('.').pop()
    const filename = `${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filename, imageFile, { upsert: true })

    if (uploadError) return { error: `Error al subir imagen: ${uploadError.message}` }

    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(filename)
    image_url = urlData.publicUrl
  }

  const payload: any = {
    name,
    description: description || null,
    price,
    sku,
    category_id,
    created_by: user.id,
    ...(image_url && { image_url }),
  }

  if (id) {
    const { error } = await supabase.from('products').update(payload).eq('id', id)
    if (error) return { error: error.message }

    await supabase.from('inventory')
      .update({ low_stock_alert, updated_by: user.id })
      .eq('product_id', id)
  } else {
    const { data: productRaw, error } = await supabase
      .from('products').insert(payload).select().single()
    if (error) return { error: error.message }

    const product = productRaw as { id: string }

    await supabase.from('inventory').insert({
      product_id: product.id,
      stock,
      low_stock_alert,
      updated_by: user.id,
    })

    if (stock > 0) {
      await supabase.from('inventory_movements').insert({
        product_id: product.id,
        type: 'entrada',
        quantity: stock,
        notes: 'Stock inicial',
        created_by: user.id,
      })
    }
  }

  revalidatePath('/products')
  revalidatePath('/inventory')
  revalidatePath('/pos')
  return { success: true }
}

export async function toggleProductActive(id: string, active: boolean) {
  const supabase = createClient()
  const { error } = await supabase.from('products').update({ active }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/products')
  return { success: true }
}

export async function deleteProduct(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('products').update({ active: false }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/products')
  return { success: true }
}
