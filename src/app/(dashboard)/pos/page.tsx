'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ShoppingCart } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ProductGrid from '@/components/pos/product-grid'
import Cart from '@/components/pos/cart'
import { useCart } from '@/lib/hooks/use-cart'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n)

export default function POSPage() {
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [campusName, setCampusName] = useState<string | null>(null)
  const [cartOpen, setCartOpen] = useState(false)

  const { itemCount, total } = useCart()

  const searchParams = useSearchParams()
  const [sumupResult, setSumupResult] = useState<{
    status: string
    txCode?: string
    ref?: string
  } | null>(null)

  const currentItemCount = itemCount()
  const currentTotal = total()

  // ── Detect SumUp callback when app returns ────────────────────────────────
  useEffect(() => {
    const smpStatus = searchParams?.get('smp-status')
    const smpRef = searchParams?.get('smp-ref')
    const smpTx = searchParams?.get('smp-tx-code')

    if (smpStatus) {
      setSumupResult({
        status: smpStatus,
        txCode: smpTx ?? undefined,
        ref: smpRef ?? undefined,
      })

      if (smpStatus === 'success' && (window as any).__sumupSmartRef === smpRef) {
        const registerOrder = async () => {
          try {
            const supabase = createClient()
            const {
              data: { session },
            } = await supabase.auth.getSession()

            if (!session?.access_token) return

            await fetch('/api/orders', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                payment_method: 'credito',
                items: JSON.parse((window as any).__sumupSmartItems || '[]').map(
                  (i: any) => ({
                    product_id: i.id,
                    quantity: i.qty,
                    size: i.size,
                  }),
                ),
                notes: `SumUp Smart POS | TX: ${smpTx} | Ref: ${smpRef}`,
                total: (window as any).__sumupSmartTotal,
              }),
            })

            delete (window as any).__sumupSmartRef
            delete (window as any).__sumupSmartTotal
            delete (window as any).__sumupSmartItems

            window.history.replaceState({}, '', '/pos')
          } catch (e) {
            console.error('Error registering SumUp order:', e)
          }
        }

        registerOrder()
      }
    }
  }, [searchParams])

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, campus_id')
        .eq('id', session.user.id)
        .single()

      const campusId = profile?.campus_id ?? null

      let cName: string | null = null

      if (campusId) {
        const { data: campusData } = await supabase
          .from('campus')
          .select('name')
          .eq('id', campusId)
          .maybeSingle()

        cName = campusData?.name ?? null
      }

      setCampusName(cName)

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
    }

    load()
  }, [])

  useEffect(() => {
    if (currentItemCount === 0) return
    // Animación suave: cuando se agrega el primer producto, dejamos el carrito cerrado
    // para mantener foco en selección, pero el botón flotante queda visible.
  }, [currentItemCount])

  return (
    <div className="relative flex h-[calc(100vh-70px)] flex-col overflow-hidden bg-black">
      {campusName && (
        <div className="shrink-0 border-b border-zinc-800 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_12px_rgba(74,222,128,0.55)]" />
              <span className="text-zinc-400">Punto de Venta —</span>
              <span className="font-semibold text-slate-200">{campusName}</span>
              <span className="text-zinc-600">· {products.length} productos</span>
            </div>

            <button
              onClick={() => setCartOpen(true)}
              className="hidden items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-bold text-zinc-300 transition hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-300 md:flex"
            >
              <ShoppingCart size={16} />
              Carrito
              {currentItemCount > 0 && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-black text-black">
                  {currentItemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden p-4">
        <div className="h-full overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl">
          <ProductGrid products={products} categories={categories} />
        </div>
      </div>

      <AnimatePresence>
        {currentItemCount > 0 && !cartOpen && (
          <motion.button
            key="floating-cart"
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.96 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setCartOpen(true)}
            className="fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded-3xl border border-amber-500/30 bg-amber-500 px-5 py-4 text-black shadow-[0_20px_60px_rgba(245,158,11,0.25)] transition hover:bg-amber-400"
          >
            <div className="relative">
              <ShoppingCart size={22} />
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] font-black text-amber-400">
                {currentItemCount}
              </span>
            </div>

            <div className="text-left leading-tight">
              <p className="text-xs font-black uppercase tracking-wide">
                Ver carrito
              </p>
              <p className="text-sm font-black">{fmt(currentTotal)}</p>
            </div>

            <ArrowRight size={18} />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cartOpen && (
          <motion.div
            key="cart-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 p-3 backdrop-blur-sm md:p-5"
          >
            <div className="mx-auto flex h-full max-w-6xl justify-end">
              <motion.div
                initial={{ x: 420, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 420, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 240 }}
                className="h-full w-full overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-950 shadow-2xl md:max-w-[520px]"
              >
                <Cart onClose={() => setCartOpen(false)} />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
