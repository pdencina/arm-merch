import { createClient } from '@/lib/supabase/server'
import ProductForm from '../product-form'

export default async function NewProductPage() {
  const supabase = createClient()

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('active', true)

  const { data: campuses } = await supabase
    .from('campus')
    .select('id, name')
    .eq('active', true)

  return (
    <ProductForm
      categories={categories ?? []}
      campuses={campuses ?? []}
    />
  )
}