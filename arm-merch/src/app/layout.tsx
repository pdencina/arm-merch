import type { Metadata } from 'next'
import { Inter, DM_Serif_Display, DM_Sans } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-dm-serif',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-sans',
})

export const metadata: Metadata = {
  title: 'ARM Merch',
  description: 'Sistema de Merchandising · Iglesia ARM',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${dmSerif.variable} ${dmSans.variable}`}>
      <body style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#18181b',
              border: '0.5px solid #3f3f46',
              color: '#f4f4f5',
            },
          }}
        />
      </body>
    </html>
  )
}
