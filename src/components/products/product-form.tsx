'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2, Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Props {
  categories: { id: string; name: string }[]
  product?: any
}

type VariantRow = {
  label: string
  value: string
  price: string
}

const DEFAULT_SIZE_VARIANTS: VariantRow[] = [
  { label: 'XS', value: 'XS', price: '' },
  { label: 'S', value: 'S', price: '' },
  { label: 'M', value: 'M', price: '' },
  { label: 'L', value: 'L', price: '' },
  { label: 'XL', value: 'XL', price: '' },
  { label: 'XXL', value: 'XXL', price: '' },
]

const DEFAULT_COFFEE_VARIANTS: VariantRow[] = [
  { label: 'Chico', value: 'Chico', price: '' },
  { label: 'Mediano', value: 'Mediano', price: '' },
  { label: 'Grande', value: 'Grande', price: '' },
]

function normalizeVariants(product: any): VariantRow[] {
  const raw = product?.variants

  if (!Array.isArray(raw)) return []

  return raw.map((item: any) => ({
    label: String(item?.label ?? ''),
    value: String(item?.value ?? item?.label ?? ''),
    price:
      typeof item?.price === 'number'
        ? String(item.price)
        : item?.price
          ? String(item.price)
          : '',
  }))
}

export default function ProductForm({ categories, product }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const isEdit = !!product

  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [price, setPrice] = useState(product?.price?.toString() ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [barcode, setBarcode] = useState((product as any)?.barcode ?? '')
  const [categoryId, setCategoryId] = useState(product?.category_id ?? '')
  const [stock, setStock] = useState(product?.stock?.toString() ?? '0')
  const [lowStock, setLowStock] = useState(product?.low_stock_alert?.toString() ?? '5')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setPreview] = useState<string>(product?.image_url ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [hasVariants, setHasVariants] = useState(Boolean(product?.has_variants))
  const [variantType, setVariantType] = useState<string>(product?.variant_type ?? 'tamaño')
  const [variants, setVariants] = useState<VariantRow[]>(() => {
    const normalized = normalizeVariants(product)
    return normalized.length > 0 ? normalized : DEFAULT_COFFEE_VARIANTS
  })

  const parsedPrice = useMemo(() => Number(price || 0), [price])

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setImageFile(file)
    setPreview(URL.createObjectURL(file))
  }

  function loadPreset(type: string) {
    setVariantType(type)

    if (type === 'talla') {
      setVariants(DEFAULT_SIZE_VARIANTS.map((v) => ({ ...v, price })))
      return
    }

    if (type === 'tamaño') {
      setVariants(DEFAULT_COFFEE_VARIANTS.map((v, index) => ({
        ...v,
        price: String(parsedPrice + index * 500),
      })))
      return
    }

    setVariants([{ label: '', value: '', price }])
  }

  function updateVariant(index: number, field: keyof VariantRow, value: string) {
    setVariants((current) =>
      current.map((variant, i) => {
        if (i !== index) return variant

        const updated = { ...variant, [field]: value }

        if (field === 'label') {
          updated.value = value
        }

        return updated
      })
    )
  }

  function addVariant() {
    setVariants((current) => [
      ...current,
      {
        label: '',
        value: '',
        price,
      },
    ])
  }

  function removeVariant(index: number) {
    setVariants((current) => current.filter((_, i) => i !== index))
  }

  function buildVariantsPayload() {
    if (!hasVariants) {
      return {
        has_variants: false,
        variant_type: null,
        variants: null,
      }
    }

    const cleanVariants = variants
      .map((variant) => ({
        label: variant.label.trim(),
        value: (variant.value || variant.label).trim(),
        price: Number(variant.price || 0),
      }))
      .filter((variant) => variant.label && variant.value && variant.price >= 0)

    return {
      has_variants: cleanVariants.length > 0,
      variant_type: cleanVariants.length > 0 ? variantType : null,
      variants: cleanVariants.length > 0 ? cleanVariants : null,
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      setError('El nombre es obligatorio')
      return
    }

    if (!price || isNaN(parseFloat(price))) {
      setError('El precio es obligatorio')
      return
    }

    setLoading(true)
    setError('')

    const supabase = createClient()

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      setError('Sesión expirada')
      setLoading(false)
      return
    }

    let image_url: string | null = product?.image_url ?? null

    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const filename = `${Date.now()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('product-images')
        .upload(filename, imageFile, { upsert: true })

      if (uploadErr) {
        setError(`Error al subir imagen: ${uploadErr.message}`)
        setLoading(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filename)

      image_url = urlData.publicUrl
    }

    const variantPayload = buildVariantsPayload()

    const payload: any = {
      name: name.trim(),
      description: description.trim() || null,
      price: parseFloat(price),
      sku: sku.trim() || null,
      barcode: barcode.trim() || null,
      category_id: categoryId || null,
      created_by: session.user.id,
      ...variantPayload,
      ...(image_url ? { image_url } : {}),
    }

    if (isEdit) {
      const { error: pErr } = await supabase
        .from('products')
        .update(payload)
        .eq('id', product.id)

      if (pErr) {
        setError(pErr.message)
        setLoading(false)
        return
      }

      await supabase
        .from('inventory')
        .update({
          low_stock_alert: parseInt(lowStock) || 5,
          updated_by: session.user.id,
        })
        .eq('product_id', product.id)

      toast.success('Producto actualizado')
    } else {
      const { data: newProduct, error: pErr } = await supabase
        .from('products')
        .insert(payload)
        .select()
        .single()

      if (pErr) {
        setError(pErr.message)
        setLoading(false)
        return
      }

      const stockNum = parseInt(stock) || 0

      await supabase.from('inventory').insert({
        product_id: newProduct.id,
        stock: stockNum,
        low_stock_alert: parseInt(lowStock) || 5,
        updated_by: session.user.id,
      })

      if (stockNum > 0) {
        await supabase.from('inventory_movements').insert({
          product_id: newProduct.id,
          type: 'entrada',
          quantity: stockNum,
          notes: 'Stock inicial',
          created_by: session.user.id,
        })
      }

      toast.success('Producto creado')
    }

    router.push('/products')
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-5">
      <div>
        <label className="mb-1.5 block text-xs text-zinc-500">
          Imagen del producto
        </label>

        <div
          onClick={() => fileRef.current?.click()}
          className="relative flex h-36 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-800/30 transition hover:border-amber-500/50"
        >
          {imagePreview ? (
            <>
              <img src={imagePreview} alt="preview" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setPreview('')
                  setImageFile(null)
                }}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900/80 text-zinc-400 hover:text-white"
              >
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

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImage}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs text-zinc-500">
          Nombre <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del producto"
          required
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-600 transition focus:border-amber-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs text-zinc-500">Descripción</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción opcional del producto..."
          rows={3}
          className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-600 transition focus:border-amber-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs text-zinc-500">
          Código de barra (EAN/UPC)
        </label>
        <input
          type="text"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="Ej: 7802820000123"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-600 transition focus:border-amber-500 focus:outline-none"
        />
        <p className="mt-1 text-[10px] text-zinc-600">
          Código de barra del fabricante para escaneo con lector físico
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs text-zinc-500">
            Precio base (CLP) <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="9990"
            required
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-600 transition focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs text-zinc-500">SKU</label>
          <input
            type="text"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="ARM-001"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-600 transition focus:border-amber-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs text-zinc-500">Categoría</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-300 transition focus:border-amber-500 focus:outline-none"
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-zinc-700/70 bg-zinc-900/60 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white">Variantes del producto</h3>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Úsalo para café por tamaño, tallas de ropa o cualquier opción con precio propio.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setHasVariants((value) => !value)}
            className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
              hasVariants
                ? 'bg-green-500/15 text-green-300'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            {hasVariants ? 'Activado' : 'Desactivado'}
          </button>
        </div>

        {hasVariants && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs text-zinc-500">
                Tipo de variante
              </label>
              <select
                value={variantType}
                onChange={(e) => loadPreset(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-300 transition focus:border-amber-500 focus:outline-none"
              >
                <option value="tamaño">Tamaño</option>
                <option value="talla">Talla</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>

            <div className="space-y-2">
              {variants.map((variant, index) => (
                <div key={index} className="grid grid-cols-[1fr_120px_36px] gap-2">
                  <input
                    value={variant.label}
                    onChange={(e) => updateVariant(index, 'label', e.target.value)}
                    placeholder="Ej: Grande"
                    className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 transition focus:border-amber-500 focus:outline-none"
                  />

                  <input
                    type="number"
                    min="0"
                    value={variant.price}
                    onChange={(e) => updateVariant(index, 'price', e.target.value)}
                    placeholder="Precio"
                    className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 transition focus:border-amber-500 focus:outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => removeVariant(index)}
                    className="flex items-center justify-center rounded-xl bg-red-500/10 text-red-300 transition hover:bg-red-500/20"
                    aria-label="Eliminar variante"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addVariant}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              <Plus size={14} />
              Agregar variante
            </button>
          </div>
        )}
      </div>

      {!isEdit && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs text-zinc-500">Stock inicial</label>
            <input
              type="number"
              min="0"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-600 transition focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-zinc-500">
              Alerta stock bajo
            </label>
            <input
              type="number"
              min="0"
              value={lowStock}
              onChange={(e) => setLowStock(e.target.value)}
              placeholder="5"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-600 transition focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700"
        >
          Cancelar
        </button>

        <button
          type="submit"
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-40"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear producto'}
        </button>
      </div>
    </form>
  )
}
