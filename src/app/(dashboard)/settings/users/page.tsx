'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NotifyModal, useNotify } from '@/components/ui/notify-modal'
import {
  Search, UserPlus, X, Loader2, Mail, Shield,
  MapPin, KeyRound, Eye, EyeOff,
} from 'lucide-react'

type Role = 'super_admin' | 'adm_merch' | 'admin' | 'voluntario'

const ROLE_STYLES: Record<Role, string> = {
  super_admin: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  adm_merch:   'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  admin:       'bg-blue-500/10 text-blue-400 border-blue-500/20',
  voluntario:  'bg-green-500/10 text-green-400 border-green-500/20',
}

const CAMPUS_COLORS: Record<string, string> = {
  'ARM Santiago':     'bg-blue-500/10 text-blue-400',
  'ARM Puente Alto':  'bg-purple-500/10 text-purple-400',
  'ARM Punta Arenas': 'bg-teal-500/10 text-teal-400',
  'ARM Montevideo':   'bg-amber-500/10 text-amber-400',
  'ARM Maracaibo':    'bg-red-500/10 text-red-400',
}

export default function UsersPage() {
  const { notify, success, error, close } = useNotify()

  const [users, setUsers]   = useState<any[]>([])
  const [campus, setCampus] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')

  // ── Create user modal ──
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [newName, setNewName]       = useState('')
  const [newEmail, setNewEmail]     = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole]       = useState<Role>('voluntario')
  const [newCampus, setNewCampus]   = useState('')

  // ── Change password modal ──
  const [pwUser, setPwUser]         = useState<any | null>(null)
  const [newPw, setNewPw]           = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [savingPw, setSavingPw]     = useState(false)

  // ── Edit user modal ──
  const [editUser, setEditUser]       = useState<any | null>(null)
  const [editName, setEditName]       = useState('')
  const [editEmail, setEditEmail]     = useState('')
  const [editRole, setEditRole]       = useState<Role>('voluntario')
  const [editCampus, setEditCampus]   = useState('')
  const [editActive, setEditActive]   = useState(true)
  const [savingEdit, setSavingEdit]   = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const res  = await fetch('/api/admin/users')
      const data = await res.json()
      if (data.error) { error('Error cargando usuarios', data.error); return }

      const campusMap: Record<string, string> = {}
      ;(data.campus ?? []).forEach((c: any) => { campusMap[c.id] = c.name })

      setUsers((data.profiles ?? []).map((p: any) => ({
        ...p,
        campusName: p.campus_id ? (campusMap[p.campus_id] ?? '—') : null,
      })))
      setCampus(data.campus ?? [])
    } catch (e: any) {
      error('Error inesperado', e.message)
    }
    setLoading(false)
  }

  // ── Create user ─────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      error('Campos requeridos', 'Nombre, email y contraseña son obligatorios'); return
    }
    if (newPassword.length < 6) { error('Contraseña muy corta', 'Mínimo 6 caracteres'); return }

    setSaving(true)
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newEmail.trim(), password: newPassword,
        full_name: newName.trim(), role: newRole,
        campus_id: newCampus || null,
      }),
    })
    const result = await res.json()
    setSaving(false)

    if (!res.ok) { error('Error al crear usuario', result.error); return }

    success('Usuario creado', `${newEmail.trim()} fue agregado correctamente`, '👤')
    setNewName(''); setNewEmail(''); setNewPassword('')
    setNewRole('voluntario'); setNewCampus('')
    setShowCreate(false)
    loadAll()
  }

  // ── Edit user ───────────────────────────────────────────────
  function openEditUser(user: any) {
    setEditUser(user)
    setEditName(user.full_name ?? '')
    setEditEmail(user.email ?? '')
    setEditRole((user.role ?? 'voluntario') as Role)
    setEditCampus(user.campus_id ?? '')
    setEditActive(user.active !== false)
  }

  async function handleUpdateUser(e?: React.FormEvent) {
    e?.preventDefault()

    if (!editUser?.id) {
      error('Error', 'Usuario inválido')
      return
    }

    if (!editName.trim() || !editEmail.trim()) {
      error('Campos requeridos', 'Nombre y correo son obligatorios')
      return
    }

    setSavingEdit(true)

    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editUser.id,
        full_name: editName.trim(),
        email: editEmail.trim().toLowerCase(),
        role: editRole,
        campus_id: editCampus || null,
        active: editActive,
      }),
    })

    const result = await res.json()
    setSavingEdit(false)

    if (!res.ok) {
      error('Error al actualizar usuario', result.error ?? 'No se pudo actualizar el usuario')
      return
    }

    success('Usuario actualizado', 'Los datos fueron guardados correctamente', '✅')
    setEditUser(null)
    setEditName('')
    setEditEmail('')
    setEditRole('voluntario')
    setEditCampus('')
    setEditActive(true)
    loadAll()
  }

  // ── Update role ──────────────────────────────────────────────
  async function updateRole(userId: string, role: Role) {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, role }),
    })
    if (!res.ok) { error('Error', 'No se pudo actualizar el rol'); return }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
    success('Rol actualizado', undefined, '🔐')
  }

  // ── Update campus ────────────────────────────────────────────
  async function updateCampus(userId: string, campusId: string) {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, campus_id: campusId || null }),
    })
    if (!res.ok) { error('Error', 'No se pudo actualizar el campus'); return }
    const campusName = campus.find(c => c.id === campusId)?.name ?? null
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, campus_id: campusId, campusName } : u))
    success('Campus actualizado', undefined, '📍')
  }

  // ── Toggle active ────────────────────────────────────────────
  async function toggleActive(userId: string, active: boolean) {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, active }),
    })
    if (!res.ok) { error('Error', 'No se pudo actualizar el estado'); return }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, active } : u))
    success(active ? 'Usuario activado' : 'Usuario desactivado', undefined, active ? '✅' : '⛔')
  }

  // ── Change password ──────────────────────────────────────────
  async function handleChangePassword() {
    if (!newPw.trim()) { error('Contraseña vacía', 'Ingresa la nueva contraseña'); return }
    if (newPw.length < 6) { error('Contraseña muy corta', 'Mínimo 6 caracteres'); return }
    if (newPw !== confirmPw) { error('No coinciden', 'Las contraseñas no son iguales'); return }

    setSavingPw(true)
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pwUser.id, password: newPw }),
    })
    const result = await res.json()
    setSavingPw(false)

    if (!res.ok) { error('Error', result.error ?? 'No se pudo cambiar la contraseña'); return }

    success('Contraseña actualizada', `La contraseña de ${pwUser.full_name ?? pwUser.email} fue cambiada`, '🔑')
    setPwUser(null); setNewPw(''); setConfirmPw(''); setShowPw(false)
  }

  const filtered = users.filter(u =>
    !search ||
    (u.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total:       users.length,
    activos:     users.filter(u => u.active !== false).length,
    admins:      users.filter(
      u =>
        u.role === 'admin' ||
        u.role === 'adm_merch' ||
        u.role === 'super_admin'
    ).length,
    voluntarios: users.filter(u => u.role === 'voluntario').length,
  }

  return (
    <div className="flex flex-col gap-5">
      <NotifyModal notify={notify} onClose={close} />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Usuarios y roles</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{users.length} usuarios registrados</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl px-4 py-2.5 text-sm transition"
        >
          <UserPlus size={15} /> Nuevo usuario
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

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o email..."
          className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition"
        />
      </div>

      {/* Table */}
      <div className="bg-zinc-800/30 rounded-xl border border-zinc-700/40 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700/60">
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Usuario</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 hidden sm:table-cell">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Rol</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Campus</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-zinc-600 text-sm">Sin usuarios</td></tr>
                ) : filtered.map(user => (
                  <tr key={user.id} className="border-b border-zinc-700/30 hover:bg-zinc-700/10 transition">

                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-amber-400">
                            {(user.full_name ?? user.email ?? '?')[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm text-zinc-200 font-medium">{user.full_name ?? '—'}</p>
                          <p className="text-xs text-zinc-600 sm:hidden">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-zinc-500">{user.email}</span>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <select
                        value={user.role ?? 'voluntario'}
                        onChange={e => updateRole(user.id, e.target.value as Role)}
                        className={`text-xs font-semibold px-2 py-1 rounded-lg border cursor-pointer bg-transparent focus:outline-none transition ${ROLE_STYLES[(user.role as Role) ?? 'voluntario']}`}
                      >
                        <option value="voluntario">Voluntario</option>
                        <option value="admin">Admin</option>
                        <option value="adm_merch">ADM Merch</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </td>

                    {/* Campus */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <select
                          value={user.campus_id ?? ''}
                          onChange={e => updateCampus(user.id, e.target.value)}
                          className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-2 py-1 focus:outline-none focus:border-amber-500 transition max-w-[140px]"
                        >
                          <option value="">Sin campus</option>
                          {campus.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {user.campusName && (
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded w-fit ${CAMPUS_COLORS[user.campusName] ?? 'bg-zinc-700/50 text-zinc-400'}`}>
                            {user.campusName}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Active */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(user.id, !(user.active !== false))}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                          user.active !== false
                            ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
                            : 'bg-zinc-700/50 text-zinc-500 border-zinc-600/20 hover:bg-zinc-700'
                        }`}
                      >
                        {user.active !== false ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openEditUser(user)}
                          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-400 transition hover:border-blue-500/40 hover:text-blue-400"
                        >
                          Editar
                        </button>

                        <button
                          onClick={() => { setPwUser(user); setNewPw(''); setConfirmPw(''); setShowPw(false) }}
                          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-400 transition hover:border-amber-500/40 hover:text-amber-400"
                        >
                          <KeyRound size={11} /> Contraseña
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create user modal ─────────────────────────────────── */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <UserPlus size={16} className="text-amber-400" />
                <h2 className="text-sm font-semibold text-white">Nuevo usuario</h2>
              </div>
              <button onClick={() => setShowCreate(false)} className="text-zinc-500 hover:text-white transition">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Nombre completo *</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="Juan Pérez"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition" />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Email *</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                    placeholder="juan@armglobal.cl"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Contraseña *</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl px-4 pr-10 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Rol</label>
                  <div className="relative">
                    <Shield size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <select value={newRole} onChange={e => setNewRole(e.target.value as Role)}
                      className="w-full bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition">
                      <option value="voluntario">Voluntario</option>
                      <option value="admin">Admin</option>
                      <option value="adm_merch">ADM Merch</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Campus</label>
                  <div className="relative">
                    <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <select value={newCampus} onChange={e => setNewCampus(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition">
                      <option value="">Sin campus</option>
                      {campus.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl py-2.5 text-sm transition">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 font-bold rounded-xl py-2.5 text-sm transition flex items-center justify-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {saving ? 'Creando...' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit user modal ───────────────────────────────────── */}
      {editUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setEditUser(null) }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div>
                <h2 className="text-sm font-semibold text-white">Editar usuario</h2>
                <p className="text-[10px] text-zinc-500">{editUser.email}</p>
              </div>
              <button onClick={() => setEditUser(null)} className="text-zinc-500 hover:text-white transition">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">
                  Nombre completo *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">
                  Correo *
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
                <p className="mt-1 text-[10px] text-zinc-500">
                  Este cambio también actualiza el correo de login en Supabase Auth.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Rol</label>
                  <div className="relative">
                    <Shield size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <select
                      value={editRole}
                      onChange={e => setEditRole(e.target.value as Role)}
                      className="w-full bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition"
                    >
                      <option value="voluntario">Voluntario</option>
                      <option value="admin">Admin</option>
                      <option value="adm_merch">ADM Merch</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">Campus</label>
                  <div className="relative">
                    <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <select
                      value={editCampus}
                      onChange={e => setEditCampus(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition"
                    >
                      <option value="">Sin campus</option>
                      {campus.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <label className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">Usuario activo</p>
                  <p className="text-[10px] text-zinc-500">Permite acceso operativo al sistema.</p>
                </div>
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={e => setEditActive(e.target.checked)}
                  className="h-4 w-4"
                />
              </label>

              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl py-2.5 text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 font-bold rounded-xl py-2.5 text-sm transition flex items-center justify-center gap-2"
                >
                  {savingEdit && <Loader2 size={14} className="animate-spin" />}
                  {savingEdit ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Change password modal ─────────────────────────────── */}
      {pwUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) { setPwUser(null); setNewPw(''); setConfirmPw('') } }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <KeyRound size={16} className="text-amber-400" />
                <div>
                  <h2 className="text-sm font-semibold text-white">Cambiar contraseña</h2>
                  <p className="text-[10px] text-zinc-500">{pwUser.full_name ?? pwUser.email}</p>
                </div>
              </div>
              <button onClick={() => { setPwUser(null); setNewPw(''); setConfirmPw('') }}
                className="text-zinc-500 hover:text-white transition">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">
                  Nueva contraseña *
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={newPw} onChange={e => setNewPw(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 rounded-xl px-4 pr-10 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">
                  Confirmar contraseña *
                </label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Repite la contraseña"
                  className={`w-full bg-zinc-800 border text-white placeholder-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none transition ${
                    confirmPw && newPw !== confirmPw
                      ? 'border-red-500/40 focus:border-red-500'
                      : 'border-zinc-700 focus:border-amber-500'
                  }`}
                />
                {confirmPw && newPw !== confirmPw && (
                  <p className="mt-1 text-[10px] text-red-400">Las contraseñas no coinciden</p>
                )}
              </div>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => { setPwUser(null); setNewPw(''); setConfirmPw('') }}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl py-2.5 text-sm transition">
                  Cancelar
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={savingPw || !newPw || newPw !== confirmPw}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 font-bold rounded-xl py-2.5 text-sm transition flex items-center justify-center gap-2"
                >
                  {savingPw && <Loader2 size={14} className="animate-spin" />}
                  {savingPw ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
