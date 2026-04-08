import { createClient } from '@/lib/supabase/server'
import InventoryClient from './inventory-client'

export default async function InventoryPage() {
  const supabase = createClient()

  const [{ data: productsRaw }, { data: categoriesRaw }] = await Promise.all([
    supabase.from('products_with_stock').select('*').order('name'),
    supabase.from('categories').select('id, name').eq('active', true).order('name'),
  ])

  return (
    <InventoryClient
      initialProducts={(productsRaw ?? []) as any[]}
      categories={(categoriesRaw ?? []) as { id: string; name: string }[]}
    />
  )
}
