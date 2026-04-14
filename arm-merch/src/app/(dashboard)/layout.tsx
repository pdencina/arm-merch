import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/sidebar'
import Navbar from '@/components/layout/navbar'
import { Toaster } from 'sonner'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, active, campus_id, campus:campus(id, name)')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="rounded-xl border border-red-500/20 bg-zinc-900 p-6 text-sm">
          <p className="font-semibold text-red-400">No se pudo cargar el perfil</p>
          <p className="mt-2 text-zinc-300">
            Revisa que exista un registro en <code>profiles</code> para este usuario.
          </p>
          <p className="mt-2 text-zinc-500">user.id: {user.id}</p>
          <p className="mt-1 text-zinc-500">
            {profileError?.message ?? 'Sin detalle adicional'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <Sidebar
        role={profile.role}
        campusName={profile?.campus?.name}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar user={profile} />
        <main className="flex-1 overflow-y-auto p-5">{children}</main>
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