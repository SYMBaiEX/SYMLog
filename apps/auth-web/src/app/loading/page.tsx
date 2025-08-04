"use client"

import { useEffect, useState } from "react"
import { Brain, Loader2 } from "lucide-react"

interface LoadingPageProps {
  message?: string
  progress?: number
}

export default function LoadingPage({ 
  message = "Authenticating...", 
  progress 
}: LoadingPageProps) {
  const [dots, setDots] = useState("")

  // Animated dots effect
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === "...") return ""
        return prev + "."
      })
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-periwinkle/10 rounded-full filter blur-[100px] animate-pulse-slow"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-light-green/10 rounded-full filter blur-[100px] animate-pulse-slow"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Brain className="h-12 w-12 text-periwinkle mr-3 animate-pulse" />
            <h1 className="text-3xl font-bold gradient-text from-periwinkle to-light-green">
              SYMLog Auth
            </h1>
          </div>
        </div>

        {/* Loading Card */}
        <div className="glass rounded-2xl p-8 space-y-6">
          <div className="text-center">
            {/* Spinner */}
            <div className="relative">
              <Loader2 className="h-16 w-16 text-periwinkle mx-auto mb-6 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 bg-periwinkle/20 rounded-full animate-ping"></div>
              </div>
            </div>

            {/* Loading Message */}
            <h2 className="text-xl font-semibold text-white mb-2">
              {message}{dots}
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Please wait while we process your request
            </p>

            {/* Progress Bar */}
            {progress !== undefined && (
              <div className="w-full bg-gray-800 rounded-full h-2 mb-4">
                <div 
                  className="bg-gradient-to-r from-periwinkle to-light-green h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                ></div>
              </div>
            )}

            {/* Loading Steps */}
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <div className="w-2 h-2 bg-periwinkle rounded-full animate-pulse"></div>
                <span>Connecting to authentication service</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                <span>Verifying credentials</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                <span>Setting up secure session</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tips Card */}
        <div className="glass rounded-xl p-4 mt-6">
          <div className="text-center">
            <h3 className="text-sm font-medium text-white mb-2">💡 Tip</h3>
            <p className="text-xs text-gray-400">
              Keep this window open while authenticating. The process usually takes less than 30 seconds.
            </p>
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