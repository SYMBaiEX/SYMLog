'use client';

import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { SWRProvider } from '@/providers/swr-provider';
import { CrossmintProviderWrapper } from './crossmint-provider';
import { ThemeProvider } from './theme-provider';
import { Toaster } from './ui/sonner';

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      disableTransitionOnChange
      enableSystem
    >
      <SWRProvider>
        <ConvexProvider client={convex}>
          <CrossmintProviderWrapper>{children}</CrossmintProviderWrapper>
        </ConvexProvider>
      </SWRProvider>
      <Toaster richColors />
    </ThemeProvider>
  );
}
