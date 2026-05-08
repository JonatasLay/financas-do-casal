import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Finanças do Casal 💜',
  description: 'Controle financeiro inteligente para casais',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Finanças',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#6366F1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </head>
      <body className={`${inter.className} bg-gradient-app min-h-screen`}>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: { borderRadius: '12px', fontSize: '14px' },
          }}
        />
      </body>
    </html>
  )
}
