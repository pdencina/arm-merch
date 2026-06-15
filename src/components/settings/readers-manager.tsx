'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  CreditCard,
  Plus,
  RefreshCw,
  Radio,
  Store,
  ToggleLeft,
  ToggleRight,
  Wifi,
  WifiOff,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Globe,
  Clock,
  Signal,
} from 'lucide-react'
import { toast } from 'sonner'
import { clsx } from 'clsx'

type Campus = {
  id: string
  name: string
}

type SumUpReader = {
  id: string
  campus_id: string | null
  name: string
  reader_id: string
  reader_name: string | null
  device_model: string | null
  serial_number: string | null
  status: string | null
  active: boolean
  metadata: any
  created_at: string
  // Enriched from status API
  sumup_status?: string | null
  sumup_online?: boolean
  last_seen?: string | null
  device_info?: any
}

type ApiStatus = {
  api_connected: boolean
  api_latency_ms: number | null
  api_error: string | null
  config: {
    hasApiKey: boolean
    hasMerchantCode: boolean
    apiBase: string
  }
  merchant: {
    merchant_code: string
    business_name: string | null
    country: string | null
    email: string | null
  } | null
  readers: SumUpReader[]
  readers_total: number
  readers_online: number
  checked_at: string
}

export default function ReadersManager() {
  const supabase = createClient()

  const [campuses, setCampuses] = useState<Campus[]>([])
  const [readers, setReaders] = useState<SumUpReader[]>([])
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [pairingCode, setPairingCode] = useState('')
  const [name, setName] = useState('')
  const [campusId, setCampusId] = useState('')

  const activeReaders = useMemo(
    () => readers.filter((reader) => reader.active).length,
    [readers]
  )

  const onlineReaders = useMemo(
    () => readers.filter((reader) => reader.sumup_online).length,
    [readers]
  )

  const getSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  }, [supabase])

  async function loadData() {
    setLoading(true)

    const [{ data: campusData }, { data: readersData }] = await Promise.all([
      supabase.from('campus').select('id, name').order('name'),
      supabase.from('sumup_readers').select('*').order('created_at', { ascending: false }),
    ])

    setCampuses((campusData ?? []) as Campus[])
    setReaders((readersData ?? []) as SumUpReader[])
    setLoading(false)
  }

  async function checkApiStatus() {
    setCheckingStatus(true)

    try {
      const session = await getSession()
      if (!session?.access_token) {
        toast.error('No autenticado')
        setCheckingStatus(false)
        return
      }

      const res = await fetch('/api/sumup/readers/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Error al verificar conexión')
        setCheckingStatus(false)
        return
      }

      setApiStatus(data)
      setReaders(data.readers ?? [])

      if (data.api_connected) {
        toast.success(`API SumUp conectada (${data.api_latency_ms}ms)`)
      } else {
        toast.error(`API desconectada: ${data.api_error}`)
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Error verificando estado')
    }

    setCheckingStatus(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  // Auto-check status on first load
  useEffect(() => {
    if (!loading && readers.length >= 0) {
      checkApiStatus()
    }
  }, [loading])

  async function handlePairReader(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const cleanPairingCode = pairingCode.trim().toUpperCase()
    const cleanName = name.trim()

    if (!cleanPairingCode) {
      toast.error('Ingresa el código de pairing del SOLO')
      return
    }

    if (!cleanName) {
      toast.error('Ingresa un nombre para identificar el dispositivo')
      return
    }

    if (!campusId) {
      toast.error('Selecciona un campus')
      return
    }

    setSaving(true)

    try {
      const session = await getSession()
      if (!session?.access_token) {
        toast.error('No autenticado')
        setSaving(false)
        return
      }

      const res = await fetch('/api/sumup/readers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          pairing_code: cleanPairingCode,
          name: cleanName,
          campus_id: campusId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo conectar el SOLO')
        setSaving(false)
        return
      }

      toast.success('SOLO conectado correctamente')
      setPairingCode('')
      setName('')
      setCampusId('')
      await loadData()
      await checkApiStatus()
    } catch (error: any) {
      toast.error(error?.message ?? 'Error inesperado al conectar SOLO')
    }

    setSaving(false)
  }

  async function handleToggleReader(reader: SumUpReader) {
    setUpdatingId(reader.id)

    try {
      const session = await getSession()
      if (!session?.access_token) {
        toast.error('No autenticado')
        setUpdatingId(null)
        return
      }

      const res = await fetch('/api/sumup/readers', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: reader.id,
          active: !reader.active,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo actualizar el lector')
        setUpdatingId(null)
        return
      }

      toast.success(reader.active ? 'Lector desactivado' : 'Lector activado')
      await loadData()
    } catch (error: any) {
      toast.error(error?.message ?? 'Error inesperado al actualizar lector')
    }

    setUpdatingId(null)
  }

  function getCampusName(id?: string | null) {
    if (!id) return 'Sin campus'
    return campuses.find((campus) => campus.id === id)?.name ?? 'Campus no encontrado'
  }

  function getReaderStatusConfig(reader: SumUpReader) {
    const status = reader.sumup_status ?? reader.status

    if (reader.sumup_online) {
      return {
        label: 'Conectado',
        color: 'bg-green-500/10 text-green-400 border-green-500/20',
        icon: <Signal size={12} className="text-green-400" />,
        dot: 'bg-green-400',
        pulse: true,
      }
    }

    switch (status) {
      case 'paired':
        return {
          label: 'Pareado',
          color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
          icon: <CheckCircle2 size={12} />,
          dot: 'bg-emerald-400',
          pulse: false,
        }
      case 'online':
        return {
          label: 'En línea',
          color: 'bg-green-500/10 text-green-300 border-green-500/20',
          icon: <Wifi size={12} />,
          dot: 'bg-green-400',
          pulse: true,
        }
      case 'offline':
        return {
          label: 'Sin conexión',
          color: 'bg-red-500/10 text-red-300 border-red-500/20',
          icon: <WifiOff size={12} />,
          dot: 'bg-red-400',
          pulse: false,
        }
      case 'expired':
        return {
          label: 'Expirado',
          color: 'bg-red-500/10 text-red-300 border-red-500/20',
          icon: <XCircle size={12} />,
          dot: 'bg-red-400',
          pulse: false,
        }
      case 'processing':
        return {
          label: 'Procesando',
          color: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
          icon: <Activity size={12} />,
          dot: 'bg-amber-400',
          pulse: true,
        }
      default:
        return {
          label: status ?? 'Desconocido',
          color: 'bg-zinc-700/50 text-zinc-400 border-zinc-600',
          icon: <AlertTriangle size={12} />,
          dot: 'bg-zinc-500',
          pulse: false,
        }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <CreditCard size={20} className="text-amber-400" />
            Lectores SumUp SOLO
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Conecta, monitorea y administra dispositivos SOLO por campus.
          </p>
        </div>

        <button
          type="button"
          onClick={checkApiStatus}
          disabled={checkingStatus}
          className="flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-sm text-white transition hover:bg-zinc-700 disabled:opacity-50"
        >
          <RefreshCw size={14} className={checkingStatus ? 'animate-spin' : ''} />
          {checkingStatus ? 'Verificando...' : 'Verificar conexión'}
        </button>
      </div>

      {/* Diagnóstico de conexión API */}
      <div className={clsx(
        'rounded-2xl border p-5 transition-all',
        apiStatus?.api_connected
          ? 'border-green-500/20 bg-green-500/5'
          : apiStatus === null
            ? 'border-zinc-700/60 bg-zinc-900/50'
            : 'border-red-500/20 bg-red-500/5'
      )}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={clsx(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
              apiStatus?.api_connected
                ? 'bg-green-500/15'
                : apiStatus === null
                  ? 'bg-zinc-800'
                  : 'bg-red-500/15'
            )}>
              {apiStatus?.api_connected ? (
                <Globe size={20} className="text-green-400" />
              ) : apiStatus === null ? (
                <Globe size={20} className="text-zinc-500" />
              ) : (
                <WifiOff size={20} className="text-red-400" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-white">
                  {apiStatus?.api_connected
                    ? 'API SumUp conectada'
                    : apiStatus === null
                      ? 'Estado de conexión desconocido'
                      : 'API SumUp desconectada'}
                </p>
                {apiStatus?.api_connected && (
                  <span className="flex items-center gap-1 rounded-lg border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-300">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
                    </span>
                    Online
                  </span>
                )}
              </div>

              {apiStatus?.api_connected && apiStatus?.merchant && (
                <div className="mt-2 grid gap-1 text-xs text-zinc-500 sm:grid-cols-2">
                  <p>Comercio: <span className="text-zinc-300">{apiStatus.merchant.business_name ?? '—'}</span></p>
                  <p>Código: <span className="font-mono text-zinc-300">{apiStatus.merchant.merchant_code}</span></p>
                  {apiStatus.merchant.email && (
                    <p>Email: <span className="text-zinc-300">{apiStatus.merchant.email}</span></p>
                  )}
                  {apiStatus.merchant.country && (
                    <p>País: <span className="text-zinc-300">{apiStatus.merchant.country}</span></p>
                  )}
                </div>
              )}

              {apiStatus?.api_error && (
                <p className="mt-2 text-xs text-red-400">
                  Error: {apiStatus.api_error}
                </p>
              )}

              {!apiStatus?.config?.hasApiKey && apiStatus !== null && (
                <p className="mt-2 text-xs text-amber-400">
                  ⚠️ SUMUP_API_KEY no está configurada en las variables de entorno.
                </p>
              )}
              {!apiStatus?.config?.hasMerchantCode && apiStatus !== null && (
                <p className="mt-1 text-xs text-amber-400">
                  ⚠️ SUMUP_MERCHANT_CODE no está configurada.
                </p>
              )}
            </div>
          </div>

          {apiStatus?.api_latency_ms && (
            <div className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-xs">
              <Zap size={12} className="text-amber-400" />
              <span className="text-zinc-300">{apiStatus.api_latency_ms}ms</span>
            </div>
          )}
        </div>

        {apiStatus?.checked_at && (
          <p className="mt-3 flex items-center gap-1 border-t border-white/5 pt-3 text-[10px] text-zinc-600">
            <Clock size={10} />
            Última verificación: {new Date(apiStatus.checked_at).toLocaleString('es-CL')}
          </p>
        )}
      </div>

      {/* Métricas */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <CreditCard size={18} />
          </div>
          <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Registrados</p>
          <p className="mt-0.5 text-2xl font-black text-white">{readers.length}</p>
        </div>

        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-500/10 text-green-400">
            <Wifi size={18} />
          </div>
          <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Conectados</p>
          <p className="mt-0.5 text-2xl font-black text-green-400">{onlineReaders}</p>
        </div>

        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
            <Activity size={18} />
          </div>
          <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Activos</p>
          <p className="mt-0.5 text-2xl font-black text-blue-400">{activeReaders}</p>
        </div>

        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
            <Store size={18} />
          </div>
          <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Campus</p>
          <p className="mt-0.5 text-2xl font-black text-violet-400">{campuses.length}</p>
        </div>
      </div>

      {/* Conectar nuevo */}
      <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-white">Conectar nuevo SOLO</h2>
          <p className="mt-1 text-xs text-zinc-500">
            En el dispositivo: Settings → Cloud API → Pair device. Ingresa el código antes de que expire.
          </p>
        </div>

        <form onSubmit={handlePairReader} className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <input
            type="text"
            placeholder="Código pairing, ej: ABC12345"
            value={pairingCode}
            onChange={(event) => setPairingCode(event.target.value.toUpperCase())}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />

          <input
            type="text"
            placeholder="Nombre, ej: SOLO Caja CPA 1"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />

          <select
            value={campusId}
            onChange={(event) => setCampusId(event.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
          >
            <option value="">Selecciona campus</option>
            {campuses.map((campus) => (
              <option key={campus.id} value={campus.id}>
                {campus.name}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-50"
          >
            <Plus size={14} />
            {saving ? 'Conectando...' : 'Conectar'}
          </button>
        </form>
      </div>

      {/* Lectores */}
      <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Dispositivos registrados</h2>
          <span className="text-[10px] text-zinc-600">
            {readers.length} lector{readers.length !== 1 ? 'es' : ''}
          </span>
        </div>

        {loading ? (
          <div className="flex min-h-[160px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          </div>
        ) : readers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center">
            <Radio className="mx-auto text-zinc-600" size={34} />
            <p className="mt-3 text-sm text-zinc-500">Aún no hay lectores SumUp SOLO registrados.</p>
            <p className="mt-1 text-xs text-zinc-600">Conecta uno usando el formulario de arriba.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {readers.map((reader) => {
              const statusConfig = getReaderStatusConfig(reader)

              return (
                <div
                  key={reader.id}
                  className={clsx(
                    'rounded-2xl border p-4 transition-all',
                    reader.sumup_online
                      ? 'border-green-500/15 bg-green-500/[0.02]'
                      : 'border-zinc-800 bg-zinc-950/50'
                  )}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                      <div className={clsx(
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                        reader.sumup_online
                          ? 'bg-green-500/10'
                          : reader.active
                            ? 'bg-amber-500/10'
                            : 'bg-zinc-800'
                      )}>
                        <CreditCard size={22} className={
                          reader.sumup_online
                            ? 'text-green-400'
                            : reader.active
                              ? 'text-amber-400'
                              : 'text-zinc-600'
                        } />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-white">{reader.name}</p>

                          {/* Status badge */}
                          <span className={clsx(
                            'flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold',
                            statusConfig.color
                          )}>
                            {statusConfig.pulse && (
                              <span className="relative flex h-1.5 w-1.5">
                                <span className={clsx('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', statusConfig.dot)} />
                                <span className={clsx('relative inline-flex h-1.5 w-1.5 rounded-full', statusConfig.dot)} />
                              </span>
                            )}
                            {!statusConfig.pulse && (
                              <span className={clsx('h-1.5 w-1.5 rounded-full', statusConfig.dot)} />
                            )}
                            {statusConfig.label}
                          </span>

                          {/* Active/Inactive */}
                          <span className={clsx(
                            'rounded-lg px-2 py-0.5 text-[10px] font-bold',
                            reader.active
                              ? 'bg-blue-500/10 text-blue-300'
                              : 'bg-zinc-700/50 text-zinc-500'
                          )}>
                            {reader.active ? 'Habilitado' : 'Deshabilitado'}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-zinc-500">
                          {getCampusName(reader.campus_id)}
                        </p>

                        <div className="mt-2 grid gap-x-4 gap-y-1 text-[11px] text-zinc-600 sm:grid-cols-2">
                          <p>Reader ID: <span className="font-mono text-zinc-400">{reader.reader_id}</span></p>
                          <p>Modelo: <span className="text-zinc-400">{reader.device_model ?? '—'}</span></p>
                          <p>Serial: <span className="font-mono text-zinc-400">{reader.serial_number ?? '—'}</span></p>
                          {reader.last_seen && (
                            <p>Última actividad: <span className="text-zinc-400">{new Date(reader.last_seen).toLocaleString('es-CL')}</span></p>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleReader(reader)}
                      disabled={updatingId === reader.id}
                      className={clsx(
                        'flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition',
                        reader.active
                          ? 'bg-red-500/10 text-red-300 hover:bg-red-500/20'
                          : 'bg-green-500/10 text-green-300 hover:bg-green-500/20',
                        'disabled:opacity-50'
                      )}
                    >
                      {reader.active ? (
                        <ToggleRight size={18} className="text-green-400" />
                      ) : (
                        <ToggleLeft size={18} className="text-zinc-500" />
                      )}

                      {updatingId === reader.id
                        ? 'Actualizando...'
                        : reader.active
                          ? 'Desactivar'
                          : 'Activar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Notas */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Información
        </p>
        <div className="space-y-1.5 text-xs text-zinc-500">
          <p>• El botón "Verificar conexión" consulta la API de SumUp en tiempo real y actualiza el estado de cada lector.</p>
          <p>• Cada SOLO queda asociado a un campus para permitir cobros separados por sede.</p>
          <p>• Un lector con estado "Conectado" significa que SumUp lo reconoce como activo y listo para recibir cobros.</p>
          <p>• Si un lector aparece como "Sin conexión", verifica que esté encendido y conectado a WiFi.</p>
          <p>• El código de pairing se genera desde el dispositivo y expira rápidamente (menos de 60 segundos).</p>
        </div>
      </div>
    </div>
  )
}
