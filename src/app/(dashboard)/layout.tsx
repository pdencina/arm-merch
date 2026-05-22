'use client'

import ConnectionStatus from '@/components/ui/connection-status'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/layout/sidebar'
import Navbar from '@/components/layout/navbar'
import { Toaster } from 'sonner'

const ROLE_DEFAULTS: Record<string, Record<string, boolean>> = {
  admin: {
    'dashboard.view': true,
    'pos.view': true,
    'orders.view': true,
    'deliveries.view': true,
    'inventory.view': true,
    'movements.view': true,
    'products.view': true,
    'reports.view': true,
    'close_day.view': true,
    'categories.view': true,
  },
  voluntario: {
    'dashboard.view': false,
    'pos.view': true,
    'orders.view': true,
    'deliveries.view': true,
    'inventory.view': true,
    'movements.view': false,
    'products.view': true,
    'reports.view': false,
    'close_day.view': false,
    'categories.view': false,
  },
}

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
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError || !session) {
          router.replace('/login')
          return
        }

        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, email, role, active, campus_id, campus:campus(id, name)')
          .eq('id', session.user.id)
          .single()

        if (profileError || !data) {
          setError(profileError?.message ?? 'No se pudo cargar el perfil')
          setReady(true)
          return
        }

        setProfile(data)

        if (data.role === 'super_admin') {
          setPerms(new Proxy({}, { get: () => true }) as Record<string, boolean>)
          setReady(true)
          return
        }

        const defaults = ROLE_DEFAULTS[data.role] ?? {}

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

  const campusRaw = profile.campus
  const campusName = Array.isArray(campusRaw) ? campusRaw[0]?.name : campusRaw?.name

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
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-white/10 bg-[#111418] shadow-2xl">

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.12),transparent_45%)]" />

            <div className="relative p-8">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1A2230] border border-[#2A3445] shadow-lg">
                <span className="text-2xl">👋</span>
              </div>

              <h2 className="text-2xl font-black tracking-tight text-white">
                Hola {String(profile?.full_name ?? '').split(' ')[0]}
              </h2>

              <p className="mt-4 text-sm leading-7 text-[#A1AAB8]">
                Qué bueno verte nuevamente.
                Esperamos que tengas un excelente día de servicio en ARM Merch. 🤗
              </p>

              <button
                onClick={closeWelcome}
                className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-[#F59E0B] px-5 py-3.5 text-sm font-bold text-black transition-all hover:scale-[1.01] hover:bg-[#FDBA2D]"
              >
                Vamos 🚀
              </button>
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
