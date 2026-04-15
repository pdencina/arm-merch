'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function InventoryMovementsPage() {
  const supabase = createClient()

  const [movements, setMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadMovements() {
      setLoading(true)

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        setError('No autenticado')
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, campus_id')
        .eq('id', session.user.id)
        .single()

      let query = supabase
        .from('inventory_movements')
        .select(`
          id,
          product_id,
          campus_id,
          type,
          quantity,
          notes,
          created_at,
          created_by,
          product:products(name, sku),
          campus:campus(name),
          user_profile:profiles!inventory_movements_created_by_fkey(full_name)
        `)
        .order('created_at', { ascending: false })

      if (profile?.role !== 'super_admin' && profile?.campus_id) {
        query = query.eq('campus_id', profile.campus_id)
      }

      const { data, error } = await query

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      setMovements(data ?? [])
      setLoading(false)
    }

    loadMovements()
  }, [supabase])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-6 text-red-200">
        <p className="text-sm font-medium">Error cargando movimientos</p>
        <p className="mt-2 text-sm text-red-300/80">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Movimientos de inventario</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Entradas, salidas y ajustes con fecha y hora.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
        {movements.length === 0 ? (
          <p className="text-sm text-zinc-500">No hay movimientos registrados.</p>
        ) : (
          <div className="space-y-3">
            {movements.map((movement: any) => {
              const productRaw = movement.product
              const productName = Array.isArray(productRaw)
                ? productRaw[0]?.name
                : productRaw?.name

              const productSku = Array.isArray(productRaw)
                ? productRaw[0]?.sku
                : productRaw?.sku

              const campusRaw = movement.campus
              const campusName = Array.isArray(campusRaw)
                ? campusRaw[0]?.name
                : campusRaw?.name

              const userRaw = movement.user_profile
              const userName = Array.isArray(userRaw)
                ? userRaw[0]?.full_name
                : userRaw?.full_name

              const typeColors: Record<string, string> = {
                entrada: 'bg-green-500/10 text-green-300',
                salida: 'bg-red-500/10 text-red-300',
                ajuste: 'bg-orange-500/10 text-orange-300',
              }

              return (
                <div
                  key={movement.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-lg px-3 py-1 text-xs font-medium ${typeColors[movement.type] || 'bg-zinc-800 text-zinc-300'}`}
                        >
                          {movement.type || 'movimiento'}
                        </span>
                        <span className="rounded-lg bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                          Cantidad: {movement.quantity ?? 0}
                        </span>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="rounded-lg bg-zinc-900 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                            Fecha y hora
                          </p>
                          <p className="mt-1 text-sm text-white">
                            {formatDateTime(movement.created_at)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-zinc-900 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                            Producto
                          </p>
                          <p className="mt-1 text-sm text-white">
                            {productName || '—'}
                          </p>
                          <p className="text-xs text-zinc-500">
                            SKU: {productSku || '—'}
                          </p>
                        </div>

                        <div className="rounded-lg bg-zinc-900 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                            Campus
                          </p>
                          <p className="mt-1 text-sm text-white">
                            {campusName || '—'}
                          </p>
                        </div>

                        <div className="rounded-lg bg-zinc-900 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                            Realizado por
                          </p>
                          <p className="mt-1 text-sm text-white">
                            {userName || '—'}
                          </p>
                        </div>
                      </div>

                      {movement.notes && (
                        <p className="text-xs text-zinc-500">
                          Nota: {movement.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}