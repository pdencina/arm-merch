import { createClient } from '@/lib/supabase/server'
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)

const fmtDate = (d: string) =>
  new Intl.DateTimeFormat('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(d))

const TYPE_CONFIG = {
  entrada: { label: 'Entrada', icon: TrendingUp,   color: 'text-green-400',  bg: 'bg-green-500/10' },
  salida:  { label: 'Salida',  icon: TrendingDown, color: 'text-red-400',    bg: 'bg-red-500/10'   },
  ajuste:  { label: 'Ajuste',  icon: RefreshCw,    color: 'text-blue-400',   bg: 'bg-blue-500/10'  },
}

type MovementType = 'entrada' | 'salida' | 'ajuste'

interface Movement {
  id: string
  type: MovementType
  quantity: number
  notes: string | null
  created_at: string
  product: { name: string; sku: string | null } | null
  created_by_profile: { full_name: string } | null
}

export default async function MovementsPage() {
  const supabase = await createClient()

  const { data: raw } = await supabase
    .from('inventory_movements')
    .select(`
      id, type, quantity, notes, created_at,
      product:products(name, sku),
      created_by_profile:profiles(full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  const movements = (raw ?? []) as unknown as Movement[]

  return (
    <div className="flex flex-col gap-5">

      <div>
        <h1 className="text-lg font-semibold text-white">Historial de movimientos</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Registro de entradas, salidas y ajustes de stock</p>
      </div>

      <div className="bg-zinc-800/30 rounded-xl border border-zinc-700/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700/60">
                {['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Responsable', 'Notas'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movements.map(m => {
                const cfg = TYPE_CONFIG[m.type] ?? TYPE_CONFIG.ajuste
                const Icon = cfg.icon
                return (
                  <tr key={m.id} className="border-b border-zinc-700/30 hover:bg-zinc-700/20 transition">
                    <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
                      {fmtDate(m.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-zinc-200 text-xs font-medium">{m.product?.name ?? '—'}</p>
                      <p className="text-zinc-600 text-[10px] font-mono">{m.product?.sku ?? ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold
                                       px-2 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
                        <Icon size={10} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-bold ${
                        m.type === 'entrada' ? 'text-green-400' :
                        m.type === 'salida'  ? 'text-red-400'   : 'text-blue-400'
                      }`}>
                        {m.type === 'entrada' ? '+' : '−'}{m.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {m.created_by_profile?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600 max-w-[200px] truncate">
                      {m.notes ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {movements.length === 0 && (
          <div className="py-14 text-center">
            <p className="text-zinc-600 text-sm">No hay movimientos registrados</p>
          </div>
        )}
      </div>
    </div>
  )
}
