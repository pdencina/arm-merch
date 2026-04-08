import { createClient } from '@/lib/supabase/server'
import UsersClient from './users-client'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: usersRaw } = await supabase
    .from('profiles').select('*').order('created_at', { ascending: false })

  return <UsersClient initialUsers={(usersRaw ?? []) as any[]} />
}
