'use client'

import ConnectionStatus from '@/components/ui/connection-status'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/layout/sidebar'
import Navbar from '@/components/layout/navbar'
import { Toaster } from 'sonner'
import { mergeRolePermissions } from '@/lib/permissions/module-permissions'

const SIDEBAR_STORAGE_KEY = 'arm_merch_sidebar_collapsed'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [perms, setPerms] = useState<Record<string, boolean>>({})
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
    setSidebarCollapsed(saved === 'true')
  }, [])

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      try {
        const {
          data: { user },
          error: sessionError,
        } = await supabase.auth.getUser()

        if (sessionError || !user) {
          router.replace('/login')
          return
        }

        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, email, role, active, campus_id')
          .eq('id', user.id)
          .single()

        if (profileError || !data) {
          setError(profileError?.message ?? 'No se pudo cargar el perfil')
          setReady(true)
          return
        }

        setProfile(data)

        if (data.role === 'super_admin') {
          setPerms(mergeRolePermissions(data.role))
          setReady(true)
          return
        }

        const defaults = mergeRolePermissions(data.role)

        const { data: permRows } = await supabase
          .from('module_permissions')
          .select('module, enabled')
          .eq('role', data.role)

        const overrides: Record<string, boolean> = {}

        ;(permRows ?? []).forEach((row: any) => {
          overrides[row.module] = row.enabled
        })

        setPerms({ ...defaults, ...overrides })
        setReady(true)
      } catch (err: any) {
        setError(err?.message ?? 'Error cargando dashboard')
        setReady(true)
      }
    }

    init()
  }, [router])


  useEffect(() => {
    if (!profile?.full_name) return

    const today = new Date().toISOString().slice(0, 10)
    const key = `arm_merch_welcome_${profile.id}_${today}`

    const alreadySeen = window.localStorage.getItem(key)

    if (!alreadySeen) {
      const timer = setTimeout(() => {
        setShowWelcome(true)
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [profile])

  function closeWelcome() {
    if (!profile?.id) {
      setShowWelcome(false)
      return
    }

    const today = new Date().toISOString().slice(0, 10)
    const key = `arm_merch_welcome_${profile.id}_${today}`

    window.localStorage.setItem(key, 'true')
    setShowWelcome(false)
  }

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024) setSidebarOpen(false)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((prev) => {
      const next = !prev
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
      return next
    })
  }

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-white">
        <div className="max-w-md rounded-xl border border-red-500/20 bg-zinc-900 p-6 text-sm">
          <p className="font-semibold text-red-400">No se pudo cargar el perfil</p>
          <p className="mt-2 text-zinc-300">
            {error ?? 'Perfil no encontrado en la tabla profiles.'}
          </p>
        </div>
      </div>
    )
  }

  const campusName =
    profile.role === 'super_admin' || profile.role === 'adm_merch'
      ? 'Todos los campus'
      : null

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <div className="hidden lg:block">
        <Sidebar
          role={profile.role}
          campusName={campusName}
          permissions={perms}
          mobileOpen={false}
          onClose={() => {}}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
        />
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div onClick={(event) => event.stopPropagation()} className="h-full w-[280px] max-w-[85vw]">
            <Sidebar
              role={profile.role}
              campusName={campusName}
              permissions={perms}
              mobileOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              collapsed={false}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar user={profile} onOpenSidebar={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
          <ConnectionStatus />
          {children}
        </main>
      </div>


      {showWelcome && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-md px-4">
          <div className="relative w-full max-w-lg overflow-hidden rounded-[36px] border border-white/10 bg-[#0c0e14] shadow-[0_30px_80px_rgba(0,0,0,0.8)]">

            {/* Decorative glows */}
            <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-amber-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-violet-500/15 blur-3xl" />

            <div className="relative p-10 text-center">
              {/* Animated emoji */}
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-500/20 to-violet-500/10 border border-white/10 shadow-xl">
                <span className="text-5xl animate-[bounce_2s_ease-in-out_infinite]">
                  {new Date().getHours() < 12 ? '☀️' : new Date().getHours() < 20 ? '⚡' : '🌙'}
                </span>
              </div>

              {/* Greeting */}
              <p className="text-xs font-black uppercase tracking-[0.4em] text-amber-400">
                {new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 20 ? 'Buenas tardes' : 'Buenas noches'}
              </p>

              <h2 className="mt-3 text-4xl font-black tracking-tight text-white">
                {String(profile?.full_name ?? 'Equipo').split(' ')[0]} 👋
              </h2>

              {/* Motivational message - random */}
              <p className="mt-5 text-base leading-7 text-zinc-400">
                {(() => {
                  const messages = [
                    'Cada venta que haces apoya la misión de ARM. ¡Gracias por estar aquí!',
                    'Tu servicio hace la diferencia. ¡Vamos con todo hoy!',
                    'Bienvenido/a de vuelta. ¡Que sea un gran día de bendiciones!',
                    'ARM Merch funciona gracias a ti. ¡A dar lo mejor!',
                    'Nuevo día, nuevas oportunidades. ¡Vamos equipo!',
                  ]
                  return messages[Math.floor(Math.random() * messages.length)]
                })()}
              </p>

              {/* Quick stats */}
              <div className="mt-6 flex justify-center gap-3">
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Día</p>
                  <p className="mt-0.5 text-sm font-black text-white capitalize">
                    {new Date().toLocaleDateString('es-CL', { weekday: 'long' })}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Fecha</p>
                  <p className="mt-0.5 text-sm font-black text-white">
                    {new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Hora</p>
                  <p className="mt-0.5 text-sm font-black text-white">
                    {new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <button
                onClick={closeWelcome}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 px-6 py-4 text-base font-black text-black shadow-[0_8px_24px_rgba(245,158,11,0.3)] transition-all hover:scale-[1.02] hover:shadow-[0_12px_32px_rgba(245,158,11,0.4)]"
              >
                ¡Vamos! 🚀
              </button>

              <p className="mt-4 text-xs text-zinc-600">ARM Merch · Apoyando la misión</p>
            </div>
          </div>
        </div>
      )}

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#18181b',
            border: '1px solid #3f3f46',
            color: '#f4f4f5',
          },
        }}
      />
    </div>
  )
}
