'use client';

import { AlertTriangle, Brain, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-gray-900 to-black p-4">
          {/* Background Effects */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute top-0 left-1/4 h-96 w-96 animate-pulse-slow rounded-full bg-red-500/10 blur-[100px] filter" />
            <div className="absolute right-1/4 bottom-0 h-96 w-96 animate-pulse-slow rounded-full bg-orange-500/10 blur-[100px] filter" />
          </div>

          <div className="relative w-full max-w-md">
            {/* Header */}
            <div className="mb-8 text-center">
              <div className="mb-6 flex items-center justify-center">
                <Brain className="mr-3 h-12 w-12 text-gray-400" />
                <h1 className="font-bold text-3xl text-white">SYMLog Auth</h1>
              </div>
            </div>

            {/* Error Card */}
            <div className="space-y-6 rounded-2xl border border border-red-500/20 border-white/10 bg-white/5 p-8 backdrop-blur-20 backdrop-filter">
              <div className="text-center">
                <AlertTriangle className="mx-auto mb-4 h-16 w-16 text-red-400" />
                <h2 className="mb-2 font-semibold text-white text-xl">
                  Something went wrong!
                </h2>
                <p className="mb-4 text-gray-400 text-sm">
                  An unexpected error occurred in the authentication portal.
                </p>
                {error.digest && (
                  <div className="mb-4 rounded-lg border border-red-500/30 bg-red-900/20 p-3">
                    <code className="text-red-300 text-sm">
                      Error ID: {error.digest}
                    </code>
                  </div>
                )}
                <p className="text-gray-300 text-sm">
                  Please try refreshing the page or contact support if the issue
                  persists.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  className="glow-primary flex w-full items-center justify-center gap-2 rounded-lg bg-periwinkle/20 px-6 py-3 font-medium text-white backdrop-blur-12 backdrop-filter transition-all duration-300 hover:bg-periwinkle/30"
                  onClick={() => reset()}
                >
                  <RefreshCw className="h-5 w-5" />
                  Try Again
                </button>

                <button
                  className="w-full rounded-lg bg-gray-800/50 px-6 py-3 font-medium text-gray-300 backdrop-blur-12 backdrop-filter transition-all duration-300 hover:bg-gray-700/50"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.location.href = '/';
                    }
                  }}
                >
                  Go to Homepage
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-gray-500 text-xs">
                SYMLog Authentication Portal
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
