import { createClient } from '@/lib/supabase/server'
import ProductForm from '@/components/products/product-form'
import { notFound } from 'next/navigation'

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const [{ data: productRaw }, { data: categoriesRaw }] = await Promise.all([
    supabase.from('products_with_stock').select('*').eq('id', params.id).single(),
    supabase.from('categories').select('id, name').eq('active', true).order('name'),
  ])

  if (!productRaw) notFound()

  return (
    <div className="max-w-xl flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-white">Editar producto</h1>
        <p className="text-xs text-zinc-500 mt-0.5">{(productRaw as any).name}</p>
      </div>
      <ProductForm
        categories={(categoriesRaw ?? []) as { id: string; name: string }[]}
        product={productRaw as any}
      />
    </div>
  )
}
