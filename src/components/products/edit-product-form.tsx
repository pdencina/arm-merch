'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ConfirmActionModal from '@/components/ui/confirm-action-modal'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

type Category = {
  id: string
  name: string
}

type VariantRow = {
  label: string
  value: string
  price: string
}

interface Props {
  product: {
    id: string
    name: string
    description?: string | null
    price: number
    sku?: string | null
    category_id?: string | null
    image_url?: string | null
    active: boolean
    has_variants?: boolean | null
    variant_type?: string | null
    variants?: any[] | null
  }
  categories: Category[]
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

function normalizeVariants(product: Props['product']): VariantRow[] {
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

export default function EditProductForm({ product, categories }: Props) {
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [name, setName] = useState(product.name ?? '')
  const [price, setPrice] = useState(Number(product.price ?? 0))
  const [sku, setSku] = useState(product.sku ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(product.category_id ?? null)
  const [description, setDescription] = useState(product.description ?? '')
  const [active, setActive] = useState(Boolean(product.active))
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(product.image_url ?? null)

  const [hasVariants, setHasVariants] = useState(Boolean(product.has_variants))
  const [variantType, setVariantType] = useState<string>(product.variant_type ?? 'tamaño')
  const [variants, setVariants] = useState<VariantRow[]>(() => {
    const normalized = normalizeVariants(product)
    return normalized.length > 0 ? normalized : DEFAULT_COFFEE_VARIANTS
  })

  const fieldClassName =
    'w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black placeholder-zinc-500 focus:outline-none focus:border-amber-500'

  const darkFieldClassName =
    'w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500'

  const imagePreviewUrl = useMemo(() => {
    if (!imageFile) return ''
    return URL.createObjectURL(imageFile)
  }, [imageFile])

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    }
  }, [imagePreviewUrl])

  function loadPreset(type: string) {
    setVariantType(type)

    if (type === 'talla') {
      setVariants(DEFAULT_SIZE_VARIANTS.map((item) => ({
        ...item,
        price: String(price || 0),
      })))
      return
    }

    if (type === 'tamaño') {
      setVariants(DEFAULT_COFFEE_VARIANTS.map((item, index) => ({
        ...item,
        price: String(Number(price || 0) + index * 500),
      })))
      return
    }

    setVariants([{ label: '', value: '', price: String(price || 0) }])
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
        price: String(price || 0),
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

  async function uploadImage(): Promise<string | null> {
    if (!imageFile) return currentImageUrl

    setUploadingImage(true)

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        setUploadingImage(false)
        throw new Error('No autenticado')
      }

      const formData = new FormData()
      formData.append('file', imageFile)

      const res = await fetch('/api/products/upload-image', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      const data = await res.json()
      setUploadingImage(false)

      if (!res.ok) {
        throw new Error(data.error ?? 'No se pudo subir la imagen')
      }

      return data.imageUrl as string
    } catch (error: any) {
      setUploadingImage(false)
      throw new Error(error?.message ?? 'Error inesperado al subir la imagen')
    }
  }

  async function handleSaveConfirmed() {
    setConfirmOpen(false)

    if (!name.trim()) {
      toast.error('El nombre es obligatorio')
      return
    }

    if (Number(price) < 0) {
      toast.error('El precio no puede ser negativo')
      return
    }

    setLoading(true)

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        toast.error('No autenticado')
        setLoading(false)
        return
      }

      let imageUrl = currentImageUrl

      if (imageFile) {
        imageUrl = await uploadImage()
      }

      const variantPayload = buildVariantsPayload()

      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          price: Number(price),
          sku: sku.trim() || null,
          category_id: categoryId || null,
          image_url: imageUrl || null,
          active,
          ...variantPayload,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo actualizar el producto')
        setLoading(false)
        return
      }

      toast.success('Producto actualizado correctamente')
      window.location.reload()
    } catch (error: any) {
      toast.error(error?.message ?? 'Error inesperado al actualizar el producto')
    }

    setLoading(false)
  }

  return (
    <>
      <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-white">Editar producto</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Actualiza los datos generales, variantes y precios por tamaño.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-400">Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del producto"
              className={fieldClassName}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-400">Precio base</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              placeholder="0"
              className={fieldClassName}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-400">SKU</label>
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="SKU"
              className={fieldClassName}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-400">Categoría</label>
            <select
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(e.target.value || null)}
              className={fieldClassName}
            >
              <option value="">Selecciona una categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-xs font-medium text-zinc-400">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del producto"
              rows={3}
              className={fieldClassName}
            />
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <label className="text-xs font-medium text-zinc-400">Imagen</label>

            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                setImageFile(file)
              }}
              className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-zinc-700"
            />

            <div className="flex flex-wrap gap-4 pt-2">
              {currentImageUrl && !imageFile && (
                <div>
                  <p className="mb-2 text-xs text-zinc-500">Imagen actual</p>
                  <img
                    src={currentImageUrl}
                    alt="Imagen actual"
                    className="h-24 w-24 rounded-xl border border-zinc-700 object-cover"
                  />
                </div>
              )}

              {imagePreviewUrl && (
                <div>
                  <p className="mb-2 text-xs text-zinc-500">Nueva imagen</p>
                  <img
                    src={imagePreviewUrl}
                    alt="Vista previa"
                    className="h-24 w-24 rounded-xl border border-zinc-700 object-cover"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <input
              id="active-product"
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="active-product" className="text-sm text-white">
              Producto activo
            </label>
          </div>

          <div className="md:col-span-2 rounded-2xl border border-zinc-700/70 bg-zinc-950/50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Variantes y precios por tamaño
                </h3>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Activa esto para café chico, mediano y grande, tallas de ropa u otras variantes con precio propio.
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
                    className={darkFieldClassName}
                  >
                    <option value="tamaño">Tamaño</option>
                    <option value="talla">Talla</option>
                    <option value="personalizado">Personalizado</option>
                  </select>
                </div>

                <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-3">
                  <p className="text-xs font-bold text-amber-300">
                    Ejemplo café:
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Chico $2.000 · Mediano $2.500 · Grande $3.000
                  </p>
                </div>

                <div className="space-y-2">
                  {variants.map((variant, index) => (
                    <div key={index} className="grid grid-cols-[1fr_130px_38px] gap-2">
                      <input
                        value={variant.label}
                        onChange={(e) => updateVariant(index, 'label', e.target.value)}
                        placeholder="Ej: Grande"
                        className={darkFieldClassName}
                      />

                      <input
                        type="number"
                        min="0"
                        value={variant.price}
                        onChange={(e) => updateVariant(index, 'price', e.target.value)}
                        placeholder="Precio"
                        className={darkFieldClassName}
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
        </div>

        <div className="pt-5">
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={loading || uploadingImage}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {uploadingImage
              ? 'Subiendo imagen...'
              : loading
                ? 'Guardando cambios...'
                : 'Guardar cambios'}
          </button>
        </div>
      </div>

      <ConfirmActionModal
        open={confirmOpen}
        title="¿Guardar cambios del producto?"
        description="Se actualizarán los datos generales del producto, incluyendo variantes y precios por tamaño."
        confirmText="Sí, guardar cambios"
        cancelText="Revisar otra vez"
        loading={loading || uploadingImage}
        tone="warning"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleSaveConfirmed}
      />
    </>
  )
}
