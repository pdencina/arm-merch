'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Props {
  productId: string
  productName: string
  campuses: { id: string; name: string }[]
}

export default function AssignCampusForm({ productId, productName, campuses }: Props) {
  const supabase = createClient()

  const [campusId, setCampusId] = useState('')
  const [stock, setStock] = useState('')
  const [lowStock, setLowStock] = useState('5')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!campusId) {
      toast.error('Selecciona un campus')
      return
    }

    setLoading(true)

    try {
      // 👇 IMPORTANTE: NO VALIDAMOS SESSION AQUÍ
      const res = await fetch('/api/inventory/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          campus_id: campusId,
          stock: Number(stock || 0),
          low_stock_alert: Number(lowStock || 5),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Error al asignar producto')
        setLoading(false)
        return
      }

      toast.success('Producto asignado al campus')

      // 🔥 refrescar pantalla
      window.location.reload()

    } catch (err) {
      toast.error('Error inesperado')
    }

    setLoading(false)
  }

  return (
    <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
      <h2 className="mb-4 text-sm font-semibold text-white">
        Agregar producto a otro campus
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">

        <select
          value={campusId}
          onChange={(e) => setCampusId(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm text-white"
        >
          <option value="">Seleccionar campus</option>
          {campuses.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="Stock inicial"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm text-white"
          />

          <input
            type="number"
            placeholder="Stock bajo"
            value={lowStock}
            onChange={(e) => setLowStock(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm text-white"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl py-2 transition disabled:opacity-50"
        >
          {loading ? 'Asignando...' : 'Asignar a campus'}
        </button>
      </form>
    </div>
  )
}