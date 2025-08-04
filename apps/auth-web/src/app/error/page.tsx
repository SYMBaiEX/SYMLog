"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Brain, AlertTriangle, RefreshCw, Home, ArrowLeft } from "lucide-react"

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

export default function ErrorPage() {
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
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black"></div>
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
        <div className="glass rounded-2xl p-8 space-y-6 border border-red-500/20">
          <div className="text-center">
            <AlertTriangle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              {errorDetails.title}
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              {errorInfo?.message || errorDetails.message}
            </p>
            {errorInfo?.code && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4">
                <code className="text-red-300 text-sm">
                  Error Code: {errorInfo.code}
                </code>
              </div>
            )}
            <p className="text-gray-300 text-sm">
              {errorDetails.suggestion}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full glass-button bg-periwinkle/20 hover:bg-periwinkle/30 text-white font-medium py-3 px-6 rounded-lg transition-all duration-300 glow-primary flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-5 w-5" />
              Try Again
            </button>
            
            <Link
              href="/"
              className="w-full glass-button bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 font-medium py-3 px-6 rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
            >
              <Home className="h-5 w-5" />
              Back to Login
            </Link>

            <button
              onClick={() => window.history.back()}
              className="w-full text-gray-500 hover:text-gray-300 text-sm transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </button>
          </div>
        </div>

        {/* Help Section */}
        <div className="glass rounded-xl p-4 mt-6">
          <div className="text-center">
            <h3 className="text-sm font-medium text-white mb-2">Need Help?</h3>
            <p className="text-xs text-gray-400 mb-3">
              If you continue to experience issues, try these steps:
            </p>
            <ul className="text-xs text-gray-500 space-y-1 text-left">
              <li>• Clear your browser cache and cookies</li>
              <li>• Disable browser extensions temporarily</li>
              <li>• Try using an incognito/private window</li>
              <li>• Ensure SYMLog desktop app is running</li>
            </ul>
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