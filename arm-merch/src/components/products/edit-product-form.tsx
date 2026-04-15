'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Category = {
  id: string
  name: string
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
  }
  categories: Category[]
}

export default function EditProductForm({ product, categories }: Props) {
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  const [name, setName] = useState(product.name ?? '')
  const [price, setPrice] = useState(Number(product.price ?? 0))
  const [sku, setSku] = useState(product.sku ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(product.category_id ?? null)
  const [description, setDescription] = useState(product.description ?? '')
  const [active, setActive] = useState(Boolean(product.active))
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(product.image_url ?? null)

  const fieldClassName =
    'w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black placeholder-zinc-500 focus:outline-none focus:border-amber-500'

  const imagePreviewUrl = useMemo(() => {
    if (!imageFile) return ''
    return URL.createObjectURL(imageFile)
  }, [imageFile])

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    }
  }, [imagePreviewUrl])

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

  async function handleSave() {
    if (!name.trim()) {
      alert('El nombre es obligatorio')
      return
    }

    if (Number(price) < 0) {
      alert('El precio no puede ser negativo')
      return
    }

    setLoading(true)

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        alert('No autenticado')
        setLoading(false)
        return
      }

      let imageUrl = currentImageUrl

      if (imageFile) {
        imageUrl = await uploadImage()
      }

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
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error ?? 'No se pudo actualizar el producto')
        setLoading(false)
        return
      }

      alert('Producto actualizado correctamente')
      window.location.reload()
    } catch (error: any) {
      alert(error?.message ?? 'Error inesperado al actualizar el producto')
    }

    setLoading(false)
  }

  return (
    <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-white">Editar producto</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Actualiza los datos generales del producto.
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
          <label className="text-xs font-medium text-zinc-400">Precio</label>
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
      </div>

      <div className="pt-5">
        <button
          onClick={handleSave}
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
  )
}