"use client"

import { useEffect, useState } from "react"
import { Brain, Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoadingPage() {
  const message = "Authenticating..."
  const progress = undefined
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
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-periwinkle/10 rounded-full filter blur-[100px] animate-pulse-slow"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-light-green/10 rounded-full filter blur-[100px] animate-pulse-slow"></div>
      </div>

      <div className="relative w-full max-w-sm sm:max-w-md lg:max-w-lg">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-center justify-center mb-4">
            <Brain className="h-10 w-10 sm:h-12 sm:w-12 text-periwinkle animate-pulse mb-2 sm:mb-0 sm:mr-3" />
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text from-periwinkle to-light-green">
              SYMLog Auth
            </h1>
          </div>
        </div>

        {/* Loading Card */}
        <Card className="p-6 sm:p-8 space-y-4 sm:space-y-6">
          <CardHeader className="text-center p-0">
            {/* Spinner */}
            <div className="relative">
              <Loader2 className="h-12 w-12 sm:h-16 sm:w-16 text-periwinkle mx-auto mb-4 sm:mb-6 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-periwinkle/20 rounded-full animate-ping"></div>
              </div>
            </div>

            {/* Loading Message */}
            <CardTitle className="text-lg sm:text-xl font-semibold text-white mb-2">
              {message}{dots}
            </CardTitle>
            <CardDescription className="text-sm sm:text-base text-gray-400 mb-4 sm:mb-6">
              Please wait while we process your request
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">

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
              <div className="flex items-center justify-center gap-2 text-sm sm:text-base text-gray-400">
                <div className="w-2 h-2 bg-periwinkle rounded-full animate-pulse"></div>
                <span>Connecting to authentication service</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm sm:text-base text-gray-500">
                <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                <span>Verifying credentials</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm sm:text-base text-gray-500">
                <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                <span>Setting up secure session</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tips Card */}
        <Card className="p-4 sm:p-6 mt-4 sm:mt-6">
          <div className="text-center">
            <h3 className="text-sm sm:text-base font-medium text-white mb-2">💡 Tip</h3>
            <p className="text-xs sm:text-sm text-gray-400">
              Keep this window open while authenticating. The process usually takes less than 30 seconds.
            </p>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6 sm:mt-8">
          <p className="text-xs sm:text-sm text-gray-500">
            SYMLog Authentication Portal
          </p>
        </div>
      </div>
    </div>
  )
}