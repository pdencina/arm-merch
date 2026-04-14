'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AssignCampusForm from '@/components/products/assign-campus-form'

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [product, setProduct] = useState<any>(null)
  const [campuses, setCampuses] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const productId = params?.id as string

        if (!productId) {
          setError('Producto no encontrado')
          setLoading(false)
          return
        }

        const { data: productData, error: productError } = await supabase
          .from('products')
          .select(`
            id,
            name,
            description,
            price,
            sku,
            active,
            image_url,
            category_id,
            category:categories(id, name),
            inventory(
              id,
              stock,
              low_stock_alert,
              campus_id,
              campus:campus(id, name)
            )
          `)
          .eq('id', productId)
          .single()

        if (productError || !productData) {
          setError(productError?.message ?? 'No se pudo cargar el producto')
          setLoading(false)
          return
        }

        const { data: campusesData, error: campusesError } = await supabase
          .from('campus')
          .select('id, name')
          .eq('active', true)
          .order('name')

        if (campusesError) {
          setError(campusesError.message)
          setLoading(false)
          return
        }

        setProduct(productData)
        setCampuses(campusesData ?? [])
        setLoading(false)
      } catch (err: any) {
        setError(err?.message ?? 'Error cargando producto')
        setLoading(false)
      }
    }

    load()
  }, [params, supabase])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-6 text-red-200">
          <p className="text-sm font-medium">No se pudo cargar el producto</p>
          <p className="mt-2 text-sm text-red-300/80">
            {error ?? 'Producto no encontrado'}
          </p>
        </div>

        <button
          onClick={() => router.push('/products')}
          className="rounded-xl bg-zinc-800 px-4 py-2 text-sm text-white transition hover:bg-zinc-700"
        >
          Volver a productos
        </button>
      </div>
    )
  }

  const inventoryRows = Array.isArray(product.inventory) ? product.inventory : []

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white">{product.name}</h1>

            <p className="text-sm text-zinc-400">
              {product.description || 'Sin descripción'}
            </p>

            <div className="flex flex-wrap gap-2 pt-2">
              <span className="rounded-lg bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                SKU: {product.sku || '—'}
              </span>

              <span className="rounded-lg bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                Precio: $
                {new Intl.NumberFormat('es-CL', {
                  maximumFractionDigits: 0,
                }).format(Number(product.price ?? 0))}
              </span>

              <span className="rounded-lg bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                Categoría:{' '}
                {Array.isArray(product.category)
                  ? product.category[0]?.name ?? '—'
                  : product.category?.name ?? '—'}
              </span>

              <span
                className={`rounded-lg px-3 py-1 text-xs ${
                  product.active
                    ? 'bg-green-500/10 text-green-300'
                    : 'bg-red-500/10 text-red-300'
                }`}
              >
                {product.active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>

          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-24 w-24 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-zinc-800 text-xs text-zinc-500">
              Sin imagen
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">
            Inventario actual por campus
          </h2>

          {inventoryRows.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Este producto aún no está asignado a ningún campus.
            </p>
          ) : (
            <div className="space-y-3">
              {inventoryRows.map((row: any) => {
                const campusRaw = row.campus
                const campusName = Array.isArray(campusRaw)
                  ? campusRaw[0]?.name
                  : campusRaw?.name

                return (
                  <div
                    key={row.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">
                        {campusName || 'Campus sin nombre'}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Alerta stock bajo: {row.low_stock_alert ?? 5}
                      </p>
                    </div>

                    <span
                      className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                        Number(row.stock ?? 0) === 0
                          ? 'bg-red-500/10 text-red-300'
                          : Number(row.stock ?? 0) <= Number(row.low_stock_alert ?? 5)
                            ? 'bg-orange-500/10 text-orange-300'
                            : 'bg-green-500/10 text-green-300'
                      }`}
                    >
                      Stock: {row.stock ?? 0}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <AssignCampusForm
          productId={product.id}
          productName={product.name}
          campuses={campuses}
        />
      </div>
    </div>
  )
}