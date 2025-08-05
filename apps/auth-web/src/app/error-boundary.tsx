'use client';

import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  useEffect(() => {
    // Log error details for debugging
    console.error('Crossmint Error Details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: (error as any).cause,
    });
  }, [error]);

  const isBase58Error = error.message.includes('Non-base58 character');

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6 lg:p-8">
      <div className="relative w-full max-w-sm sm:max-w-md lg:max-w-lg">
        <Card className="p-6 sm:p-8">
          <CardHeader className="p-0 text-center">
            <div className="mb-4 flex justify-center">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="mb-2 font-semibold text-xl sm:text-2xl">
              {isBase58Error ? 'Configuration Error' : 'Something went wrong'}
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              {isBase58Error
                ? "There's an issue with the Crossmint configuration. This is likely due to an invalid API key or configuration parameter."
                : 'An unexpected error occurred while loading the authentication service.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="mt-6 p-0">
            <div className="mb-6 rounded-lg bg-muted/50 p-4">
              <p className="break-all font-mono text-muted-foreground text-sm">
                {error.message}
              </p>
            </div>

            <div className="space-y-3">
              <Button
                className="w-full"
                onClick={resetErrorBoundary}
                size="lg"
                variant="default"
              >
                Try Again
              </Button>

              <Button
                className="w-full"
                onClick={() => (window.location.href = '/')}
                size="lg"
                variant="outline"
              >
                Return to Home
              </Button>
            </div>

            {isBase58Error && (
              <div className="mt-6 text-center text-muted-foreground text-xs">
                <p>If this error persists, please check:</p>
                <ul className="mt-2 space-y-1">
                  <li>• The Crossmint API key is correctly formatted</li>
                  <li>• Environment variables are properly set</li>
                  <li>• The Crossmint provider is properly configured</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function ErrorBoundaryWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        console.error('Error caught by boundary:', error, errorInfo);
      }}
      onReset={() => {
        // Clear any cached state if needed
        window.location.reload();
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
