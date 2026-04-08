'use client'

import { AlertTriangle, PackageX } from 'lucide-react'
import type { Product } from '@/types'

interface Props {
  lowStock: Product[]
  outOfStock: Product[]
  onAdjust: (product: Product) => void
}

export default function LowStockAlert({ lowStock, outOfStock, onAdjust }: Props) {
  return (
    <div className="flex flex-col gap-3">

      {outOfStock.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <PackageX size={14} className="text-red-400" />
            <span className="text-xs font-semibold text-red-400">
              {outOfStock.length} producto{outOfStock.length > 1 ? 's' : ''} sin stock
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {outOfStock.map(p => (
              <button
                key={p.id}
                onClick={() => onAdjust(p)}
                className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-300
                           border border-red-500/20 px-3 py-1.5 rounded-lg transition"
              >
                {p.name} · 0 uds.
              </button>
            ))}
          </div>
        </div>
      )}

      {lowStock.length > 0 && (
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-orange-400" />
            <span className="text-xs font-semibold text-orange-400">
              {lowStock.length} producto{lowStock.length > 1 ? 's' : ''} con stock bajo
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map(p => (
              <button
                key={p.id}
                onClick={() => onAdjust(p)}
                className="text-xs bg-orange-500/10 hover:bg-orange-500/20 text-orange-300
                           border border-orange-500/20 px-3 py-1.5 rounded-lg transition"
              >
                {p.name} · {p.stock} uds.
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
