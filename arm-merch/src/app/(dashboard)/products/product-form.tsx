'use client'

import { useState } from 'react'
import { upsertProductWithInventory } from '@/lib/actions/products'

type Category = {
  id: string
  name: string
}

type Campus = {
  id: string
  name: string
}

type Props = {
  categories: Category[]
  campuses: Campus[]
}

export default function ProductForm({ categories, campuses }: Props) {
  const [loading, setLoading] = useState(false)

  const [name, setName] = useState('')
  const [price, setPrice] = useState(0)
  const [sku, setSku] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)

  const [campusStocks, setCampusStocks] = useState(
    campuses.map((c) => ({
      campus_id: c.id,
      enabled: false,
      stock: 0,
      low_stock_alert: 5,
    }))
  )

  const fieldClassName =
    'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black placeholder-zinc-500 focus:outline-none focus:border-amber-500'

  const handleSubmit = async () => {
    setLoading(true)

    const payload = {
      product: {
        name,
        price: Number(price),
        sku,
        category_id: categoryId,
        active: true,
      },
      campusStocks: campusStocks
        .filter((c) => c.enabled)
        .map((c) => ({
          campus_id: c.campus_id,
          stock: Number(c.stock),
          low_stock_alert: Number(c.low_stock_alert),
        })),
    }

    const result = await upsertProductWithInventory(payload)

    setLoading(false)

    if ('error' in result) {
      alert(result.error)
      return
    }

    alert('Producto creado correctamente')
    window.location.href = '/products'
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Nuevo Producto</h2>

      <div className="grid grid-cols-2 gap-4">
        <input
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={fieldClassName}
        />

        <input
          type="number"
          placeholder="Precio"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className={fieldClassName}
        />

        <input
          placeholder="SKU"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className={fieldClassName}
        />

        <select
          value={categoryId ?? ''}
          onChange={(e) => setCategoryId(e.target.value || null)}
          className={fieldClassName}
        >
          <option value="">Categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <h3 className="mb-2 font-semibold text-white">Stock por campus</h3>

        <div className="space-y-4">
          {campusStocks.map((item, index) => {
            const campus = campuses.find((c) => c.id === item.campus_id)

            return (
              <div
                key={item.campus_id}
                className="space-y-2 rounded border border-zinc-700 p-4"
              >
                <label className="flex items-center gap-2 text-white">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setCampusStocks((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, enabled: checked } : row
                        )
                      )
                    }}
                  />
                  {campus?.name}
                </label>

                {item.enabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Stock inicial"
                      value={item.stock}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        setCampusStocks((prev) =>
                          prev.map((row, i) =>
                            i === index ? { ...row, stock: val } : row
                          )
                        )
                      }}
                      className={fieldClassName}
                    />

                    <input
                      type="number"
                      placeholder="Alerta stock"
                      value={item.low_stock_alert}
                      onChange={(e) => {
                        const val = Number(e.target.value)
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
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="rounded bg-blue-600 px-4 py-2 text-white"
      >
        {loading ? 'Guardando...' : 'Crear producto'}
      </button>
    </div>
  )
}