'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit2, Check, X, Search, Package, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(n)

export default function ProductsPage() {
  const [products, setProducts]     = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [userRole, setUserRole]     = useState('')
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [catFilter, setCatFilter]   = useState('')

  // Edición inline
  const [editId, setEditId]         = useState<string | null>(null)
  const [editField, setEditField]   = useState<string>('')
  const [editVal, setEditVal]       = useState<string>('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    const [{ data: p }, { data: c }, { data: profile }] = await Promise.all([
      // Traer TODOS los productos sin filtrar por campus
      supabase.from('products').select(`
        id, name, description, price, sku, active, image_url, category_id,
        inventory(stock, low_stock_alert, campus_id)
      `).eq('active', true).order('name'),
      supabase.from('categories').select('id, name').eq('active', true).order('name'),
      session ? supabase.from('profiles').select('role').eq('id', session.user.id).single() : Promise.resolve({ data: null }),
    ])

    // Aplanar el stock del primer inventario
    const withStock = (p ?? []).map((prod: any) => ({
      ...prod,
      stock: prod.inventory?.[0]?.stock ?? 0,
      low_stock_alert: prod.inventory?.[0]?.low_stock_alert ?? 5,
    }))

    setProducts(withStock)
    setCategories(c ?? [])
    setUserRole(profile?.role ?? '')
    setLoading(false)
  }

  const filtered = products.filter(p => {
    const q = search.toLowerCase()
    return (!search || p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
      && (!catFilter || p.category_id === catFilter)
  })

  function startEdit(productId: string, field: string, value: string) {
    setEditId(productId)
    setEditField(field)
    setEditVal(value)
  }

  function cancelEdit() { setEditId(null); setEditField(''); setEditVal('') }

  async function saveEdit(productId: string) {
    if (!editVal.trim()) { toast.error('El valor no puede estar vacío'); return }

    const supabase = createClient()
    const update: any = {}

    if (editField === 'price') {
      const val = parseFloat(editVal)
      if (isNaN(val) || val <= 0) { toast.error('Precio inválido'); return }
      update.price = val
    } else if (editField === 'name') {
      update.name = editVal.trim()
    } else if (editField === 'sku') {
      update.sku = editVal.trim() || null
    }

    const { error } = await supabase.from('products').update(update).eq('id', productId)
    if (error) { toast.error(error.message); return }

    setProducts(prev => prev.map(p => p.id === productId ? { ...p, ...update } : p))
    cancelEdit()
    toast.success('Producto actualizado')
  }

  async function toggleActive(productId: string, active: boolean) {
    const { error } = await createClient().from('products').update({ active }).eq('id', productId)
    if (error) { toast.error(error.message); return }
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, active } : p))
    toast.success(active ? 'Producto activado' : 'Producto desactivado')
  }

  const EditableCell = ({ productId, field, value, type = 'text', canEdit = true }: any) => {
    const isEditing = editId === productId && editField === field
    if (isEditing) return (
      <div className="flex items-center gap-1">
        <input autoFocus type={type} min={type === 'number' ? '0' : undefined}
          value={editVal} onChange={e => setEditVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') saveEdit(productId); if (e.key === 'Escape') cancelEdit() }}
          className="w-28 bg-zinc-700 border border-amber-500/60 text-white rounded-lg px-2 py-1 text-xs focus:outline-none" />
        <button onClick={() => saveEdit(productId)} className="text-green-400 hover:text-green-300"><Check size={13} /></button>
        <button onClick={cancelEdit} className="text-zinc-500 hover:text-zinc-300"><X size={13} /></button>
      </div>
    )
    return (
      <div className={`flex items-center gap-1.5 ${canEdit ? 'group cursor-pointer' : ''}`}
        onClick={() => canEdit && startEdit(productId, field, value?.toString() ?? '')}>
        <span className={`text-sm ${field === 'price' ? 'font-bold text-amber-400' : 'text-zinc-200'}`}>
          {field === 'price' ? fmt(value) : (value || '—')}
        </span>
        {canEdit && <Edit2 size={11} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-amber-400 transition shrink-0" />}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Productos</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{products.length} productos registrados</p>
        </div>
        <Link href="/products/new"
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl px-4 py-2.5 text-sm transition active:scale-[0.98]">
          <Plus size={14} />Nuevo producto
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto o SKU..."
            className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600
                       rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition">
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-zinc-800/30 rounded-xl border border-zinc-700/40 overflow-hidden">
          {userRole === 'super_admin' && (
            <div className="px-4 py-2.5 bg-amber-500/5 border-b border-amber-500/10">
              <p className="text-[10px] text-amber-400/70">
                Haz click en el nombre, SKU o precio para editarlo directamente
              </p>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700/60">
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 w-8">#</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Producto</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 hidden sm:table-cell">Categoría</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 hidden md:table-cell">SKU</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Precio</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Stock</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 hidden sm:table-cell">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-zinc-600 text-sm">
                    <Package size={28} className="mx-auto mb-2 text-zinc-700" />
                    No hay productos que coincidan
                  </td></tr>
                ) : filtered.map((product, i) => (
                  <tr key={product.id} className="border-b border-zinc-700/30 hover:bg-zinc-700/10 transition">
                    <td className="px-4 py-3 text-xs text-zinc-600">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-zinc-700/60 flex items-center justify-center shrink-0">
                            <Package size={13} className="text-zinc-500" />
                          </div>
                        )}
                        <EditableCell productId={product.id} field="name" value={product.name} canEdit={userRole === 'super_admin'} />
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs bg-zinc-700/60 text-zinc-400 px-2 py-1 rounded-lg">
                        {categories.find(c => c.id === product.category_id)?.name ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <EditableCell productId={product.id} field="sku" value={product.sku} canEdit={userRole === 'super_admin'} />
                    </td>
                    <td className="px-4 py-3">
                      <EditableCell productId={product.id} field="price" value={product.price} type="number" canEdit={userRole === 'super_admin'} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                        product.stock === 0 ? 'bg-red-500/10 text-red-400' :
                        product.stock <= 5  ? 'bg-orange-500/10 text-orange-400' :
                                              'bg-green-500/10 text-green-400'}`}>
                        {product.stock ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <button onClick={() => toggleActive(product.id, !product.active)} className="flex items-center gap-1.5 transition">
                        {product.active !== false
                          ? <><ToggleRight size={18} className="text-green-400" /><span className="text-xs text-green-400">Activo</span></>
                          : <><ToggleLeft size={18} className="text-zinc-600" /><span className="text-xs text-zinc-600">Inactivo</span></>}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/products/${product.id}`}
                        className="text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-3 py-1.5 rounded-lg transition">
                        Editar todo
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
