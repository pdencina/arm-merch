'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Activity,
  AlertCircle,
  Calendar,
  Database,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
} from 'lucide-react'

type AuditLog = {
  id: string
  actor_id: string | null
  action: string
  target_type: string | null
  target_id: string | null
  metadata: Record<string, any> | null
  created_at: string
}

type Profile = {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getActionLabel(action: string) {
  const labels: Record<string, string> = {
    'cash.open': 'Apertura de caja',
    'cash.close': 'Cierre de caja',
    'product.create': 'Producto creado',
    'product.edit': 'Producto editado',
    'product.delete': 'Producto eliminado',
    'users.update': 'Usuario actualizado',
    'user.edit': 'Usuario editado',
    'user.role.change': 'Cambio de rol',
    'user.password.change': 'Cambio de contraseña',
    'inventory.adjust': 'Ajuste de inventario',
    'order.create': 'Venta registrada',
  }

  return labels[action] ?? action
}

function getActionTone(action: string) {
  if (action.includes('delete') || action.includes('password')) {
    return 'border-red-500/20 bg-red-500/10 text-red-300'
  }

  if (action.includes('role') || action.includes('permission')) {
    return 'border-purple-500/20 bg-purple-500/10 text-purple-300'
  }

  if (action.includes('cash')) {
    return 'border-amber-500/20 bg-amber-500/10 text-amber-300'
  }

  if (action.includes('product') || action.includes('inventory')) {
    return 'border-blue-500/20 bg-blue-500/10 text-blue-300'
  }

  return 'border-zinc-700 bg-zinc-800 text-zinc-300'
}

function stringifyMetadata(metadata: Record<string, any> | null) {
  if (!metadata || Object.keys(metadata).length === 0) return 'Sin detalle'

  try {
    return JSON.stringify(metadata, null, 2)
  } catch {
    return 'Detalle no disponible'
  }
}

export default function AuditPage() {
  const supabase = createClient()

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  async function load(silent = false) {
    if (silent) setRefreshing(true)
    else setLoading(true)

    setError(null)

    try {
      const { data: auditData, error: auditError } = await supabase
        .from('audit_logs')
        .select('id, actor_id, action, target_type, target_id, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(100)

      if (auditError) {
        setError(auditError.message)
        return
      }

      const rows = (auditData ?? []) as AuditLog[]
      setLogs(rows)

      const actorIds = Array.from(
        new Set(rows.map((log) => log.actor_id).filter(Boolean)),
      ) as string[]

      if (actorIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .in('id', actorIds)

        const map: Record<string, Profile> = {}

        ;(profileData ?? []).forEach((profile: any) => {
          map[profile.id] = profile
        })

        setProfiles(map)
      } else {
        setProfiles({})
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error cargando auditoría')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const actionOptions = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.action))).filter(Boolean)
  }, [logs])

  const filteredLogs = useMemo(() => {
    const text = search.trim().toLowerCase()

    return logs.filter((log) => {
      const actor = log.actor_id ? profiles[log.actor_id] : null

      const searchable = [
        log.action,
        getActionLabel(log.action),
        log.target_type,
        log.target_id,
        actor?.full_name,
        actor?.email,
        stringifyMetadata(log.metadata),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = !text || searchable.includes(text)
      const matchesAction = !actionFilter || log.action === actionFilter

      return matchesSearch && matchesAction
    })
  }, [logs, profiles, search, actionFilter])

  if (loading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-amber-400" />
            <h1 className="text-lg font-semibold text-white">Auditoría</h1>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Registro de acciones críticas del sistema ARM Merch.
          </p>
        </div>

        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:border-amber-500/40 hover:text-amber-300 disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
            <Activity size={17} className="text-amber-400" />
          </div>
          <p className="mt-3 text-xs text-zinc-500">Eventos cargados</p>
          <p className="mt-1 text-2xl font-bold text-white">{logs.length}</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10">
            <Database size={17} className="text-blue-400" />
          </div>
          <p className="mt-3 text-xs text-zinc-500">Tipos de acción</p>
          <p className="mt-1 text-2xl font-bold text-white">{actionOptions.length}</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10">
            <User size={17} className="text-purple-400" />
          </div>
          <p className="mt-3 text-xs text-zinc-500">Usuarios detectados</p>
          <p className="mt-1 text-2xl font-bold text-white">{Object.keys(profiles).length}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <p className="text-sm font-semibold">Error cargando auditoría</p>
          </div>
          <p className="mt-2 text-sm text-red-300/80">{error}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 xl:flex-row">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por usuario, acción, entidad o detalle..."
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-11 py-3 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
        >
          <option value="">Todas las acciones</option>
          {actionOptions.map((action) => (
            <option key={action} value={action}>
              {getActionLabel(action)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="grid grid-cols-[1.2fr_1.2fr_1fr_1.5fr] gap-4 border-b border-zinc-800 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-zinc-500 max-xl:hidden">
          <div>Fecha</div>
          <div>Usuario</div>
          <div>Acción</div>
          <div>Detalle</div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
            <FileText size={34} className="text-zinc-700" />
            <p className="mt-3 text-sm font-medium text-zinc-400">
              Todavía no hay eventos de auditoría.
            </p>
            <p className="mt-1 max-w-md text-xs leading-5 text-zinc-600">
              La tabla ya está lista. Cuando conectemos eventos como cierre de caja,
              cambios de productos o usuarios, aparecerán en esta pantalla.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {filteredLogs.map((log) => {
              const actor = log.actor_id ? profiles[log.actor_id] : null

              return (
                <div
                  key={log.id}
                  className="grid grid-cols-1 gap-3 px-5 py-4 transition hover:bg-zinc-800/30 xl:grid-cols-[1.2fr_1.2fr_1fr_1.5fr]"
                >
                  <div>
                    <p className="flex items-center gap-2 text-sm text-zinc-300">
                      <Calendar size={13} className="text-zinc-500" />
                      {formatDate(log.created_at)}
                    </p>
                    <p className="mt-1 text-[10px] text-zinc-600">{log.id}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-white">
                      {actor?.full_name ?? 'Sistema / desconocido'}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {actor?.email ?? log.actor_id ?? '—'}
                    </p>
                  </div>

                  <div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getActionTone(log.action)}`}>
                      {getActionLabel(log.action)}
                    </span>
                    {(log.target_type || log.target_id) && (
                      <p className="mt-2 text-[11px] text-zinc-500">
                        {log.target_type ?? 'target'} · {log.target_id ?? '—'}
                      </p>
                    )}
                  </div>

                  <div>
                    <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-950/70 p-3 text-[11px] leading-5 text-zinc-400">
                      {stringifyMetadata(log.metadata)}
                    </pre>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
