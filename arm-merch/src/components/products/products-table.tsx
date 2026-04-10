'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Edit2, Check, X, ToggleLeft, ToggleRight, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(n)

interface Props {
  products: any[]
  categories: { id: string; name: string }[]
  userRole?: string
}

export default function ProductsTable({ products: initialProducts, categories, userRole }: Props) {
  const router   = useRouter()
  const [products, setProducts] = useState(initialProducts)
  const [search, setSearch]     = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [editPriceId, setEditPriceId] = useState<string | null>(null)
  const [editPriceVal, setEditPriceVal] = useState('')

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
    const matchCat    = !catFilter || p.category_id === catFilter
    return matchSearch && matchCat
  })

  async function savePrice(productId: string) {
    const val = parseFloat(editPriceVal)
    if (!val || val <= 0) { toast.error('Precio inválido'); return }
    const { error } = await createClient().from('products').update({ price: val }).eq('id', productId)
    if (error) { toast.error(error.message); return }
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, price: val } : p))
    setEditPriceId(null)
    toast.success(`Precio actualizado a ${fmt(val)}`)
  }

  async function toggleActive(productId: string, active: boolean) {
    const { error } = await createClient().from('products').update({ active }).eq('id', productId)
    if (error) { toast.error(error.message); return }
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, active } : p))
    toast.success(active ? 'Producto activado' : 'Producto desactivado')
  }

  return (
    <div className="flex flex-col gap-4">
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
      <div className="bg-zinc-800/30 rounded-xl border border-zinc-700/40 overflow-hidden">
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
                        <div className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center shrink-0">
                          <Package size={14} className="text-zinc-500" />
                        </div>
                      )}
                      <span className="text-sm text-zinc-200 font-medium">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs bg-zinc-700/60 text-zinc-400 px-2 py-1 rounded-lg">
                      {categories.find(c => c.id === product.category_id)?.name ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-zinc-600 font-mono">{product.sku ?? '—'}</span>
                  </td>

                  {/* Precio editable inline — solo super_admin */}
                  <td className="px-4 py-3">
                    {editPriceId === product.id && userRole === 'super_admin' ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-zinc-500">$</span>
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          value={editPriceVal}
                          onChange={e => setEditPriceVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') savePrice(product.id); if (e.key === 'Escape') setEditPriceId(null) }}
                          className="w-24 bg-zinc-700 border border-amber-500/50 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-500"
                        />
                        <button onClick={() => savePrice(product.id)} className="text-green-400 hover:text-green-300 transition"><Check size={13} /></button>
                        <button onClick={() => setEditPriceId(null)} className="text-zinc-500 hover:text-zinc-300 transition"><X size={13} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 group">
                        <span className="text-sm font-bold text-amber-400">{fmt(product.price)}</span>
                        {userRole === 'super_admin' && (
                        <button
                          onClick={() => { setEditPriceId(product.id); setEditPriceVal(product.price?.toString() ?? '') }}
                          className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-amber-400 transition">
                          <Edit2 size={11} />
                        </button>
                      )}
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                      product.stock === 0   ? 'bg-red-500/10 text-red-400' :
                      product.stock <= 5    ? 'bg-orange-500/10 text-orange-400' :
                                              'bg-green-500/10 text-green-400'
                    }`}>{product.stock ?? 0}</span>
                  </td>

                  <td className="px-4 py-3 hidden sm:table-cell">
                    <button onClick={() => toggleActive(product.id, !product.active)}
                      className="flex items-center gap-1.5 transition">
                      {product.active !== false ? (
                        <><ToggleRight size={18} className="text-green-400" /><span className="text-xs text-green-400">Activo</span></>
                      ) : (
                        <><ToggleLeft size={18} className="text-zinc-600" /><span className="text-xs text-zinc-600">Inactivo</span></>
                      )}
                    </button>
                  </td>

                  <td className="px-4 py-3">
                    <Link href={`/products/${product.id}`}
                      className="text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-3 py-1.5 rounded-lg transition">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
