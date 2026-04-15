'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AssignCampusForm from '@/components/products/assign-campus-form'
import EditProductForm from '@/components/products/edit-product-form'

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [product, setProduct] = useState<any>(null)
  const [campuses, setCampuses] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [userCampusId, setUserCampusId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const productId = params?.id as string

        if (!productId) {
          setError('Producto no encontrado')
          setLoading(false)
          return
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError || !session) {
          setError('No hay sesión activa')
          setLoading(false)
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, campus_id')
          .eq('id', session.user.id)
          .single()

        if (profileError || !profile) {
          setError(profileError?.message ?? 'No se pudo cargar el perfil')
          setLoading(false)
          return
        }

        setUserRole(profile.role ?? '')
        setUserCampusId(profile.campus_id ?? null)

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
            created_at,
            updated_at,
            created_by,
            category:categories(id, name),
            inventory(
              id,
              stock,
              low_stock_alert,
              campus_id,
              updated_at,
              updated_by,
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

        const inventoryRows = Array.isArray((productData as any).inventory)
          ? (productData as any).inventory
          : []

        if (
          profile.role === 'admin' &&
          profile.campus_id &&
          !inventoryRows.some((row: any) => row.campus_id === profile.campus_id)
        ) {
          setError('No tienes acceso a este producto porque no pertenece a tu campus')
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

        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categories')
          .select('id, name')
          .eq('active', true)
          .order('name')

        if (categoriesError) {
          setError(categoriesError.message)
          setLoading(false)
          return
        }

        setProduct(productData)
        setCampuses(campusesData ?? [])
        setCategories(categoriesData ?? [])
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

  let inventoryRows = Array.isArray(product.inventory) ? product.inventory : []

  if (userRole === 'admin' && userCampusId) {
    inventoryRows = inventoryRows.filter((row: any) => row.campus_id === userCampusId)
  }

  const isSuperAdmin = userRole === 'super_admin'

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
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

            <div className="grid gap-2 pt-2 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                  Producto creado
                </p>
                <p className="mt-1 text-sm text-white">
                  {formatDateTime(product.created_at)}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                  Última actualización
                </p>
                <p className="mt-1 text-sm text-white">
                  {formatDateTime(product.updated_at)}
                </p>
              </div>
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

      <EditProductForm
        product={{
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          sku: product.sku,
          category_id: product.category_id,
          image_url: product.image_url,
          active: product.active,
        }}
        categories={categories}
      />

      <div className={`grid gap-6 ${isSuperAdmin ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
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
                    className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3"
                  >
                    <div className="flex items-center justify-between">
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

                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <div className="rounded-lg bg-zinc-900 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                          Última actualización inventario
                        </p>
                        <p className="mt-1 text-sm text-zinc-300">
                          {formatDateTime(row.updated_at)}
                        </p>
                      </div>

                      <div className="rounded-lg bg-zinc-900 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                          Campus
                        </p>
                        <p className="mt-1 text-sm text-zinc-300">
                          {campusName || '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {isSuperAdmin && (
          <AssignCampusForm
            productId={product.id}
            productName={product.name}
            campuses={campuses}
          />
        )}
      </div>
    </div>
  )
}