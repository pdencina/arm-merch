'use client'

import { useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'
import { toast } from 'sonner'

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
}

export default function ReadersManager() {
  const supabase = createClient()

  const [campuses, setCampuses] = useState<Campus[]>([])
  const [readers, setReaders] = useState<SumUpReader[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [pairingCode, setPairingCode] = useState('')
  const [name, setName] = useState('')
  const [campusId, setCampusId] = useState('')

  const activeReaders = useMemo(
    () => readers.filter((reader) => reader.active).length,
    [readers]
  )

  async function loadData() {
    setLoading(true)

    const [{ data: campusData, error: campusError }, { data: readersData, error: readersError }] =
      await Promise.all([
        supabase.from('campus').select('id, name').order('name'),
        supabase.from('sumup_readers').select('*').order('created_at', { ascending: false }),
      ])

    if (campusError) toast.error(campusError.message)
    if (readersError) toast.error(readersError.message)

    setCampuses((campusData ?? []) as Campus[])
    setReaders((readersData ?? []) as SumUpReader[])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

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
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
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
    } catch (error: any) {
      toast.error(error?.message ?? 'Error inesperado al conectar SOLO')
    }

    setSaving(false)
  }

  async function handleToggleReader(reader: SumUpReader) {
    setUpdatingId(reader.id)

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
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

  function getStatusStyle(status?: string | null) {
    switch (status) {
      case 'paired':
        return 'bg-green-500/10 text-green-300 border-green-500/20'
      case 'processing':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/20'
      case 'expired':
        return 'bg-red-500/10 text-red-300 border-red-500/20'
      default:
        return 'bg-zinc-700/50 text-zinc-300 border-zinc-600'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Lectores SumUp SOLO</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Conecta y administra dispositivos SOLO por campus.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-sm text-white transition hover:bg-zinc-700"
        >
          <RefreshCw size={14} />
          Recargar
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <CreditCard size={20} />
          </div>
          <p className="mt-4 text-xs text-zinc-500">Lectores registrados</p>
          <p className="mt-1 text-2xl font-black text-white">{readers.length}</p>
        </div>

        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10 text-green-400">
            <Wifi size={20} />
          </div>
          <p className="mt-4 text-xs text-zinc-500">Activos en ARM Merch</p>
          <p className="mt-1 text-2xl font-black text-green-400">{activeReaders}</p>
        </div>

        <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
            <Store size={20} />
          </div>
          <p className="mt-4 text-xs text-zinc-500">Campus disponibles</p>
          <p className="mt-1 text-2xl font-black text-blue-400">{campuses.length}</p>
        </div>
      </div>

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
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-black placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />

          <input
            type="text"
            placeholder="Nombre, ej: SOLO Caja CPA 1"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-black placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />

          <select
            value={campusId}
            onChange={(event) => setCampusId(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-amber-500 focus:outline-none"
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
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
          >
            <Plus size={14} />
            {saving ? 'Conectando...' : 'Conectar'}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/50 p-5">
        <h2 className="mb-4 text-sm font-semibold text-white">Lectores conectados</h2>

        {loading ? (
          <div className="flex min-h-[160px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          </div>
        ) : readers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center">
            <Radio className="mx-auto text-zinc-600" size={34} />
            <p className="mt-3 text-sm text-zinc-500">Aún no hay lectores SumUp SOLO registrados.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {readers.map((reader) => (
              <div
                key={reader.id}
                className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                    <CreditCard size={20} />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">{reader.name}</p>
                      <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${getStatusStyle(reader.status)}`}>
                        {reader.status ?? 'unknown'}
                      </span>
                      <span
                        className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold ${
                          reader.active
                            ? 'bg-green-500/10 text-green-300'
                            : 'bg-red-500/10 text-red-300'
                        }`}
                      >
                        {reader.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-zinc-500">
                      {getCampusName(reader.campus_id)}
                    </p>

                    <div className="mt-2 grid gap-1 text-[11px] text-zinc-600 sm:grid-cols-2">
                      <p>Reader ID: <span className="font-mono text-zinc-400">{reader.reader_id}</span></p>
                      <p>Modelo: <span className="text-zinc-400">{reader.device_model ?? '—'}</span></p>
                      <p>Serial: <span className="font-mono text-zinc-400">{reader.serial_number ?? '—'}</span></p>
                      <p>Nombre SumUp: <span className="text-zinc-400">{reader.reader_name ?? '—'}</span></p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleReader(reader)}
                  disabled={updatingId === reader.id}
                  className="flex items-center justify-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-sm text-white transition hover:bg-zinc-700 disabled:opacity-50"
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
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
          Notas importantes
        </p>
        <div className="space-y-1.5 text-xs text-zinc-500">
          <p>• Cada SOLO queda asociado a un campus para permitir cobros separados por sede.</p>
          <p>• El código de pairing se genera desde el dispositivo y expira rápidamente.</p>
          <p>• Esta pantalla solo conecta y administra dispositivos; el cobro desde POS se implementará como siguiente etapa.</p>
        </div>
      </div>
    </div>
  )
}
