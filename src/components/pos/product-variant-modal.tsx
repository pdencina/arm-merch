'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

export type ProductVariantOption = {
  label: string
  value: string
  price?: number
}

interface ProductVariantModalProps {
  open: boolean
  title: string
  subtitle?: string
  options: ProductVariantOption[]
  onClose: () => void
  onSelect: (option: ProductVariantOption) => void
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n)

export default function ProductVariantModal({
  open,
  title,
  subtitle = 'Selecciona una opción para agregar al carrito.',
  options,
  onClose,
  onSelect,
}: ProductVariantModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 22, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#0f1015] shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#9FB7A3]">
                  Variante requerida
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                  {title}
                </h2>
                <p className="mt-1 text-sm leading-6 text-zinc-400">
                  {subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 p-5">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSelect(option)}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-white/[0.035] px-5 py-4 text-left transition hover:border-[#9FB7A3]/50 hover:bg-[#9FB7A3]/10"
                >
                  <span className="text-base font-black text-white">
                    {option.label}
                  </span>

                  {typeof option.price === 'number' && (
                    <span className="rounded-full bg-[#9FB7A3]/15 px-3 py-1 text-sm font-black text-[#BFD0C2]">
                      {fmt(option.price)}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="border-t border-white/8 p-5 pt-0">
              <button
                type="button"
                onClick={onClose}
                className="mt-5 w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-black text-zinc-300 transition hover:bg-white/10 hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
