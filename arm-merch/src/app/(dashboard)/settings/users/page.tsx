'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import UsersClient from './users-client'

export default function UsersPage() {
  const [users, setUsers]   = useState<any[]>([])
  const [campus, setCampus] = useState<any[]>([])
  const [error, setError]   = useState('')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      // Primero traer profiles sin join para aislar el problema
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, active, campus_id, created_at')
        .order('created_at', { ascending: false })

      if (pErr) { setError(`Error profiles: ${pErr.message}`); return }

      // Traer campus por separado
      const { data: campusData, error: cErr } = await supabase
        .from('campus')
        .select('id, name')
        .eq('active', true)
        .order('name')

      if (cErr) { setError(`Error campus: ${cErr.message}`); return }

      // Hacer join manual
      const campusMap: Record<string, string> = {}
      ;(campusData ?? []).forEach((c: any) => { campusMap[c.id] = c.name })

      const withCampus = (profiles ?? []).map((p: any) => ({
        ...p,
        campus: p.campus_id ? { id: p.campus_id, name: campusMap[p.campus_id] ?? '—' } : null
      }))

      setUsers(withCampus)
      setCampus(campusData ?? [])
    }
    load()
  }, [])

  if (error) return (
    <div className="bg-red-950/40 border border-red-900 rounded-xl p-4 text-red-400 text-sm">
      {error}
    </div>
  )

  return <UsersClient initialUsers={users} initialCampus={campus} />
}
