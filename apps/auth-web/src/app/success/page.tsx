"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth, useWallet } from "@crossmint/client-sdk-react-ui"
import { useMutation } from "convex/react"
import { api } from "../../lib/convex"
import { Brain, Copy, ExternalLink, CheckCircle2, Clock, Shield } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function SuccessPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { jwt, user, logout } = useAuth()
  const { wallet, status: walletStatus } = useWallet()
  const [authCode, setAuthCode] = useState<string>("")
  const [isGeneratingCode, setIsGeneratingCode] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(600) // 10 minutes in seconds
  
  // Convex mutations
  const createAuthSession = useMutation(api.auth.createAuthSession)
  const updateAuthSession = useMutation(api.auth.updateAuthSession)

  const isLoggedIn = !!jwt && !!user
  const isWalletReady = walletStatus === 'loaded' && wallet

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/')
      return
    }
  }, [isLoggedIn, router])

  // Generate auth code when user arrives
  useEffect(() => {
    if (isLoggedIn && isWalletReady && !authCode) {
      generateAuthCode()
    }
  }, [isLoggedIn, isWalletReady])

  // Countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) return

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          toast.error("Authentication code expired. Please generate a new one.")
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeRemaining])

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const generateAuthCode = async () => {
    if (!user || !wallet) return
    
    setIsGeneratingCode(true)
    try {
      // Generate a unique auth code
      const code = `SYM_${Math.random().toString(36).substr(2, 16).toUpperCase()}`
      
      // Store auth session in Convex
      await createAuthSession({
        authCode: code,
        userId: user.id,
        userEmail: user.email || "",
        walletAddress: wallet.address || "",
        expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes
        status: "pending"
      })
      
      setAuthCode(code)
      setTimeRemaining(600) // Reset timer
      toast.success("Authentication code generated!")
    } catch (error) {
      console.error("Failed to generate auth code:", error)
      toast.error("Failed to generate authentication code")
    } finally {
      setIsGeneratingCode(false)
    }
  }

  const copyCodeToClipboard = async () => {
    if (!authCode) return
    
    try {
      await navigator.clipboard.writeText(authCode)
      setCopiedCode(true)
      toast.success("Code copied to clipboard!")
      setTimeout(() => setCopiedCode(false), 2000)
    } catch (error) {
      toast.error("Failed to copy code")
    }
  }

  const handleDeepLink = () => {
    if (!authCode) return
    
    try {
      const deepLinkUrl = `${process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL}?code=${encodeURIComponent(authCode)}`
      window.location.href = deepLinkUrl
      
      // Also show success message
      toast.success("Opening SYMLog app...")
      
      // Mark as completed in database
      updateAuthSession({
        authCode,
        status: "completed"
      }).catch(console.error)
      
    } catch (error) {
      console.error("Deep link failed:", error)
      toast.error("Failed to open SYMLog app. Please copy the code manually.")
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      router.push('/')
    } catch (error) {
      console.error("Logout failed:", error)
      toast.error("Logout failed")
    }
  }

  if (!isLoggedIn) {
    return null // Will redirect
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
          <div className="flex flex-col sm:flex-row items-center justify-center mb-4">
            <Brain className="h-10 w-10 sm:h-12 sm:w-12 text-periwinkle mb-2 sm:mb-0 sm:mr-3" />
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold gradient-text from-periwinkle to-light-green text-center">
              Authentication Complete
            </h1>
          </div>
        </div>

        {/* Success Card */}
        <Card className="p-6 sm:p-8 space-y-4 sm:space-y-6">
          <CardHeader className="text-center p-0">
            <CheckCircle2 className="h-12 w-12 sm:h-16 sm:w-16 text-light-green mx-auto mb-3 sm:mb-4" />
            <CardTitle className="text-lg sm:text-xl font-semibold text-white mb-2">
              Success!
            </CardTitle>
            <CardDescription className="text-sm sm:text-base text-gray-400">
              Your authentication code is ready. Use it to sign in to SYMLog.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            {/* Auth Code Display */}
            {authCode ? (
              <div className="space-y-4">
              {/* Timer */}
              <div className="flex items-center justify-center gap-2 text-sm sm:text-base text-gray-400">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Expires in {formatTime(timeRemaining)}</span>
              </div>

              <div className="glass rounded-lg p-3 sm:p-4 bg-gray-800/50">
                <label className="text-sm sm:text-base text-gray-400 block mb-2">
                  Authentication Code
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
                  <code className="flex-1 w-full text-base sm:text-lg font-mono text-white bg-black/50 px-3 py-2 sm:py-3 rounded border-l-4 border-periwinkle break-all text-center sm:text-left">
                    {authCode}
                  </code>
                  <Button
                    onClick={copyCodeToClipboard}
                    variant="glass"
                    size="icon"
                    title="Copy code"
                    className="w-full sm:w-auto h-10 sm:h-9 sm:w-9 touch-manipulation"
                  >
                    {copiedCode ? (
                      <CheckCircle2 className="h-5 w-5 text-light-green" />
                    ) : (
                      <Copy className="h-5 w-5 text-gray-400" />
                    )}
                    <span className="sm:hidden ml-2">{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={handleDeepLink}
                  variant="glass"
                  size="lg"
                  className="w-full bg-light-green/20 hover:bg-light-green/30 h-12 sm:h-14 text-base sm:text-lg font-semibold touch-manipulation"
                >
                  <ExternalLink className="h-5 w-5" />
                  Open SYMLog App
                </Button>

                <Button
                  onClick={generateAuthCode}
                  disabled={isGeneratingCode}
                  variant="periwinkle"
                  size="lg"
                  className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold touch-manipulation"
                >
                  {isGeneratingCode ? "Generating..." : "Generate New Code"}
                </Button>

                <div className="text-center">
                  <p className="text-xs sm:text-sm text-gray-500 mb-2">
                    Can't open the app automatically?
                  </p>
                  <p className="text-xs sm:text-sm text-gray-400">
                    Copy the code above and paste it in SYMLog's login dialog
                  </p>
                </div>
              </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-periwinkle mx-auto mb-4"></div>
                <p className="text-gray-400">Generating authentication code...</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Info Card */}
        <Card className="p-4 sm:p-6 mt-4 sm:mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-periwinkle/20 rounded-full flex items-center justify-center">
                <span className="text-sm sm:text-base font-bold text-periwinkle">
                  {(user?.email || user?.id || "U")?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-white text-sm sm:text-base font-medium break-all">
                  {user?.email || user?.id || "Unknown User"}
                </p>
                <p className="text-gray-400 text-xs sm:text-sm flex items-center gap-1">
                  <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
                  {isWalletReady ? "Wallet Connected" : "Connecting wallet..."}
                </p>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white w-full sm:w-auto touch-manipulation"
            >
              Sign Out
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-periwinkle"></div></div>}>
      <SuccessPageContent />
    </Suspense>
  )
}