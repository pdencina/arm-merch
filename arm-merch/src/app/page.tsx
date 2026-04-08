import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      redirect('/dashboard')
    } else {
      redirect('/login')
    }
  } catch {
    redirect('/login')
  }
}
