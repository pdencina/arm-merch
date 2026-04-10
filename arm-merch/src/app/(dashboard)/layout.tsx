'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/layout/sidebar'
import Navbar from '@/components/layout/navbar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/login'; return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, active, campus_id, campus:campus(name)')
        .eq('id', session.user.id)
        .single()

      setUser(profile ?? {
        id: session.user.id,
        full_name: session.user.email,
        email: session.user.email,
        role: 'voluntario',
        active: true,
        campus_id: null,
        campus: null,
      })
      setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) window.location.href = '/login'
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight:'100vh', background:'#080808', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:36, height:36, border:'3px solid #f59e0b', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <Sidebar role={user?.role ?? 'voluntario'} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar user={user} />
        <main className="flex-1 overflow-auto bg-zinc-900 rounded-tl-2xl p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
