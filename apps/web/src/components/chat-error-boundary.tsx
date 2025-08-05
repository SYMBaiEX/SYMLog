'use client';

import { AlertCircle, MessageSquareOff, RefreshCw } from 'lucide-react';
import type React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from './error-boundary';

interface ChatErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

export function ChatErrorBoundary({
  children,
  onReset,
}: ChatErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="w-full max-w-md space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-destructive/10 p-4">
                <MessageSquareOff className="h-8 w-8 text-destructive" />
              </div>
            </div>

            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Chat Error</AlertTitle>
              <AlertDescription className="mt-2 space-y-3">
                <p>
                  We encountered an error with the chat system. This could be
                  due to:
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  <li>Connection issues</li>
                  <li>Invalid message format</li>
                  <li>AI service unavailability</li>
                </ul>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => {
                      onReset?.();
                      window.location.reload();
                    }}
                    size="sm"
                    variant="outline"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reload Chat
                  </Button>
                  <Button
                    onClick={() => {
                      // Clear chat history from localStorage
                      localStorage.removeItem('chat-history');
                      localStorage.removeItem('chat-session');
                      window.location.reload();
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Clear & Restart
                  </Button>
                </div>
              </AlertDescription>
            </Alert>

            <p className="text-center text-muted-foreground text-sm">
              If the problem persists, please contact support.
            </p>
          </div>
        </div>
      }
      level="section"
      onError={(error, errorInfo) => {
        // Log chat-specific errors
        console.error('Chat error:', error);
        console.error('Component stack:', errorInfo.componentStack);

        // Could send to error tracking service
        if (typeof window !== 'undefined' && (window as any).Sentry) {
          (window as any).Sentry.captureException(error, {
            contexts: {
              component: {
                name: 'Chat',
                stack: errorInfo.componentStack,
              },
            },
          });
        }
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
