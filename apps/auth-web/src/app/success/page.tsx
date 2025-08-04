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
            <Brain className="h-12 w-12 text-periwinkle mr-3" />
            <h1 className="text-3xl font-bold gradient-text from-periwinkle to-light-green">
              Authentication Complete
            </h1>
          </div>
        </div>

        {/* Success Card */}
        <div className="glass rounded-2xl p-8 space-y-6">
          <div className="text-center">
            <CheckCircle2 className="h-16 w-16 text-light-green mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Success!
            </h2>
            <p className="text-gray-400 text-sm">
              Your authentication code is ready. Use it to sign in to SYMLog.
            </p>
          </div>

          {/* Auth Code Display */}
          {authCode ? (
            <div className="space-y-4">
              {/* Timer */}
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <Clock className="h-4 w-4" />
                <span>Expires in {formatTime(timeRemaining)}</span>
              </div>

              <div className="glass rounded-lg p-4 bg-gray-800/50">
                <label className="text-sm text-gray-400 block mb-2">
                  Authentication Code
                </label>
                <div className="flex items-center gap-3">
                  <code className="flex-1 text-lg font-mono text-white bg-black/50 px-3 py-2 rounded border-l-4 border-periwinkle">
                    {authCode}
                  </code>
                  <Button
                    onClick={copyCodeToClipboard}
                    variant="glass"
                    size="icon"
                    title="Copy code"
                  >
                    {copiedCode ? (
                      <CheckCircle2 className="h-5 w-5 text-light-green" />
                    ) : (
                      <Copy className="h-5 w-5 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={handleDeepLink}
                  variant="glass"
                  size="lg"
                  className="w-full bg-light-green/20 hover:bg-light-green/30"
                >
                  <ExternalLink className="h-5 w-5" />
                  Open SYMLog App
                </Button>

                <Button
                  onClick={generateAuthCode}
                  disabled={isGeneratingCode}
                  variant="periwinkle"
                  size="lg"
                  className="w-full"
                >
                  {isGeneratingCode ? "Generating..." : "Generate New Code"}
                </Button>

                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-2">
                    Can't open the app automatically?
                  </p>
                  <p className="text-xs text-gray-400">
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
        </div>

        {/* User Info Card */}
        <div className="glass rounded-xl p-4 mt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-periwinkle/20 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-periwinkle">
                  {(user?.email || user?.id || "U")?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-white text-sm font-medium">
                  {user?.email || user?.id || "Unknown User"}
                </p>
                <p className="text-gray-400 text-xs flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  {isWalletReady ? "Wallet Connected" : "Connecting wallet..."}
                </p>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white"
            >
              Sign Out
            </Button>
          </div>
        </div>
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