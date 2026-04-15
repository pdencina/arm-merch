'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type InventoryRow = {
  id: string
  stock: number
  low_stock_alert: number
  campus_id: string
  campus_name: string
}

interface Props {
  productId: string
  productName: string
  rows: InventoryRow[]
  isSuperAdmin: boolean
  userCampusId?: string | null
}

export default function EditInventoryByCampus({
  productId,
  productName,
  rows,
  isSuperAdmin,
  userCampusId,
}: Props) {
  const supabase = createClient()

  const visibleRows = useMemo(() => {
    if (isSuperAdmin) return rows
    return rows.filter((row) => row.campus_id === userCampusId)
  }, [rows, isSuperAdmin, userCampusId])

  const [formRows, setFormRows] = useState(
    visibleRows.map((row) => ({
      ...row,
      stock_input: row.stock,
      low_stock_alert_input: row.low_stock_alert,
      saving: false,
    }))
  )

  async function handleSave(rowIndex: number) {
    const row = formRows[rowIndex]

    const newStock = Number(row.stock_input)
    const newLowStock = Number(row.low_stock_alert_input)

    if (newStock < 0) {
      alert('El stock no puede ser negativo')
      return
    }

    if (newLowStock < 0) {
      alert('La alerta no puede ser negativa')
      return
    }

    setFormRows((prev) =>
      prev.map((item, index) =>
        index === rowIndex ? { ...item, saving: true } : item
      )
    )

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        alert('No autenticado')
        setFormRows((prev) =>
          prev.map((item, index) =>
            index === rowIndex ? { ...item, saving: false } : item
          )
        )
        return
      }

      const res = await fetch(`/api/inventory/${row.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          product_id: productId,
          stock: newStock,
          low_stock_alert: newLowStock,
          previous_stock: row.stock,
          campus_id: row.campus_id,
          product_name: productName,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error ?? 'No se pudo actualizar inventario')
        setFormRows((prev) =>
          prev.map((item, index) =>
            index === rowIndex ? { ...item, saving: false } : item
          )
        )
        return
      }

      alert('Inventario actualizado correctamente')

      setFormRows((prev) =>
        prev.map((item, index) =>
          index === rowIndex
            ? {
                ...item,
                stock: newStock,
                low_stock_alert: newLowStock,
                stock_input: newStock,
                low_stock_alert_input: newLowStock,
                saving: false,
              }
            : item
        )
      )
    } catch (error: any) {
      alert(error?.message ?? 'Error inesperado al actualizar inventario')
      setFormRows((prev) =>
        prev.map((item, index) =>
          index === rowIndex ? { ...item, saving: false } : item
        )
      )
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-white">
          Editar inventario por campus
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Ajusta stock y alerta sin salir de esta pantalla.
        </p>
      </div>

      {formRows.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No hay inventario disponible para editar.
        </p>
      ) : (
        <div className="space-y-4">
          {formRows.map((row, index) => (
            <div
              key={row.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {row.campus_name}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Stock actual guardado: {row.stock}
                  </p>
                </div>

                <span className="rounded-lg bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                  Campus
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-400">
                    Stock
                  </label>
                  <input
                    type="number"
                    value={row.stock_input}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      setFormRows((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, stock_input: value } : item
                        )
                      )
                    }}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-400">
                    Alerta stock bajo
                  </label>
                  <input
                    type="number"
                    value={row.low_stock_alert_input}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      setFormRows((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? { ...item, low_stock_alert_input: value }
                            : item
                        )
                      )
                    }}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => handleSave(index)}
                  disabled={row.saving}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-60"
                >
                  {row.saving ? 'Guardando...' : 'Guardar inventario'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}