'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body style={{ background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#a1a1aa', fontSize: '14px', marginBottom: '16px' }}>Error crítico de aplicación</p>
          <button
            onClick={reset}
            style={{ background: '#f59e0b', color: '#0f0f0f', fontWeight: 'bold', borderRadius: '12px', padding: '8px 16px', border: 'none', cursor: 'pointer' }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  )
}
