import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { Analytics } from '../components/analytics';
import { ThemeProvider } from '../components/theme-provider';
import { ConvexProvider } from './convex-provider';
import { CrossmintProviderWrapper } from './crossmint-provider';
import { ErrorBoundaryWrapper } from './error-boundary';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'SYMLog Authentication Portal',
    template: '%s | SYMLog Auth',
  },
  description:
    'Secure authentication portal for SYMLog desktop application. Sign in with Crossmint to generate authentication codes.',
  keywords: [
    'SYMLog',
    'authentication',
    'Crossmint',
    'secure login',
    'desktop app',
    'auth portal',
  ],
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
};

// Force dynamic rendering for all pages
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          <ConvexProvider>
            <ErrorBoundaryWrapper>
              <CrossmintProviderWrapper>
                {children}
                <Analytics />
                <Toaster richColors />
              </CrossmintProviderWrapper>
            </ErrorBoundaryWrapper>
          </ConvexProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
