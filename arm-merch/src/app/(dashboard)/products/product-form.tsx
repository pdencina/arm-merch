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
      <h2 className="text-xl font-bold">Nuevo Producto</h2>

      {/* DATOS DEL PRODUCTO */}
      <div className="grid grid-cols-2 gap-4">
        <input
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border p-2 rounded"
        />

        <input
          type="number"
          placeholder="Precio"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="border p-2 rounded"
        />

        <input
          placeholder="SKU"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="border p-2 rounded"
        />

        <select
          onChange={(e) => setCategoryId(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* CAMPUS */}
      <div>
        <h3 className="font-semibold mb-2">Stock por campus</h3>

        <div className="space-y-4">
          {campusStocks.map((item, index) => {
            const campus = campuses.find((c) => c.id === item.campus_id)

            return (
              <div key={item.campus_id} className="border p-4 rounded space-y-2">
                <label className="flex gap-2 items-center">
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
                      className="border p-2 rounded"
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
                      className="border p-2 rounded"
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
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        {loading ? 'Guardando...' : 'Crear producto'}
      </button>
    </div>
  )
}