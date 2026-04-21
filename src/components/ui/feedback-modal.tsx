'use client'

import { motion, AnimatePresence } from 'framer-motion'

type Props = {
  open: boolean
  type: 'success' | 'error' | 'loading'
  title: string
  description?: string
  onClose?: () => void
}

export default function FeedbackModal({
  open,
  type,
  title,
  description,
  onClose,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-md rounded-2xl bg-zinc-900 p-6 shadow-2xl border border-zinc-800"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <div className="flex justify-center mb-4">
              {type === 'loading' && (
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
              )}

              {type === 'success' && (
                <div className="text-green-400 text-4xl">✔</div>
              )}

              {type === 'error' && (
                <div className="text-red-400 text-4xl">✖</div>
              )}
            </div>

            <h2 className="text-center text-lg font-semibold text-white">
              {title}
            </h2>

            {description && (
              <p className="mt-2 text-center text-sm text-zinc-400">
                {description}
              </p>
            )}

            {type !== 'loading' && onClose && (
              <button
                onClick={onClose}
                className="mt-5 w-full rounded-xl bg-amber-500 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition"
              >
                Continuar
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}