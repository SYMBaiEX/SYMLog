import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import '../index.css';
import { AnimatedBackground } from '@/components/animated-background';
import { AppMenuBar } from '@/components/app-menu-bar';
import { ErrorBoundary } from '@/components/error-boundary';
import { Footer } from '@/components/footer';
import { Navigation } from '@/components/navigation';
import Providers from '@/components/providers';
import { RoutePreloader } from '@/components/route-preloader';
import { TauriDetector } from '@/components/tauri-detector';
import { TauriKeyboardShortcuts } from '@/components/tauri-keyboard-shortcuts';
import { TauriMenuHandler } from '@/components/tauri-menu-handler';
import { TauriWindowControls } from '@/components/tauri-window-controls';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'SYMLog - Digital Platform',
  description:
    'Experience the future of digital innovation with SYMLog. Advanced technology solutions with secure Web3 integration and cutting-edge features.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ErrorBoundary level="page">
          <Providers>
            <RoutePreloader />
            <AnimatedBackground />
            <TauriMenuHandler />
            <TauriDetector />
            <TauriWindowControls />
            <TauriKeyboardShortcuts />
            <div className="relative flex min-h-screen flex-col tauri-app:pt-10">
              <ErrorBoundary isolate level="section">
                <AppMenuBar />
              </ErrorBoundary>
              <ErrorBoundary isolate level="section">
                <Navigation />
              </ErrorBoundary>
              <main className="relative z-10 flex-1">{children}</main>
              <ErrorBoundary isolate level="component">
                <Footer />
              </ErrorBoundary>
            </div>
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
