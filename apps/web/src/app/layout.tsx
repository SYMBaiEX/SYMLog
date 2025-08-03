import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../index.css";
import Providers from "@/components/providers";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { AnimatedBackground } from "@/components/animated-background";
import { AppMenuBar } from "@/components/app-menu-bar";
import { TauriMenuHandler } from "@/components/tauri-menu-handler";
import { TauriTitleBar } from "@/components/tauri-titlebar";
import { TauriDetector } from "@/components/tauri-detector";

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
        <Providers>
          <AnimatedBackground />
          <TauriMenuHandler />
          <TauriDetector />
          <TauriTitleBar />
          <div className="relative flex min-h-screen flex-col">
            <AppMenuBar />
            <Navigation />
            <main className="flex-1 relative z-10">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
