"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@crossmint/client-sdk-react-ui"
import { Brain, Shield, Zap, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

export default function HomePage() {
  const router = useRouter()
  const { login, jwt, user } = useAuth()

  const isLoggedIn = !!jwt && !!user

  // Redirect to success page if already authenticated
  useEffect(() => {
    if (isLoggedIn) {
      router.push('/success')
    }
  }, [isLoggedIn, router])

  const handleLogin = async () => {
    try {
      // Show loading state
      toast.loading("Connecting to authentication service...")
      
      await login()
      
      // Success will be handled by the useEffect redirect
      toast.dismiss()
      toast.success("Authentication successful! Redirecting...")
      
    } catch (error) {
      console.error("Login failed:", error)
      toast.dismiss()
      toast.error("Login failed. Please try again.")
      
      // Redirect to error page with details
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      router.push(`/error?type=auth_failed&message=${encodeURIComponent(errorMessage)}`)
    }
  }

  // Don't render if user is logged in (will redirect)
  if (isLoggedIn) {
    return null
  }

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
          <div className="flex items-center justify-center mb-6">
            <Brain className="h-16 w-16 text-periwinkle" />
          </div>
          <h1 className="text-4xl font-bold gradient-text from-periwinkle to-light-green mb-4">
            Welcome to SYMLog
          </h1>
          <p className="text-gray-400 text-lg">
            Secure Authentication Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="glass rounded-2xl p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-white mb-3">
              Sign in to continue
            </h2>
            <p className="text-gray-400">
              Connect your account to generate an authentication code for your SYMLog desktop application.
            </p>
          </div>

          {/* Login Button */}
          <button
            onClick={handleLogin}
            className="w-full glass-button bg-periwinkle/20 hover:bg-periwinkle/30 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 glow-primary text-lg"
          >
            Sign in with Crossmint
          </button>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="text-center">
              <div className="glass rounded-lg p-3 mb-2">
                <Shield className="h-6 w-6 text-periwinkle mx-auto" />
              </div>
              <p className="text-xs text-gray-400">Secure</p>
            </div>
            <div className="text-center">
              <div className="glass rounded-lg p-3 mb-2">
                <Zap className="h-6 w-6 text-light-green mx-auto" />
              </div>
              <p className="text-xs text-gray-400">Fast</p>
            </div>
            <div className="text-center">
              <div className="glass rounded-lg p-3 mb-2">
                <CheckCircle2 className="h-6 w-6 text-blue-400 mx-auto" />
              </div>
              <p className="text-xs text-gray-400">Trusted</p>
            </div>
          </div>
        </div>

        {/* How it Works */}
        <div className="glass rounded-xl p-6 mt-6">
          <h3 className="text-lg font-semibold text-white mb-4 text-center">
            How it works
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-periwinkle/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-periwinkle">1</span>
              </div>
              <p className="text-sm text-gray-300">
                Sign in with your Crossmint account
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-light-green/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-light-green">2</span>
              </div>
              <p className="text-sm text-gray-300">
                Get your unique authentication code
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-blue-400">3</span>
              </div>
              <p className="text-sm text-gray-300">
                Return to SYMLog and paste the code
              </p>
            </div>
          </div>
        </div>

        {/* Support */}
        <div className="text-center mt-8">
          <p className="text-xs text-gray-500 mb-2">
            Need help? Make sure SYMLog desktop app is running
          </p>
          <p className="text-xs text-gray-600">
            Authentication codes expire after 10 minutes for security
          </p>
        </div>
      </div>
    </div>
  )
}