'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Plus, X, Loader2, UserPlus, Mail } from 'lucide-react'

type Role = 'super_admin' | 'admin' | 'voluntario'

const ROLE_STYLES: Record<Role, string> = {
  super_admin: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  admin:       'bg-blue-500/10 text-blue-400 border-blue-500/20',
  voluntario:  'bg-green-500/10 text-green-400 border-green-500/20',
}

const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin:       'Admin',
  voluntario:  'Voluntario',
}

const CAMPUS_COLORS: Record<string, string> = {
  'ARM Santiago':    'bg-blue-500/10 text-blue-400',
  'ARM Puente Alto': 'bg-purple-500/10 text-purple-400',
  'ARM Punta Arenas':'bg-teal-500/10 text-teal-400',
  'ARM Montevideo':  'bg-amber-500/10 text-amber-400',
  'ARM Maracaibo':   'bg-red-500/10 text-red-400',
}

export default function UsersClient({ initialUsers }: { initialUsers: any[] }) {
  const [users, setUsers]       = useState<any[]>(initialUsers)
  const [campus, setCampus]     = useState<any[]>([])
  const [search, setSearch]     = useState('')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  // Nuevo usuario
  const [newName, setNewName]       = useState('')
  const [newEmail, setNewEmail]     = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole]       = useState<Role>('voluntario')
  const [newCampus, setNewCampus]   = useState('')

  useEffect(() => {
    createClient().from('campus').select('id, name').eq('active', true).order('name')
      .then(({ data }) => setCampus(data ?? []))
  }, [])

  const filtered = users.filter(u =>
    !search ||
    (u.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      setError('Nombre, email y contraseña son obligatorios'); return
    }
    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres'); return
    }

    setLoading(true); setError('')
    const supabase = createClient()

    // Crear usuario via API de admin (requiere service role)
    // Como no tenemos service role en el cliente, usamos signUp y luego actualizamos el perfil
    const { data, error: signUpError } = await supabase.auth.admin?.createUser({
      email: newEmail.trim(),
      password: newPassword,
      email_confirm: true,
      user_metadata: { full_name: newName.trim() },
    }) ?? { data: null, error: { message: 'No disponible' } }

    // Si admin API no está disponible, usar la API Route
    if (signUpError) {
      // Intentar via API Route
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail.trim(),
          password: newPassword,
          full_name: newName.trim(),
          role: newRole,
          campus_id: newCampus || null,
        }),
      })
      const result = await res.json()
      if (!res.ok) { setError(result.error || 'Error al crear usuario'); setLoading(false); return }

      setSuccess(`Usuario ${newEmail} creado exitosamente`)
      resetForm()
      reloadUsers()
      return
    }

    if (data?.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: newName.trim(),
        email: newEmail.trim(),
        role: newRole,
        campus_id: newCampus || null,
        active: true,
      })
    }

    setSuccess(`Usuario ${newEmail} creado exitosamente`)
    resetForm()
    reloadUsers()
  }

  function resetForm() {
    setNewName(''); setNewEmail(''); setNewPassword('')
    setNewRole('voluntario'); setNewCampus('')
    setLoading(false); setShowModal(false)
    setTimeout(() => setSuccess(''), 4000)
  }

  async function reloadUsers() {
    const { data } = await createClient().from('profiles').select('*, campus:campus(name)').order('created_at', { ascending: false })
    if (data) setUsers(data)
  }

  async function updateRole(userId: string, role: Role) {
    await createClient().from('profiles').update({ role }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
  }

  async function updateCampus(userId: string, campusId: string) {
    await createClient().from('profiles').update({ campus_id: campusId || null }).eq('id', userId)
    const campusName = campus.find(c => c.id === campusId)?.name ?? null
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, campus_id: campusId, campus: { name: campusName } } : u))
  }

  async function toggleActive(userId: string, active: boolean) {
    await createClient().from('profiles').update({ active }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, active } : u))
  }

  const stats = {
    total:      users.length,
    activos:    users.filter(u => u.active).length,
    admins:     users.filter(u => u.role === 'admin').length,
    voluntarios: users.filter(u => u.role === 'voluntario').length,
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Usuarios y roles</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Gestión de acceso a la plataforma</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold
                     rounded-xl px-4 py-2.5 text-sm transition active:scale-[0.98]">
          <UserPlus size={15} />
          Nuevo usuario
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total usuarios', value: stats.total },
          { label: 'Activos',        value: stats.activos },
          { label: 'Admins',         value: stats.admins },
          { label: 'Voluntarios',    value: stats.voluntarios },
        ].map(s => (
          <div key={s.label} className="bg-zinc-800/50 border border-zinc-700/40 rounded-xl p-4">
            <p className="text-xs text-zinc-500">{s.label}</p>
            <p className="text-xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <p className="text-sm text-green-400">{success}</p>
        </div>
      )}

      {/* Buscador */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o email..."
          className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600
                     rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition" />
      </div>

      {/* Tabla */}
      <div className="bg-zinc-800/30 rounded-xl border border-zinc-700/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700/60">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Usuario</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 hidden sm:table-cell">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Rol</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 hidden md:table-cell">Campus</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 hidden lg:table-cell">Registro</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-zinc-600 text-sm">No se encontraron usuarios</td></tr>
              ) : filtered.map(user => (
                <tr key={user.id} className="border-b border-zinc-700/30 hover:bg-zinc-700/10 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-amber-400">
                          {(user.full_name ?? user.email ?? '?')[0].toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm text-zinc-200 font-medium">{user.full_name ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs text-zinc-500">{user.email}</span>
                  </td>
                  <td className="px-4 py-3">
                    <select value={user.role} onChange={e => updateRole(user.id, e.target.value as Role)}
                      className={`text-xs font-semibold px-2 py-1 rounded-lg border cursor-pointer bg-transparent
                        focus:outline-none transition ${ROLE_STYLES[user.role as Role] ?? ''}`}>
                      <option value="voluntario">Voluntario</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <select value={user.campus_id ?? ''} onChange={e => updateCampus(user.id, e.target.value)}
                      className="text-xs text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 focus:outline-none focus:border-amber-500 transition max-w-[140px]">
                      <option value="">Sin campus</option>
                      {campus.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-zinc-600">
                      {new Date(user.created_at).toLocaleDateString('es-CL', { day:'2-digit', month:'short', year:'numeric' })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(user.id, !user.active)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                        user.active
                          ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
                          : 'bg-zinc-700/50 text-zinc-500 border-zinc-600/20 hover:bg-zinc-700'
                      }`}>
                      {user.active ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal crear usuario */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <UserPlus size={16} className="text-amber-400" />
                <h2 className="text-sm font-semibold text-white">Nuevo usuario</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-white transition">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Nombre completo <span className="text-red-400">*</span></label>
                  <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="Juan Pérez"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600
                               rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition" />
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Email <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                      placeholder="juan@armglobal.cl"
                      className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600
                                 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Contraseña <span className="text-red-400">*</span></label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600
                               rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Rol</label>
                    <select value={newRole} onChange={e => setNewRole(e.target.value as Role)}
                      className="w-full bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition">
                      <option value="voluntario">Voluntario</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Campus</label>
                    <select value={newCampus} onChange={e => setNewCampus(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition">
                      <option value="">Sin campus</option>
                      {campus.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-xs bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl py-2.5 text-sm transition">
                  Cancelar
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 font-bold
                             rounded-xl py-2.5 text-sm transition flex items-center justify-center gap-2">
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {loading ? 'Creando...' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
