'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import ProductGrid from '@/components/pos/product-grid'
import Cart from '@/components/pos/cart'
import { Wifi, WifiOff, RefreshCw, Store } from 'lucide-react'

export default function POSPage() {
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [campusName, setCampusName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [online, setOnline] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, campus_id, campus:campus(name)')
        .eq('id', session.user.id)
        .single()

      const campusId = profile?.campus_id ?? null
      setCampusName((profile?.campus as any)?.name ?? null)

      let query = supabase
        .from('products_with_stock')
        .select('*')
        .eq('active', true)
        .gt('stock', 0)
        .order('name')

      if (campusId) {
        query = query.eq('campus_id', campusId)
      } else {
        query = query.eq('campus_id', '__none__')
      }

      const [{ data: p }, { data: c }] = await Promise.all([
        query,
        supabase
          .from('categories')
          .select('id, name')
          .eq('active', true)
          .order('name'),
      ])

      setProducts(p ?? [])
      setCategories(c ?? [])
      setLastUpdate(new Date())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()

    // Suscripción realtime para actualización de inventario
    const supabase = createClient()
    const channel = supabase
      .channel('pos-inventory')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products_with_stock' },
        () => load()
      )
      .subscribe()

    // Estado de conexión
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [load])

  return (
    <div className="flex h-[calc(100vh-70px)] flex-col bg-black">

      {/* BARRA DE ESTADO */}
      <div className="shrink-0 border-b border-zinc-800/60 px-5 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Store size={14} className="text-zinc-500" />
              <span className="text-xs text-zinc-500">Punto de Venta</span>
              {campusName && (
                <>
                  <span className="text-zinc-700">—</span>
                  <span className="text-xs font-semibold text-slate-300">{campusName}</span>
                </>
              )}
            </div>

            {!loading && (
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-500">
                {products.length} productos
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Indicador online/offline */}
            <div className={`flex items-center gap-1.5 text-xs ${online ? 'text-emerald-500' : 'text-red-400'}`}>
              {online ? <Wifi size={13} /> : <WifiOff size={13} />}
              <span className="hidden sm:inline">{online ? 'En línea' : 'Sin conexión'}</span>
            </div>

            {/* Última actualización */}
            {lastUpdate && (
              <span className="hidden text-[10px] text-zinc-600 md:inline">
                Act. {lastUpdate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}

            {/* Botón refresh manual */}
            <button
              onClick={load}
              disabled={loading}
              className="rounded-lg p-1.5 text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
              aria-label="Actualizar productos"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* LAYOUT PRINCIPAL: grilla + carrito */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[1fr_400px]">

        {/* GRILLA DE PRODUCTOS */}
        <div className="min-h-0 overflow-hidden border-r border-zinc-800/60">
          {loading && products.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-500" />
                <p className="text-sm text-zinc-600">Cargando productos...</p>
              </div>
            </div>
          ) : (
            <ProductGrid products={products} categories={categories} />
          )}
        </div>

        {/* CARRITO */}
        <div className="min-h-0 overflow-hidden">
          <Cart />
        </div>
      </div>
    </div>
  )
}
