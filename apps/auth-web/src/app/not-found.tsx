"use client"

import Link from 'next/link'
import { Brain, Home, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-periwinkle/10 rounded-full filter blur-[100px] animate-pulse-slow"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-light-green/10 rounded-full filter blur-[100px] animate-pulse-slow"></div>
      </div>

      <div className="relative w-full max-w-sm sm:max-w-md lg:max-w-lg text-center">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-center mb-4 sm:mb-6">
            <Brain className="h-12 w-12 sm:h-16 sm:w-16 text-periwinkle" />
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-3 sm:mb-4">404</h1>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold gradient-text from-periwinkle to-light-green mb-2">
            Page Not Found
          </h2>
          <p className="text-sm sm:text-base text-gray-400">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Action Card */}
        <Card className="p-6 sm:p-8 space-y-4 sm:space-y-6">
          <div className="space-y-3 sm:space-y-4">
            <Button asChild variant="periwinkle" size="lg" className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold touch-manipulation">
              <Link href="/">
                <Home className="h-5 w-5" />
                Go to Authentication
              </Link>
            </Button>
            
            <Button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.history.back()
                }
              }}
              variant="glass"
              size="lg"
              className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold touch-manipulation"
            >
              <ArrowLeft className="h-5 w-5" />
              Go Back
            </Button>
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