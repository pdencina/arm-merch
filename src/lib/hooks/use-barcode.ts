'use client'

import { useEffect, useRef } from 'react'

export function useBarcode(
  onScan: (code: string) => void,
  options?: {
    minLength?: number
    timeout?: number
  }
) {
  const buffer = useRef('')
  const lastKeyTime = useRef(0)

  const minLength = options?.minLength ?? 3
  const timeout = options?.timeout ?? 90

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const isEditable = tag === 'input' || tag === 'textarea' || target?.isContentEditable

      // Si el scanner escribe en un input, ese input maneja el ENTER.
      if (isEditable) return

      const now = Date.now()

      if (now - lastKeyTime.current > timeout) {
        buffer.current = ''
      }

      lastKeyTime.current = now

      if (event.key === 'Enter') {
        const code = buffer.current.trim()

        if (code.length >= minLength) {
          onScan(code)
        }

        buffer.current = ''
        return
      }

      if (event.key.length === 1) {
        buffer.current += event.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onScan, minLength, timeout])
}
