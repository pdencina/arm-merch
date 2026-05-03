import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: {
    default: 'ARM Merch',
    template: '%s · ARM Merch',
  },
  description: 'Sistema de Punto de Venta · ARM Global',
  keywords: ['ARM Merch', 'POS', 'punto de venta', 'inventario', 'merch'],
  authors: [{ name: 'ARM Global' }],
  creator: 'ARM Global',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'es_CL',
    url: 'https://armerch.com',
    siteName: 'ARM Merch',
    title: 'ARM Merch — Sistema de Gestión',
    description: 'Sistema de Punto de Venta para ARM Global',
    images: [{ url: '/icon.svg', width: 512, height: 512, alt: 'ARM Merch' }],
  },
  robots: {
    index: false,  // No indexar — es sistema interno
    follow: false,
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1, // Evita zoom accidental en mobile durante ventas
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="theme-color" content="#18181b" />
      </head>
      <body>
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          duration={3500}
        />
      </body>
    </html>
  )
}
