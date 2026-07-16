'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Tag, Trash2 } from 'lucide-react'

type ProductRow = {
  id: string
  name: string
  sku: string | null
  price: number
  active: boolean
  image_url: string | null
  category_name: string
  stock: number
}

export default function ProductsPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<ProductRow[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [userRole, setUserRole] = useState<string>('')
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function loadProducts() {
      setLoading(true)
      setError(null)

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        setError('No autenticado')
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

      const { data, error } = await supabase
        .from('inventory')
        .select(`
          id,
          stock,
          campus_id,
          product:products(
            id,
            name,
            sku,
            price,
            active,
            image_url,
            category:categories(name)
          )
        `)
        .order('id', { ascending: false })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      const inventoryRows = (data ?? []) as any[]

      const filteredInventory =
        profile.role === 'super_admin' || profile.role === 'adm_merch'
          ? inventoryRows
          : inventoryRows.filter((row) => row.campus_id === profile.campus_id)

      const grouped = new Map<string, ProductRow>()

      for (const row of filteredInventory) {
        const product = Array.isArray(row.product) ? row.product[0] : row.product
        if (!product?.id) continue

        const categoryRaw = product.category
        const categoryName = Array.isArray(categoryRaw)
          ? categoryRaw[0]?.name ?? 'Sin categoría'
          : categoryRaw?.name ?? 'Sin categoría'

        const existing = grouped.get(product.id)

        if (existing) {
          existing.stock += Number(row.stock ?? 0)
        } else {
          grouped.set(product.id, {
            id: product.id,
            name: product.name ?? 'Sin nombre',
            sku: product.sku ?? null,
            price: Number(product.price ?? 0),
            active: Boolean(product.active),
            image_url: product.image_url ?? null,
            category_name: categoryName,
            stock: Number(row.stock ?? 0),
          })
        }
      }

      setProducts(Array.from(grouped.values()))
      setLoading(false)
    }

    loadProducts()
  }, [supabase])

  const categories = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.category_name))).sort()
  }, [products])

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchSearch =
        !search ||
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        (product.sku ?? '').toLowerCase().includes(search.toLowerCase())

      const matchCategory =
        !categoryFilter || product.category_name === categoryFilter

      return matchSearch && matchCategory
    })
  }, [products, search, categoryFilter])

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(value)
  }

  const canDelete = userRole === 'super_admin' || userRole === 'adm_merch'

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`/api/products/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Error al eliminar el producto')
        setDeleting(false)
        return
      }

      // Quitar el producto de la lista local
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      setDeleteTarget(null)
      setDeleting(false)
    } catch (err: any) {
      alert(err?.message ?? 'Error al eliminar el producto')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-6 text-red-200">
        <p className="text-sm font-medium">Error cargando productos</p>
        <p className="mt-2 text-sm text-red-300/80">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Productos</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {products.length} productos registrados
          </p>
        </div>

        <Link
          href="/products/new"
          className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-400"
        >
          <Plus size={18} />
          Nuevo producto
        </Link>
        <Link
          href="/products/labels"
          className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white"
        >
          <Tag size={16} />
          Etiquetas
        </Link>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            type="text"
            placeholder="Buscar producto o SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-12 py-3 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
        >
          <option value="">Todas las categorías</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-700/60 bg-zinc-900/50">
        <div className="grid grid-cols-[56px_2fr_1.2fr_1.1fr_1fr_0.8fr_0.9fr_1fr] gap-4 border-b border-zinc-800 px-6 py-4 text-sm text-zinc-400">
          <div>#</div>
          <div>Producto</div>
          <div>Categoría</div>
          <div>SKU</div>
          <div>Precio</div>
          <div>Stock</div>
          <div>Estado</div>
          <div>Acciones</div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="px-6 py-10 text-sm text-zinc-500">
            No hay productos para mostrar.
          </div>
        ) : (
          filteredProducts.map((product, index) => (
            <div
              key={product.id}
              className="grid grid-cols-[56px_2fr_1.2fr_1.1fr_1fr_0.8fr_0.9fr_1fr] items-center gap-4 border-b border-zinc-800/70 px-6 py-4 last:border-b-0"
            >
              <div className="text-zinc-500">{index + 1}</div>

              <div className="flex items-center gap-3">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-12 w-12 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 text-xs text-zinc-500">
                    □
                  </div>
                )}

                <div>
                  <p className="font-medium text-white">{product.name}</p>
                </div>
              </div>

              <div>
                <span className="rounded-lg bg-zinc-800 px-3 py-1 text-sm text-zinc-300">
                  {product.category_name}
                </span>
              </div>

              <div className="text-white">{product.sku || '—'}</div>

              <div className="font-semibold text-amber-400">
                {formatCurrency(product.price)}
              </div>

              <div>
                <span className="rounded-lg bg-green-500/10 px-3 py-1 text-sm font-semibold text-green-300">
                  {product.stock}
                </span>
              </div>

              <div>
                <span
                  className={`rounded-lg px-3 py-1 text-sm ${
                    product.active
                      ? 'bg-green-500/10 text-green-300'
                      : 'bg-red-500/10 text-red-300'
                  }`}
                >
                  {product.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/products/${product.id}`}
                  className="inline-flex rounded-xl bg-zinc-700 px-4 py-2 text-sm text-white transition hover:bg-zinc-600"
                >
                  Editar todo
                </Link>
                {canDelete && (
                  <button
                    onClick={() => setDeleteTarget(product)}
                    className="inline-flex items-center rounded-xl bg-red-600/20 p-2 text-red-400 transition hover:bg-red-600/40 hover:text-red-300"
                    title="Eliminar producto"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de confirmación de eliminación */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white">¿Eliminar producto?</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Estás a punto de eliminar <strong className="text-white">{deleteTarget.name}</strong>. Esta acción no se puede deshacer y se eliminará todo el inventario asociado.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-xl bg-zinc-800 px-4 py-2 text-sm text-white transition hover:bg-zinc-700 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Sí, eliminar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}