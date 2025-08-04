import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ConvexProvider } from './convex-provider'
import { CrossmintProvider } from './crossmint-provider'
import { Analytics } from '../components/analytics'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'SYMLog Authentication Portal',
    template: '%s | SYMLog Auth'
  },
  description: 'Secure authentication portal for SYMLog desktop application. Sign in with Crossmint to generate authentication codes.',
  keywords: ['SYMLog', 'authentication', 'Crossmint', 'secure login', 'desktop app', 'auth portal'],
  authors: [{ name: 'SYMLog Team' }],
  creator: 'SYMLog',
  publisher: 'SYMLog',
  robots: 'index, follow',
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'SYMLog Authentication Portal',
    description: 'Secure authentication portal for SYMLog desktop application',
    siteName: 'SYMLog Auth',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SYMLog Authentication Portal',
    description: 'Secure authentication portal for SYMLog desktop application',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ConvexProvider>
          <CrossmintProvider>
            {children}
            <Analytics />
            <Toaster richColors />
          </CrossmintProvider>
        </ConvexProvider>
      </body>
    </html>
  )
}