import Link from 'next/link'
import { Brain, Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-periwinkle/10 rounded-full filter blur-[100px] animate-pulse-slow"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-light-green/10 rounded-full filter blur-[100px] animate-pulse-slow"></div>
      </div>

      <div className="relative w-full max-w-md text-center">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-center mb-6">
            <Brain className="h-16 w-16 text-periwinkle" />
          </div>
          <h1 className="text-6xl font-bold text-white mb-4">404</h1>
          <h2 className="text-2xl font-semibold gradient-text from-periwinkle to-light-green mb-2">
            Page Not Found
          </h2>
          <p className="text-gray-400">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Action Card */}
        <div className="glass rounded-2xl p-8 space-y-6">
          <div className="space-y-4">
            <Link
              href="/"
              className="w-full glass-button bg-periwinkle/20 hover:bg-periwinkle/30 text-white font-medium py-3 px-6 rounded-lg transition-all duration-300 glow-primary flex items-center justify-center gap-2"
            >
              <Home className="h-5 w-5" />
              Go to Authentication
            </Link>
            
            <button
              onClick={() => window.history.back()}
              className="w-full glass-button bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 font-medium py-3 px-6 rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-5 w-5" />
              Go Back
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
  )
}