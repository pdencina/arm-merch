import { createClient } from '@/lib/supabase/server'
import ProductForm from '@/components/products/product-form'

export default async function NewProductPage() {
  const supabase = await createClient()
  const { data: categoriesRaw } = await supabase
    .from('categories').select('id, name').eq('active', true).order('name')

  return (
    <div className="max-w-xl flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-white">Nuevo producto</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Completa los datos para agregar un producto al catálogo</p>
      </div>
      <ProductForm categories={(categoriesRaw ?? []) as { id: string; name: string }[]} />
    </div>
  )
}
