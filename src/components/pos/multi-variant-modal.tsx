'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, X } from 'lucide-react'

export type VariantStep = {
  key: string
  title: string
  subtitle?: string
  options: { label: string; value: string }[]
}

export type MultiVariantResult = Record<string, string>

interface MultiVariantModalProps {
  open: boolean
  productName: string
  steps: VariantStep[]
  price?: number
  onClose: () => void
  onComplete: (selections: MultiVariantResult) => void
}

export default function MultiVariantModal({
  open,
  productName,
  steps,
  price,
  onClose,
  onComplete,
}: MultiVariantModalProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [selections, setSelections] = useState<MultiVariantResult>({})

  function handleSelect(value: string) {
    const step = steps[currentStep]
    const newSelections = { ...selections, [step.key]: value }
    setSelections(newSelections)

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      // Último paso — completar
      onComplete(newSelections)
      // Reset
      setCurrentStep(0)
      setSelections({})
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  function handleClose() {
    setCurrentStep(0)
    setSelections({})
    onClose()
  }

  const step = steps[currentStep]
  if (!step) return null

  // Build breadcrumb of selections so far
  const breadcrumb = Object.entries(selections)
    .slice(0, currentStep)
    .map(([, val]) => val)
    .join(' · ')

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
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#9FB7A3]">
                    {productName}
                  </p>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                    Paso {currentStep + 1} de {steps.length}
                  </span>
                </div>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                  {step.title}
                </h2>
                {step.subtitle && (
                  <p className="mt-1 text-sm leading-6 text-zinc-400">{step.subtitle}</p>
                )}
                {breadcrumb && (
                  <p className="mt-2 text-xs font-semibold text-amber-400">
                    ✓ {breadcrumb}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Options */}
            <div className="max-h-[50vh] overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-2">
                {step.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className="rounded-2xl border border-white/8 bg-white/[0.035] px-4 py-3.5 text-center text-sm font-black text-white transition hover:border-[#9FB7A3]/50 hover:bg-[#9FB7A3]/10"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-white/8 px-5 py-4">
              {currentStep > 0 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-zinc-300 transition hover:bg-white/10"
                >
                  <ArrowLeft size={14} />
                  Atrás
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white"
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
