'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/layout/sidebar'
import Navbar  from '@/components/layout/navbar'
import { Toaster } from 'sonner'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser]   = useState<any>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*, campus:campus(id, name)')
        .eq('id', session.user.id)
        .single()

      setUser(profile)
      setReady(true)
    }
    init()
  }, [])

  if (!ready) return (
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <Sidebar role={user?.role ?? 'voluntario'} campusName={user?.campus?.name} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar user={user} />
        <main className="flex-1 overflow-y-auto p-5">
          {children}
        </main>
      </div>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { background:'#18181b', border:'1px solid #3f3f46', color:'#f4f4f5' },
        }}
      />
    </div>
  )
}
