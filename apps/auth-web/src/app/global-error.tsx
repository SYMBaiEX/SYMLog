'use client'

import { useEffect } from 'react'
import { Brain, AlertTriangle, RefreshCw } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global error:', error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-black via-gray-900 to-black">
          {/* Background Effects */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/10 rounded-full filter blur-[100px] animate-pulse-slow"></div>
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full filter blur-[100px] animate-pulse-slow"></div>
          </div>

          <div className="relative w-full max-w-md">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-6">
                <Brain className="h-12 w-12 text-gray-400 mr-3" />
                <h1 className="text-3xl font-bold text-white">
                  SYMLog Auth
                </h1>
              </div>
            </div>

            {/* Error Card */}
            <div className="backdrop-filter backdrop-blur-20 bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6 border border-red-500/20">
              <div className="text-center">
                <AlertTriangle className="h-16 w-16 text-red-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">
                  Something went wrong!
                </h2>
                <p className="text-gray-400 text-sm mb-4">
                  An unexpected error occurred in the authentication portal.
                </p>
                {error.digest && (
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4">
                    <code className="text-red-300 text-sm">
                      Error ID: {error.digest}
                    </code>
                  </div>
                )}
                <p className="text-gray-300 text-sm">
                  Please try refreshing the page or contact support if the issue persists.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => reset()}
                  className="w-full backdrop-filter backdrop-blur-12 bg-periwinkle/20 hover:bg-periwinkle/30 text-white font-medium py-3 px-6 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 glow-primary"
                >
                  <RefreshCw className="h-5 w-5" />
                  Try Again
                </button>
                
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.location.href = '/'
                    }
                  }}
                  className="w-full backdrop-filter backdrop-blur-12 bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 font-medium py-3 px-6 rounded-lg transition-all duration-300"
                >
                  Go to Homepage
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center mt-8">
              <p className="text-xs text-gray-500">
                SYMLog Authentication Portal
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}