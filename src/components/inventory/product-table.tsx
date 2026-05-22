'use client'

import Image from 'next/image'
import { ArrowUpDown, ArrowDownUp, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import StockBadge from './stock-badge'

type SortKey = 'name' | 'stock' | 'price'
type SortDir = 'asc' | 'desc'

interface Props {
  products: any[]
  campus: { id: string; name: string }[]
  onMovement: (product: any) => void
  onSetZero: (product: any) => void
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)

const CAMPUS_COLORS: Record<string, string> = {
  'ARM Santiago':    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'ARM Puente Alto': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'ARM Punta Arenas':'bg-teal-500/10 text-teal-400 border-teal-500/20',
  'ARM Montevideo':  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'ARM Maracaibo':   'bg-red-500/10 text-red-400 border-red-500/20',
}

export default function ProductTable({ products, campus, onMovement, onSetZero }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...products].sort((a, b) => {
    let va: any, vb: any
    if (sortKey === 'name')  { va = a.name; vb = b.name }
    else if (sortKey === 'stock') { va = a.stock ?? 0; vb = b.stock ?? 0 }
    else { va = a.price; vb = b.price }
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  function SortBtn({ col }: { col: SortKey }) {
    const active = sortKey === col
    return (
      <button onClick={() => toggleSort(col)} className="ml-1 opacity-50 hover:opacity-100 transition">
        {active && sortDir === 'desc'
          ? <ArrowDownUp size={12} className="text-amber-400" />
          : <ArrowUpDown size={12} className={active ? 'text-amber-400' : ''} />}
      </button>
    )
  }

  if (sorted.length === 0) {
    return (
      <div className="bg-zinc-800/30 rounded-xl border border-zinc-700/40 py-14 text-center">
        <p className="text-zinc-600 text-sm">No hay productos que coincidan</p>
      </div>
    )
  }

  return (
    <div className="bg-zinc-800/30 rounded-xl border border-zinc-700/40 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700/60">
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 w-10">#</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">
                <span className="flex items-center">Producto <SortBtn col="name" /></span>
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 hidden sm:table-cell">Categoría</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 hidden md:table-cell">SKU</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">
                <span className="flex items-center">Campus</span>
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500">
                <span className="flex items-center justify-end">Precio <SortBtn col="price" /></span>
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500">
                <span className="flex items-center justify-end">Stock <SortBtn col="stock" /></span>
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500">Estado</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((product, idx) => {
              const campusName  = product.campus_name ?? null
              const campusColor = campusName ? (CAMPUS_COLORS[campusName] ?? 'bg-zinc-700/50 text-zinc-400 border-zinc-600/20') : null

              return (
                <tr key={`${product.id}-${product.campus_id}`}
                  className="border-b border-zinc-700/30 hover:bg-zinc-700/20 transition">
                  <td className="px-4 py-3 text-xs text-zinc-600">{idx + 1}</td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-zinc-700 overflow-hidden flex items-center justify-center shrink-0">
                        {product.image_url
                          ? <Image src={product.image_url} alt={product.name} width={36} height={36} className="object-cover w-full h-full" />
                          : <span className="text-base">📦</span>}
                      </div>
                      <span className="text-zinc-200 font-medium text-sm">{product.name}</span>
                    </div>
                  </td>

                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs text-zinc-500 bg-zinc-700/50 px-2 py-1 rounded-lg">
                      {product.category_name ?? '—'}
                    </span>
                  </td>

                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-zinc-600 font-mono">{product.sku ?? '—'}</span>
                  </td>

                  {/* Campus badge */}
                  <td className="px-4 py-3">
                    {campusName
                      ? <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border whitespace-nowrap ${campusColor}`}>
                          {campusName}
                        </span>
                      : <span className="text-xs text-zinc-600">—</span>
                    }
                  </td>

                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-semibold text-amber-400">{fmt(product.price)}</span>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-bold text-white">{product.stock ?? 0}</span>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <StockBadge stock={product.stock ?? 0} alert={product.low_stock_alert ?? 5} />
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onSetZero(product)}
                        className="flex items-center gap-1 text-xs bg-red-500/10 hover:bg-red-500/20
                                   text-red-400 border border-red-500/20 hover:border-red-500/40
                                   px-3 py-1.5 rounded-lg transition font-medium"
                      >
                        <AlertTriangle size={12} />
                        Stock 0
                      </button>

                      <button
                        onClick={() => onMovement(product)}
                        className="text-xs bg-zinc-700 hover:bg-amber-500/20 hover:text-amber-400
                                   text-zinc-400 border border-zinc-600 hover:border-amber-500/40
                                   px-3 py-1.5 rounded-lg transition font-medium"
                      >
                        Ajustar
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
