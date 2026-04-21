'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

type Props = {
  open: boolean
  type: 'success' | 'error' | 'loading'
  title: string
  description?: string
  onClose?: () => void
}

function playSuccessSound() {
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext

    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()

    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(880, now)
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.18)

    gain1.gain.setValueAtTime(0.0001, now)
    gain1.gain.exponentialRampToValueAtTime(0.08, now + 0.02)
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)

    osc1.connect(gain1)
    gain1.connect(ctx.destination)

    osc1.start(now)
    osc1.stop(now + 0.22)
  } catch {}
}

function playErrorSound() {
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext

    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'square'
    osc.frequency.setValueAtTime(240, now)
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.22)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.25)
  } catch {}
}

export default function FeedbackModal({
  open,
  type,
  title,
  description,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return

    if (type === 'success') playSuccessSound()
    if (type === 'error') playErrorSound()
  }, [open, type])

  const isLoading = type === 'loading'
  const isSuccess = type === 'success'
  const isError = type === 'error'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl"
            initial={{ scale: 0.94, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500" />

            <div className="px-6 pb-6 pt-7">
              <div className="mb-5 flex justify-center">
                {isLoading && (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/20">
                    <Loader2 size={34} className="animate-spin text-amber-400" />
                  </div>
                )}

                {isSuccess && (
                  <motion.div
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 ring-1 ring-green-500/20"
                    initial={{ scale: 0.8, rotate: -8 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 18 }}
                  >
                    <CheckCircle2 size={38} className="text-green-400" />
                  </motion.div>
                )}

                {isError && (
                  <motion.div
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  >
                    <AlertTriangle size={38} className="text-red-400" />
                  </motion.div>
                )}
              </div>

              <h2 className="text-center text-2xl font-bold tracking-tight text-white">
                {title}
              </h2>

              {description && (
                <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-6 text-zinc-400">
                  {description}
                </p>
              )}

              {!isLoading && onClose && (
                <button
                  onClick={onClose}
                  className="mt-6 w-full rounded-2xl bg-amber-500 py-3 text-sm font-bold text-black transition hover:bg-amber-400 active:scale-[0.99]"
                >
                  Continuar
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}