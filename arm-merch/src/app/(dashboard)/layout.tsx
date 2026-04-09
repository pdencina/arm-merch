import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/sidebar'
import Navbar from '@/components/layout/navbar'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, active')
    .eq('id', user!.id)
    .single()

  const p = (profile ?? { id: user!.id, full_name: user!.email, email: user!.email, role: 'voluntario', active: true }) as any

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <Sidebar role={p.role} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar user={p} />
        <main className="flex-1 overflow-auto bg-zinc-900 rounded-tl-2xl p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
