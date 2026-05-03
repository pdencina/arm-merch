'use client'
import ConnectionStatus from '@/components/ui/connection-status'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/layout/sidebar'
import Navbar from '@/components/layout/navbar'
import { Toaster } from 'sonner'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
        setReady(true)
      } catch (err: any) {
        setError(err?.message ?? 'Error cargando dashboard')
        setReady(true)
      }
    }

    init()
  }, [router])

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
  const campusName = Array.isArray(campusRaw)
    ? campusRaw[0]?.name
    : campusRaw?.name

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      {/* Sidebar desktop */}
      <div className="hidden lg:block">
        <Sidebar
          role={profile.role}
          campusName={campusName}
          mobileOpen={false}
          onClose={() => {}}
        />
      </div>

      {/* Sidebar mobile / tablet */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="h-full w-[280px] max-w-[85vw]">
            <Sidebar
              role={profile.role}
              campusName={campusName}
              mobileOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar
          user={profile}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
          <ConnectionStatus />
      {children}
        </main>
      </div>

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