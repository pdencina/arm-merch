'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Props {
  categories: { id: string; name: string }[]
  product?: any
}

export default function ProductForm({ categories, product }: Props) {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const isEdit  = !!product

  const [name, setName]               = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [price, setPrice]             = useState(product?.price?.toString() ?? '')
  const [sku, setSku]                 = useState(product?.sku ?? '')
  const [categoryId, setCategoryId]   = useState(product?.category_id ?? '')
  const [stock, setStock]             = useState(product?.stock?.toString() ?? '0')
  const [lowStock, setLowStock]       = useState(product?.low_stock_alert?.toString() ?? '5')
  const [imageFile, setImageFile]     = useState<File | null>(null)
  const [imagePreview, setPreview]    = useState<string>(product?.image_url ?? '')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    if (!price || isNaN(parseFloat(price))) { setError('El precio es obligatorio'); return }

    setLoading(true); setError('')
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Sesión expirada'); setLoading(false); return }

    // Subir imagen si hay
    let image_url: string | null = product?.image_url ?? null
    if (imageFile) {
      const ext      = imageFile.name.split('.').pop()
      const filename = `${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('product-images').upload(filename, imageFile, { upsert: true })
      if (uploadErr) { setError(`Error al subir imagen: ${uploadErr.message}`); setLoading(false); return }
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(filename)
      image_url = urlData.publicUrl
    }

    const payload: any = {
      name:        name.trim(),
      description: description.trim() || null,
      price:       parseFloat(price),
      sku:         sku.trim() || null,
      category_id: categoryId || null,
      created_by:  session.user.id,
      ...(image_url ? { image_url } : {}),
    }

    if (isEdit) {
      const { error: pErr } = await supabase.from('products').update(payload).eq('id', product.id)
      if (pErr) { setError(pErr.message); setLoading(false); return }
      await supabase.from('inventory').update({ low_stock_alert: parseInt(lowStock) || 5, updated_by: session.user.id }).eq('product_id', product.id)
      toast.success('Producto actualizado')
    } else {
      const { data: newProduct, error: pErr } = await supabase.from('products').insert(payload).select().single()
      if (pErr) { setError(pErr.message); setLoading(false); return }
      const stockNum = parseInt(stock) || 0
      await supabase.from('inventory').insert({ product_id: newProduct.id, stock: stockNum, low_stock_alert: parseInt(lowStock) || 5, updated_by: session.user.id })
      if (stockNum > 0) {
        await supabase.from('inventory_movements').insert({ product_id: newProduct.id, type: 'entrada', quantity: stockNum, notes: 'Stock inicial', created_by: session.user.id })
      }
      toast.success('Producto creado')
    }

    router.push('/products')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-xl">

      {/* Imagen */}
      <div>
        <label className="block text-xs text-zinc-500 mb-1.5">Imagen del producto</label>
        <div onClick={() => fileRef.current?.click()}
          className="w-full h-36 rounded-xl border-2 border-dashed border-zinc-700 hover:border-amber-500/50
                     flex items-center justify-center cursor-pointer transition overflow-hidden bg-zinc-800/30 relative">
          {imagePreview ? (
            <>
              <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
              <button type="button" onClick={e => { e.stopPropagation(); setPreview(''); setImageFile(null) }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-zinc-900/80 flex items-center justify-center text-zinc-400 hover:text-white">
                <X size={14} />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-600">
              <Upload size={22} />
              <span className="text-xs">Click para subir imagen</span>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
      </div>

      {/* Nombre */}
      <div>
        <label className="block text-xs text-zinc-500 mb-1.5">Nombre <span className="text-red-400">*</span></label>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Nombre del producto" required
          className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition" />
      </div>

      {/* Descripción */}
      <div>
        <label className="block text-xs text-zinc-500 mb-1.5">Descripción</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Descripción opcional del producto..."
          rows={3}
          className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition resize-none"
        />
      </div>

      {/* Precio y SKU */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">Precio (CLP) <span className="text-red-400">*</span></label>
          <input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)}
            placeholder="9990" required
            className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">SKU</label>
          <input type="text" value={sku} onChange={e => setSku(e.target.value)}
            placeholder="ARM-001"
            className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition" />
        </div>
      </div>

      {/* Categoría */}
      <div>
        <label className="block text-xs text-zinc-500 mb-1.5">Categoría</label>
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition">
          <option value="">Sin categoría</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Stock (solo en nuevo producto) */}
      {!isEdit && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Stock inicial</label>
            <input type="number" min="0" value={stock} onChange={e => setStock(e.target.value)}
              placeholder="0"
              className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Alerta stock bajo</label>
            <input type="number" min="0" value={lowStock} onChange={e => setLowStock(e.target.value)}
              placeholder="5"
              className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition" />
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-xs bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => router.back()}
          className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl py-2.5 text-sm transition">
          Cancelar
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 font-bold rounded-xl py-2.5 text-sm transition flex items-center justify-center gap-2">
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear producto'}
        </button>
      </div>
    </form>
  )
}
