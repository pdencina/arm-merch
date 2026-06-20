'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NotifyModal, useNotify } from '@/components/ui/notify-modal'
import { Barcode, CheckCircle2, ScanLine, XCircle } from 'lucide-react'

type Category = {
  id: string
  name: string
}

type Campus = {
  id: string
  name: string
}

type UserProfile = {
  role: 'super_admin' | 'admin' | 'voluntario'
  campus_id: string | null
  campus?: { name?: string }[] | { name?: string } | null
}

function normalizeBarcode(value: string) {
  return String(value ?? '').replace(/\D/g, '').trim()
}

function normalizeSku(value: string) {
  return String(value ?? '').trim().toUpperCase()
}

function numberInputValue(value: number | string | null | undefined) {
  if (value === null || value === undefined) return ''
  const n = Number(value)
  if (isNaN(n)) return ''
  return n === 0 ? '' : String(n)
}

function getBarcodeType(value: string) {
  const clean = normalizeBarcode(value)

  if (/^\d{13}$/.test(clean)) return 'EAN13 / comercial'
  if (/^\d{8,14}$/.test(clean)) return 'Código numérico'
  if (value.trim()) return 'Código interno'
  return ''
}

export default function ProductForm() {
  const supabase = createClient()
  const { notify, success, error: notifyError, close } = useNotify()

  const barcodeInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [uploadingImage, setUploadingImage] = useState(false)

  const [categories, setCategories] = useState<Category[]>([])
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)

  const [name, setName] = useState('')
  const [price, setPrice] = useState(0)
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)

  const [capturingBarcode, setCapturingBarcode] = useState(false)
  const [barcodeStatus, setBarcodeStatus] = useState<{
    type: 'ok' | 'error' | 'info'
    message: string
  } | null>(null)

  const [campusStocks, setCampusStocks] = useState<
    {
      campus_id: string
      enabled: boolean
      stock: number
      low_stock_alert: number
    }[]
  >([])

  const fieldClassName =
    'w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black placeholder-zinc-500 focus:outline-none focus:border-amber-500'

  const imagePreviewUrl = useMemo(() => {
    if (!imageFile) return ''
    return URL.createObjectURL(imageFile)
  }, [imageFile])

  const barcodeType = useMemo(() => getBarcodeType(barcode), [barcode])

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    }
  }, [imagePreviewUrl])

  useEffect(() => {
    async function loadFormData() {
      setLoadingData(true)

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        notifyError('Sin sesión', 'Recarga la página e intenta de nuevo')
        setLoadingData(false)
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role, campus_id')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profileData) {
        notifyError('Error', profileError?.message ?? 'No se pudo cargar el perfil')
        setLoadingData(false)
        return
      }

      setProfile(profileData as UserProfile)

      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id, name')
        .eq('active', true)
        .order('name')

      if (categoryError) {
        notifyError('Error', categoryError.message)
      }

      const safeCategories = (categoryData ?? []) as Category[]
      setCategories(safeCategories)

      let campusQuery = supabase
        .from('campus')
        .select('id, name')
        .eq('active', true)
        .order('name')

      if ((profileData as UserProfile).role === 'admin' && (profileData as UserProfile).campus_id) {
        campusQuery = campusQuery.eq('id', (profileData as UserProfile).campus_id)
      }

      const { data: campusData, error: campusError } = await campusQuery

      if (campusError) {
        notifyError('Error', campusError.message)
      }

      const safeCampuses = (campusData ?? []) as Campus[]
      setCampuses(safeCampuses)

      setCampusStocks(
        safeCampuses.map((c) => ({
          campus_id: c.id,
          enabled:
            (profileData as UserProfile).role === 'admin' &&
            (profileData as UserProfile).campus_id === c.id,
          stock: 0,
          low_stock_alert: 5,
        }))
      )

      setLoadingData(false)
    }

    loadFormData()
  }, [supabase])

  function startBarcodeCapture() {
    setCapturingBarcode(true)
    setBarcodeStatus({
      type: 'info',
      message: 'Esperando scanner USB. Escanea el código del producto.',
    })

    setTimeout(() => {
      barcodeInputRef.current?.focus()
      barcodeInputRef.current?.select()
    }, 50)
  }

  function handleBarcodeChange(value: string) {
    const next = value.trim()
    setBarcode(next)

    if (!next) {
      setBarcodeStatus(null)
      return
    }

    const clean = normalizeBarcode(next)

    if (/^\d{13}$/.test(clean)) {
      setBarcodeStatus({
        type: 'ok',
        message: 'Código EAN13 detectado. Ideal para productos comerciales.',
      })
      return
    }

    if (/^\d{8,14}$/.test(clean)) {
      setBarcodeStatus({
        type: 'ok',
        message: 'Código numérico detectado.',
      })
      return
    }

    setBarcodeStatus({
      type: 'info',
      message: 'Código alfanumérico detectado. Útil como código interno.',
    })
  }

  async function validateBarcodeBeforeSubmit() {
    const normalized = barcode.trim()

    if (!normalized) return true

    const { data: existingBarcode, error: barcodeError } = await supabase
      .from('products')
      .select('id, name')
      .eq('barcode', normalized)
      .maybeSingle()

    if (barcodeError) {
      notifyError('Error validando código', barcodeError.message)
      return false
    }

    if (existingBarcode) {
      notifyError(
        'Código ya registrado',
        `Este código pertenece a: ${existingBarcode.name}`
      )
      return false
    }

    return true
  }

  async function uploadImage(): Promise<string | null> {
    if (!imageFile) return null

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

  async function handleSubmit() {
    if (!name.trim()) {
      notifyError('Campo requerido', 'El nombre del producto es obligatorio')
      return
    }

    if (Number(price) < 0) {
      notifyError('Precio inválido', 'El precio no puede ser negativo')
      return
    }

    const selectedCampuses = campusStocks
      .filter((c) => c.enabled)
      .map((c) => ({
        campus_id: c.campus_id,
        stock: Number(c.stock),
        low_stock_alert: Number(c.low_stock_alert),
      }))

    if (selectedCampuses.length === 0) {
      notifyError('Campus requerido', 'Debes seleccionar al menos un campus')
      return
    }

    const barcodeIsValid = await validateBarcodeBeforeSubmit()

    if (!barcodeIsValid) return

    setLoading(true)

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        notifyError('Sin sesión', 'Recarga la página e intenta de nuevo')
        setLoading(false)
        return
      }

      let imageUrl: string | null = null

      if (imageFile) {
        imageUrl = await uploadImage()
      }

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          product: {
            name: name.trim(),
            description: description.trim() || null,
            price: Number(price),
            sku: normalizeSku(sku) || null,
            barcode: barcode.trim() || null,
            category_id: categoryId || null,
            image_url: imageUrl,
            active: true,
          },
          campusStocks: selectedCampuses,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        notifyError('Error al guardar', data.error ?? 'No se pudo crear el producto')
        setLoading(false)
        return
      }

      success('Producto creado', 'El producto fue agregado correctamente', '✅')
      window.location.href = '/products'
    } catch (err: any) {
      notifyError('Error inesperado', err?.message ?? 'Error al crear el producto')
    }

    setLoading(false)
  }

  if (loadingData) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  const isSuperAdmin = profile?.role === 'super_admin'
  const isAdmin = profile?.role === 'admin'

  return (
    <div className="space-y-6">
      <NotifyModal notify={notify} onClose={close} />

      <div>
        <h2 className="text-xl font-bold text-white">Nuevo Producto</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Crea un producto y define en qué campus estará disponible.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
        <div className="flex items-start gap-3">
          <Barcode className="mt-0.5 text-amber-400" size={18} />
          <div>
            <p className="text-sm font-semibold text-amber-300">
              Productos comerciales y productos ARM
            </p>
            <p className="mt-1 text-xs leading-5 text-amber-100/80">
              Para productos comerciales como aguas, bebidas, jugos o snacks, escanea el código real del envase.
              Para productos ARM sin código propio, puedes dejar el barcode vacío y generar etiquetas internas después.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-400">
            Nombre del producto
          </label>
          <input
            placeholder="Ej: Agua con gas 500ml"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClassName}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-400">Precio</label>
          <input
            type="number"
            placeholder="0"
            value={numberInputValue(price)}
            onChange={(e) => setPrice(e.target.value === '' ? 0 : Number(e.target.value))}
            className={fieldClassName}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-400">SKU</label>
          <input
            placeholder="Ej: BEB-AGUA-CG-500"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            onBlur={() => setSku(normalizeSku(sku))}
            className={fieldClassName}
          />
          <p className="text-[11px] text-zinc-500">
            Código interno de ARM Merch para ordenar productos y reportes.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-medium text-zinc-400">
              Código de barras
            </label>

            {barcodeType && (
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                {barcodeType}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <input
              ref={barcodeInputRef}
              placeholder="Escanea o escribe el código del envase"
              value={barcode}
              onChange={(e) => handleBarcodeChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const clean = (e.target as HTMLInputElement).value.trim()
                  handleBarcodeChange(clean)
                  setCapturingBarcode(false)
                  barcodeInputRef.current?.blur()
                }
              }}
              className={fieldClassName}
            />

            <button
              type="button"
              onClick={startBarcodeCapture}
              className={`inline-flex min-w-[128px] items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                capturingBarcode
                  ? 'bg-green-500 text-black'
                  : 'bg-zinc-800 text-white hover:bg-zinc-700'
              }`}
            >
              {capturingBarcode ? (
                <>
                  <ScanLine size={15} />
                  Escanea
                </>
              ) : (
                <>
                  <Barcode size={15} />
                  Capturar
                </>
              )}
            </button>
          </div>

          {barcodeStatus && (
            <div
              className={`mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${
                barcodeStatus.type === 'ok'
                  ? 'border border-green-500/20 bg-green-500/10 text-green-300'
                  : barcodeStatus.type === 'error'
                    ? 'border border-red-500/20 bg-red-500/10 text-red-300'
                    : 'border border-blue-500/20 bg-blue-500/10 text-blue-300'
              }`}
            >
              {barcodeStatus.type === 'ok' ? (
                <CheckCircle2 size={14} />
              ) : barcodeStatus.type === 'error' ? (
                <XCircle size={14} />
              ) : (
                <ScanLine size={14} />
              )}
              {barcodeStatus.message}
            </div>
          )}

          <p className="text-[11px] text-zinc-500">
            Para productos comerciales, usa el código real del envase. Ej: 7798346408279.
          </p>
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
          <label className="text-xs font-medium text-zinc-400">
            Descripción
          </label>
          <textarea
            placeholder="Describe brevemente este producto"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={fieldClassName}
          />
        </div>

        <div className="flex flex-col gap-2 md:col-span-2">
          <label className="text-xs font-medium text-zinc-400">
            Imagen del producto
          </label>

          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null
              setImageFile(file)
            }}
            className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-zinc-700"
          />

          <p className="text-[11px] text-zinc-500">
            Formatos permitidos: JPG, PNG o WEBP. Máximo 5 MB.
          </p>

          {imagePreviewUrl && (
            <div className="mt-2">
              <img
                src={imagePreviewUrl}
                alt="Vista previa"
                className="h-28 w-28 rounded-xl border border-zinc-700 object-cover"
              />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Stock por campus</h3>
          <p className="mt-1 text-sm text-zinc-500">
            {isSuperAdmin
              ? 'Activa solo los campus donde este producto estará disponible.'
              : 'Como admin, este producto se creará solo para tu campus.'}
          </p>
        </div>

        <div className="space-y-4">
          {campusStocks.map((item, index) => {
            const campus = campuses.find((c) => c.id === item.campus_id)

            return (
              <div
                key={item.campus_id}
                className="space-y-4 rounded-2xl border border-zinc-700 bg-zinc-900/40 p-4"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    disabled={isAdmin}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setCampusStocks((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, enabled: checked } : row
                        )
                      )
                    }}
                    className="mt-1 h-4 w-4"
                  />

                  <div>
                    <label className="text-base font-medium text-white">
                      {campus?.name}
                    </label>
                    <p className="mt-1 text-xs text-zinc-500">
                      Marca este campus si quieres crear inventario inicial para esta sede.
                    </p>
                  </div>
                </div>

                {item.enabled && (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-zinc-400">
                        Stock inicial
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={numberInputValue(item.stock)}
                        onChange={(e) => {
                          const raw = e.target.value
                          const val = raw === '' ? 0 : Math.max(0, Math.round(Number(raw) || 0))
                          setCampusStocks((prev) =>
                            prev.map((row, i) =>
                              i === index ? { ...row, stock: val } : row
                            )
                          )
                        }}
                        className={fieldClassName}
                      />
                      <p className="text-[11px] text-zinc-500">
                        Cantidad con la que comenzará este campus.
                      </p>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-zinc-400">
                        Alerta stock bajo
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="5"
                        value={numberInputValue(item.low_stock_alert)}
                        onChange={(e) => {
                          const raw = e.target.value
                          const val = raw === '' ? 0 : Math.max(0, Math.round(Number(raw) || 0))
                          setCampusStocks((prev) =>
                            prev.map((row, i) =>
                              i === index
                                ? { ...row, low_stock_alert: val }
                                : row
                            )
                          )
                        }}
                        className={fieldClassName}
                      />
                      <p className="text-[11px] text-zinc-500">
                        Se usará para marcar visualmente el stock bajo.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="pt-2">
        <button
          onClick={handleSubmit}
          disabled={loading || uploadingImage}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-60"
        >
          {uploadingImage
            ? 'Subiendo imagen...'
            : loading
              ? 'Guardando...'
              : 'Crear producto'}
        </button>
      </div>
    </div>
  )
}
