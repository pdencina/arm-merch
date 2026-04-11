'use client'

import { useEffect, useState } from 'react'
import UsersClient from './users-client'

export default function UsersPage() {
  const [users, setUsers]   = useState<any[]>([])
  const [campus, setCampus] = useState<any[]>([])
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        // Join manual campus → profiles
        const campusMap: Record<string, string> = {}
        ;(data.campus ?? []).forEach((c: any) => { campusMap[c.id] = c.name })
        const withCampus = (data.profiles ?? []).map((p: any) => ({
          ...p,
          campus: p.campus_id ? { id: p.campus_id, name: campusMap[p.campus_id] ?? '—' } : null
        }))
        setUsers(withCampus)
        setCampus(data.campus ?? [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="bg-red-950/40 border border-red-900 rounded-xl p-4 text-red-400 text-sm">
      Error: {error}
    </div>
  )

  return <UsersClient initialUsers={users} initialCampus={campus} />
}
