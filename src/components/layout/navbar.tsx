'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LogOut,
  Search,
  X,
  Sun,
  Moon,
  Bell,
  Package,
  AlertTriangle,
  TrendingDown,
  Menu,
} from 'lucide-react'

const CAMPUS_COLORS: Record<string, string> = {
  'ARM Santiago': 'bg-[#1B2028] text-[#B7C6F9]',
  'ARM Puente Alto': 'bg-[#1B2028] text-[#B7C6F9]',
  'ARM Punta Arenas': 'bg-[#1B2028] text-[#B7C6F9]',
  'ARM Montevideo': 'bg-[#1B2028] text-[#B7C6F9]',
  'ARM Maracaibo': 'bg-[#1B2028] text-[#B7C6F9]',
}

interface Notification {
  id: string
  type: 'low_stock' | 'out_stock' | 'transfer'
  title: string
  desc: string
  time: string
}

export default function Navbar({
  user,
  onOpenSidebar,
}: {
  user: any
  onOpenSidebar?: () => void
}) {
  const router = useRouter()
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [dark, setDark] = useState(true)
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('arm-theme')
    const isDark = saved ? saved === 'dark' : true
    setDark(isDark)
    document.documentElement.classList.toggle('light-mode', !isDark)
  }, [])

  useEffect(() => {
    async function loadNotifs() {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return

      const campusId = user?.campus_id ?? null
      const role = user?.role ?? 'voluntario'

      let lowStockQuery = supabase
        .from('products_with_stock')
        .select('id, name, stock, low_stock_alert, campus_name, campus_id')
        .lte('stock', 5)
        .gt('stock', 0)
        .limit(5)

      let outStockQuery = supabase
        .from('products_with_stock')
        .select('id, name, stock, campus_name, campus_id')
        .eq('stock', 0)
        .limit(5)

      if (role !== 'super_admin' && campusId) {
        lowStockQuery = lowStockQuery.eq('campus_id', campusId)
        outStockQuery = outStockQuery.eq('campus_id', campusId)
      }

      const { data: lowStock } = await lowStockQuery
      const { data: outStock } = await outStockQuery

      const list: Notification[] = []

      ;(outStock ?? []).forEach((p) =>
        list.push({
          id: `out-${p.id}`,
          type: 'out_stock',
          title: `Sin stock: ${p.name}`,
          desc: p.campus_name ? `Campus: ${p.campus_name}` : 'Sin campus asignado',
          time: 'Ahora',
        })
      )

      ;(lowStock ?? []).forEach((p) =>
        list.push({
          id: `low-${p.id}`,
          type: 'low_stock',
          title: `Stock bajo: ${p.name}`,
          desc: `Quedan ${p.stock} uds.${p.campus_name ? ` · ${p.campus_name}` : ''}`,
          time: 'Ahora',
        })
      )

      setNotifs(list)
      setUnread(list.length)
    }

    loadNotifs()
    const interval = setInterval(loadNotifs, 60000)
    return () => clearInterval(interval)
  }, [user])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((s) => !s)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setNotifOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const t = setTimeout(async () => {
      const supabase = createClient()
      const q = query.toLowerCase()

      const [{ data: products }, { data: orders }] = await Promise.all([
        supabase
          .from('products_with_stock')
          .select('id, name, sku, price, stock')
          .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
          .limit(4),

        supabase
          .from('orders')
          .select('id, order_number, total, status, notes')
          .or(`notes.ilike.%${q}%`)
          .limit(3),
      ])

      const r: any[] = []
      ;(products ?? []).forEach((p) =>
        r.push({
          type: 'product',
          id: p.id,
          label: p.name,
          sub: `SKU: ${p.sku ?? '—'} · Stock: ${p.stock}`,
          href: `/products/${p.id}`,
        })
      )
      ;(orders ?? []).forEach((o) =>
        r.push({
          type: 'order',
          id: o.id,
          label: `Orden #${o.order_number}`,
          sub: o.notes?.replace('Cliente: ', '') ?? '—',
          href: '/orders',
        })
      )

      setResults(r)
    }, 250)

    return () => clearTimeout(t)
  }, [query])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    localStorage.setItem('arm-theme', next ? 'dark' : 'light')
    document.documentElement.classList.toggle('light-mode', !next)
  }

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const initials =
    user?.full_name
      ?.split(' ')
      .map((w: string) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() ?? '?'

  const campusName = user?.campus?.name ?? null
  const campusStyle = campusName
    ? CAMPUS_COLORS[campusName] ?? 'bg-[#1B2028] text-[#B7C6F9]'
    : null

  const NOTIF_ICON: Record<string, any> = {
    out_stock: <TrendingDown size={13} className="text-red-400" />,
    low_stock: <AlertTriangle size={13} className="text-orange-400" />,
    transfer: <Package size={13} className="text-[#B7C6F9]" />,
  }

  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b border-[#222831] bg-[#0F1216] px-3 py-3 shrink-0 sm:px-4 lg:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            onClick={onOpenSidebar}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#161A20] text-[#A1A8B3] transition hover:bg-[#1D232B] hover:text-[#B7C6F9] lg:hidden"
          >
            <Menu size={18} />
          </button>

          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-10 items-center gap-2 rounded-xl border border-[#252A31] bg-[#161A20] px-3 text-xs text-[#7F8896] transition hover:bg-[#1B2028] sm:w-56"
          >
            <Search size={13} />
            <span className="truncate">Buscar...</span>
            <span className="ml-auto hidden rounded bg-[#252A31] px-1.5 py-0.5 font-mono text-[9px] text-[#7F8896] sm:block">
              ⌘K
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            title={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#161A20] text-[#A1A8B3] transition hover:bg-[#1D232B] hover:text-[#B7C6F9]"
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                setNotifOpen((o) => !o)
                setUnread(0)
              }}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[#161A20] text-[#A1A8B3] transition hover:bg-[#1D232B] hover:text-white"
            >
              <Bell size={15} />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 z-50 w-[300px] max-w-[85vw] overflow-hidden rounded-2xl border border-[#252A31] bg-[#14171B] shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#222831] px-4 py-3">
                  <span className="text-sm font-semibold text-[#F3F5F7]">Notificaciones</span>
                  <span className="text-xs text-[#7F8896]">{notifs.length} alertas</span>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {notifs.length === 0 ? (
                    <div className="py-8 text-center">
                      <Bell size={24} className="mx-auto mb-2 text-[#3A414D]" />
                      <p className="text-xs text-[#66707F]">Todo en orden</p>
                    </div>
                  ) : (
                    notifs.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          router.push('/inventory')
                          setNotifOpen(false)
                        }}
                        className="flex w-full items-start gap-3 border-b border-[#222831]/70 px-4 py-3 text-left transition hover:bg-[#1A1E23] last:border-0"
                      >
                        <div
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                            n.type === 'out_stock'
                              ? 'bg-red-500/10'
                              : n.type === 'low_stock'
                              ? 'bg-orange-500/10'
                              : 'bg-[#1B2028]'
                          }`}
                        >
                          {NOTIF_ICON[n.type]}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-[#E6EAF0]">
                            {n.title}
                          </p>
                          <p className="mt-0.5 text-[10px] text-[#7F8896]">{n.desc}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {notifs.length > 0 && (
                  <div className="border-t border-[#222831] px-4 py-2.5">
                    <button
                      onClick={() => {
                        router.push('/inventory')
                        setNotifOpen(false)
                      }}
                      className="text-xs text-[#B7C6F9] transition hover:text-white"
                    >
                      Ver inventario →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="ml-1 flex items-center gap-2.5">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium leading-none text-[#F3F5F7]">
                {user?.full_name ?? '—'}
              </p>
              <div className="mt-0.5 flex items-center justify-end gap-1">
                {campusName && (
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${campusStyle}`}>
                    {campusName}
                  </span>
                )}
                <p className="text-[10px] capitalize text-[#7F8896]">
                  {user?.role?.replace('_', ' ')}
                </p>
              </div>
            </div>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#2C3440] bg-[#1B2028]">
              <span className="text-xs font-bold text-[#B7C6F9]">{initials}</span>
            </div>
          </div>

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#161A20] text-[#7F8896] transition hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {searchOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 px-4 pt-20"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSearchOpen(false)
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#252A31] bg-[#14171B] shadow-2xl">
            <div className="flex items-center gap-3 border-b border-[#222831] px-4 py-3.5">
              <Search size={16} className="shrink-0 text-[#7F8896]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar productos, órdenes, clientes..."
                className="flex-1 bg-transparent text-sm text-[#F3F5F7] placeholder-[#7F8896] outline-none"
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="text-[#66707F] transition hover:text-[#A1A8B3]"
              >
                <X size={16} />
              </button>
            </div>

            {results.length > 0 ? (
              <div className="max-h-72 overflow-y-auto py-2">
                {results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      router.push(r.href)
                      setSearchOpen(false)
                      setQuery('')
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-[#1A1E23]"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1B2028] text-xs text-[#B7C6F9]">
                      {r.type === 'product' ? '📦' : '🧾'}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#E6EAF0]">{r.label}</p>
                      <p className="truncate text-xs text-[#7F8896]">{r.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : query.trim() ? (
              <div className="py-8 text-center text-sm text-[#66707F]">
                Sin resultados para "{query}"
              </div>
            ) : (
              <div className="px-4 py-6">
                <p className="mb-3 text-xs text-[#66707F]">Accesos rápidos</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Punto de Venta', href: '/pos' },
                    { label: 'Inventario', href: '/inventory' },
                    { label: 'Órdenes', href: '/orders' },
                    { label: 'Reportes', href: '/reports' },
                    { label: 'Cierre de caja', href: '/close-day' },
                  ].map((l) => (
                    <button
                      key={l.href}
                      onClick={() => {
                        router.push(l.href)
                        setSearchOpen(false)
                      }}
                      className="rounded-lg bg-[#1B2028] px-3 py-1.5 text-xs text-[#A1A8B3] transition hover:bg-[#232A34] hover:text-white"
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>      {/* Logout confirm modal */}
      {showLogoutConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: '#111318', border: '1px solid #2a2e38',
              borderRadius: '20px', padding: '28px 24px',
              maxWidth: '320px', width: '90%', textAlign: 'center',
              boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
              animation: 'slideUp 0.2s ease',
            }}
          >
            <div style={{
              width: '44px', height: '44px', borderRadius: '50%',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
            <p style={{ fontSize: '15px', fontWeight: 600, color: '#f3f5f7', marginBottom: '6px' }}>
              ¿Cerrar sesión?
            </p>
            <p style={{ fontSize: '12px', color: '#66707f', marginBottom: '22px', lineHeight: 1.5 }}>
              Serás redirigido al login. Asegúrate de haber guardado tus cambios.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  flex: 1, background: 'transparent', border: '1px solid #2a2e38',
                  borderRadius: '10px', padding: '10px', fontSize: '13px',
                  color: '#66707f', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleLogout}
                style={{
                  flex: 1, background: '#ef4444', border: 'none',
                  borderRadius: '10px', padding: '10px', fontSize: '13px',
                  fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cerrar sesión
              </button>
            </div>
          </div>
          <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
        </div>
      )}
  )
}