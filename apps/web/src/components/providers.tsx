"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ThemeProvider } from "./theme-provider";
import { Toaster } from "./ui/sonner";
import { CrossmintProviderWrapper } from "./crossmint-provider";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function Providers({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <ConvexProvider client={convex}>
        <CrossmintProviderWrapper>
          {children}
        </CrossmintProviderWrapper>
      </ConvexProvider>
      <Toaster richColors />
    </ThemeProvider>
  );
}
