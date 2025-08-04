"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Brain, AlertTriangle, RefreshCw, Home, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ErrorInfo {
  type: string
  message: string
  code?: string
}

const errorTypes = {
  auth_failed: {
    title: "Authentication Failed",
    message: "We couldn't authenticate your account. Please try again.",
    suggestion: "Check your credentials and try signing in again."
  },
  wallet_error: {
    title: "Wallet Connection Error",
    message: "There was an issue connecting to your wallet.",
    suggestion: "Please ensure your wallet is properly configured and try again."
  },
  session_expired: {
    title: "Session Expired",
    message: "Your authentication session has expired.",
    suggestion: "Please start the authentication process again."
  },
  network_error: {
    title: "Network Error",
    message: "Unable to connect to the authentication service.",
    suggestion: "Check your internet connection and try again."
  },
  server_error: {
    title: "Server Error",
    message: "We're experiencing technical difficulties.",
    suggestion: "Please try again in a few moments."
  },
  invalid_request: {
    title: "Invalid Request",
    message: "The authentication request is invalid or malformed.",
    suggestion: "Please start the authentication process from SYMLog again."
  },
  default: {
    title: "Authentication Error",
    message: "An unexpected error occurred during authentication.",
    suggestion: "Please try again or contact support if the issue persists."
  }
}

function ErrorPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null)

  useEffect(() => {
    const errorType = searchParams.get('type') || 'default'
    const message = searchParams.get('message')
    const code = searchParams.get('code')

    const errorData = errorTypes[errorType as keyof typeof errorTypes] || errorTypes.default

    setErrorInfo({
      type: errorType,
      message: message || errorData.message,
      code: code || undefined
    })
  }, [searchParams])

  const getErrorDetails = () => {
    if (!errorInfo) return errorTypes.default
    return errorTypes[errorInfo.type as keyof typeof errorTypes] || errorTypes.default
  }

  const handleRetry = () => {
    router.push('/')
  }

  const errorDetails = getErrorDetails()

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/10 rounded-full filter blur-[100px] animate-pulse-slow"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full filter blur-[100px] animate-pulse-slow"></div>
      </div>

      <div className="relative w-full max-w-sm sm:max-w-md lg:max-w-lg">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-center justify-center mb-4 sm:mb-6">
            <Brain className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mb-2 sm:mb-0 sm:mr-3" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              SYMLog Auth
            </h1>
          </div>
        </div>

        {/* Error Card */}
        <Card className="p-6 sm:p-8 space-y-4 sm:space-y-6 border border-red-500/20">
          <CardHeader className="text-center p-0">
            <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-red-400 mx-auto mb-3 sm:mb-4" />
            <CardTitle className="text-lg sm:text-xl font-semibold text-white mb-2">
              {errorDetails.title}
            </CardTitle>
            <CardDescription className="text-sm sm:text-base text-gray-400 mb-3 sm:mb-4">
              {errorInfo?.message || errorDetails.message}
            </CardDescription>
            {errorInfo?.code && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-3 sm:mb-4">
                <code className="text-red-300 text-xs sm:text-sm break-all">
                  Error Code: {errorInfo.code}
                </code>
              </div>
            )}
            <p className="text-gray-300 text-sm sm:text-base">
              {errorDetails.suggestion}
            </p>
          </CardHeader>

          <CardContent className="p-0">
            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                onClick={handleRetry}
                variant="periwinkle"
                size="lg"
                className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold touch-manipulation"
              >
                <RefreshCw className="h-5 w-5" />
                Try Again
              </Button>
              
              <Button asChild variant="glass" size="lg" className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold touch-manipulation">
                <Link href="/">
                  <Home className="h-5 w-5" />
                  Back to Login
                </Link>
              </Button>

              <Button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.history.back()
                  }
                }}
                variant="ghost"
                size="sm"
                className="w-full text-gray-500 hover:text-gray-300 h-10 touch-manipulation"
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card className="p-4 sm:p-6 mt-4 sm:mt-6">
          <div className="text-center">
            <h3 className="text-sm sm:text-base font-medium text-white mb-2">Need Help?</h3>
            <p className="text-xs sm:text-sm text-gray-400 mb-3">
              If you continue to experience issues, try these steps:
            </p>
            <ul className="text-xs sm:text-sm text-gray-500 space-y-1 text-left">
              <li>• Clear your browser cache and cookies</li>
              <li>• Disable browser extensions temporarily</li>
              <li>• Try using an incognito/private window</li>
              <li>• Ensure SYMLog desktop app is running</li>
            </ul>
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

export default function ErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div></div>}>
      <ErrorPageContent />
    </Suspense>
  )
}