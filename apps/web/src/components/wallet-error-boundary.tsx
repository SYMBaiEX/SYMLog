'use client';

import { AlertCircle, Wallet, WifiOff } from 'lucide-react';
import type React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from './error-boundary';

interface WalletErrorBoundaryProps {
  children: React.ReactNode;
}

export function WalletErrorBoundary({ children }: WalletErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="inline-flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-destructive">
          <Wallet className="h-4 w-4" />
          <span className="text-sm">Wallet connection error</span>
          <Button
            className="h-auto px-2 py-0.5"
            onClick={() => window.location.reload()}
            size="sm"
            variant="ghost"
          >
            Retry
          </Button>
        </div>
      }
      isolate
      level="component"
      onError={(error) => {
        // Common wallet errors
        const errorMessage = error.message.toLowerCase();

        if (errorMessage.includes('user rejected')) {
          console.log('User rejected wallet connection');
        } else if (
          errorMessage.includes('phantom') &&
          errorMessage.includes('not found')
        ) {
          console.log('Phantom wallet not installed');
        } else if (errorMessage.includes('network')) {
          console.log('Network error during wallet connection');
        } else {
          console.error('Wallet error:', error);
        }
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

// Specific error boundary for Crossmint authentication
export function CrossmintErrorBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      fallback={
        <Alert className="max-w-md" variant="destructive">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>Crossmint Connection Error</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3">
              Unable to connect to Crossmint authentication service.
            </p>
            <div className="space-y-2 text-sm">
              <p>Possible solutions:</p>
              <ul className="ml-2 list-inside list-disc space-y-1">
                <li>Check your internet connection</li>
                <li>Disable ad blockers for this site</li>
                <li>Try a different browser</li>
              </ul>
            </div>
            <Button
              className="mt-3"
              onClick={() => window.location.reload()}
              size="sm"
              variant="outline"
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      }
      isolate
      level="component"
      resetOnPropsChange
    >
      {children}
    </ErrorBoundary>
  );
}
