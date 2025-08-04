"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@crossmint/client-sdk-react-ui"
import { Brain, Shield, Zap, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

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
          <div className="flex items-center justify-center mb-4 sm:mb-6">
            <Brain className="h-12 w-12 sm:h-16 sm:w-16 text-periwinkle" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold gradient-text from-periwinkle to-light-green mb-3 sm:mb-4">
            Welcome to SYMLog
          </h1>
          <p className="text-gray-400 text-base sm:text-lg">
            Secure Authentication Portal
          </p>
        </div>

        {/* Login Card */}
        <Card className="p-6 sm:p-8 space-y-4 sm:space-y-6">
          <CardHeader className="text-center p-0">
            <CardTitle className="text-xl sm:text-2xl font-semibold text-white mb-2 sm:mb-3">
              Sign in to continue
            </CardTitle>
            <CardDescription className="text-sm sm:text-base text-gray-400">
              Connect your account to generate an authentication code for your SYMLog desktop application.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            {/* Login Button */}
            <Button
              onClick={handleLogin}
              variant="periwinkle"
              size="lg"
              className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold touch-manipulation"
            >
              Sign in with Crossmint
            </Button>
          </CardContent>

          {/* Features */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-3 sm:pt-4">
            <div className="text-center">
              <div className="glass rounded-lg p-2 sm:p-3 mb-2">
                <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-periwinkle mx-auto" />
              </div>
              <p className="text-xs sm:text-sm text-gray-400">Secure</p>
            </div>
            <div className="text-center">
              <div className="glass rounded-lg p-2 sm:p-3 mb-2">
                <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-light-green mx-auto" />
              </div>
              <p className="text-xs sm:text-sm text-gray-400">Fast</p>
            </div>
            <div className="text-center">
              <div className="glass rounded-lg p-2 sm:p-3 mb-2">
                <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400 mx-auto" />
              </div>
              <p className="text-xs sm:text-sm text-gray-400">Trusted</p>
            </div>
          </div>
        </Card>

        {/* How it Works */}
        <Card className="p-4 sm:p-6 mt-4 sm:mt-6">
          <CardHeader className="text-center p-0 pb-3 sm:pb-4">
            <CardTitle className="text-base sm:text-lg font-semibold text-white">
              How it works
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-periwinkle/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-periwinkle">1</span>
                </div>
                <p className="text-sm sm:text-base text-gray-300">
                  Sign in with your Crossmint account
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-light-green/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-light-green">2</span>
                </div>
                <p className="text-sm sm:text-base text-gray-300">
                  Get your unique authentication code
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-400">3</span>
                </div>
                <p className="text-sm sm:text-base text-gray-300">
                  Return to SYMLog and paste the code
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Support */}
        <div className="text-center mt-6 sm:mt-8">
          <p className="text-xs sm:text-sm text-gray-500 mb-2">
            Need help? Make sure SYMLog desktop app is running
          </p>
          <p className="text-xs sm:text-sm text-gray-600">
            Authentication codes expire after 10 minutes for security
          </p>
        </div>
      </div>
    </div>
  )
}