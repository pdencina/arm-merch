'use client'

import { useEffect, useState } from 'react'
import { MapPin, ChevronDown, Building2, Globe } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCampusSelector } from '@/lib/hooks/use-campus-selector'
import { clsx } from 'clsx'

interface CampusSelectorProps {
  role: string
  userCampusId?: string | null
}

export default function CampusSelector({ role, userCampusId }: CampusSelectorProps) {
  const {
    selectedCampusId,
    selectedCampusName,
    campusList,
    setSelectedCampus,
    setCampusList,
    clearSelection,
  } = useCampusSelector()

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const isGlobalRole = role === 'super_admin' || role === 'adm_merch'

  // Non-global roles don't get a selector
  if (!isGlobalRole) return null

  useEffect(() => {
    async function loadCampus() {
      if (campusList.length > 0) return
      setLoading(true)

      const supabase = createClient()
      const { data } = await supabase
        .from('campus')
        .select('id, name, city')
        .eq('active', true)
        .order('name')

      setCampusList(data ?? [])
      setLoading(false)
    }

    loadCampus()
  }, [campusList.length, setCampusList])

  const displayName = selectedCampusId
    ? selectedCampusName ?? 'Campus seleccionado'
    : 'Todos los campus'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all',
          selectedCampusId
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15'
            : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800'
        )}
      >
        {selectedCampusId ? <MapPin size={14} /> : <Globe size={14} />}
        <span className="max-w-[120px] truncate">{displayName}</span>
        <ChevronDown size={12} className={clsx('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-full z-[110] mt-2 w-64 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
            <div className="border-b border-zinc-800 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Seleccionar campus
              </p>
            </div>

            <div className="max-h-64 overflow-y-auto p-2">
              {/* All campuses option */}
              <button
                onClick={() => {
                  clearSelection()
                  setOpen(false)
                }}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition',
                  !selectedCampusId
                    ? 'bg-amber-500/10 font-semibold text-amber-300'
                    : 'text-zinc-300 hover:bg-zinc-800'
                )}
              >
                <Globe size={16} />
                <div>
                  <p className="font-medium">Todos los campus</p>
                  <p className="text-[10px] text-zinc-500">Vista global consolidada</p>
                </div>
              </button>

              {loading && (
                <div className="flex items-center justify-center py-4">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                </div>
              )}

              {campusList.map((campus) => (
                <button
                  key={campus.id}
                  onClick={() => {
                    setSelectedCampus(campus.id, campus.name)
                    setOpen(false)
                  }}
                  className={clsx(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition',
                    selectedCampusId === campus.id
                      ? 'bg-amber-500/10 font-semibold text-amber-300'
                      : 'text-zinc-300 hover:bg-zinc-800'
                  )}
                >
                  <Building2 size={16} />
                  <div>
                    <p className="font-medium">{campus.name}</p>
                    {campus.city && (
                      <p className="text-[10px] text-zinc-500">{campus.city}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
