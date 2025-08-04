import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../index.css";
import Providers from "@/components/providers";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { AnimatedBackground } from "@/components/animated-background";
import { AppMenuBar } from "@/components/app-menu-bar";
import { TauriMenuHandler } from "@/components/tauri-menu-handler";
import { TauriDetector } from "@/components/tauri-detector";
import { TauriKeyboardShortcuts } from "@/components/tauri-keyboard-shortcuts";
import { TauriWindowControls } from "@/components/tauri-window-controls";
import { ErrorBoundary } from "@/components/error-boundary";
import { RoutePreloader } from "@/components/route-preloader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SYMLog - Digital Platform",
  description: "Experience the future of digital innovation with SYMLog. Advanced technology solutions with secure Web3 integration and cutting-edge features.",
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
              <ErrorBoundary level="section" isolate>
                <AppMenuBar />
              </ErrorBoundary>
              <ErrorBoundary level="section" isolate>
                <Navigation />
              </ErrorBoundary>
              <main className="flex-1 relative z-10">{children}</main>
              <ErrorBoundary level="component" isolate>
                <Footer />
              </ErrorBoundary>
            </div>
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
