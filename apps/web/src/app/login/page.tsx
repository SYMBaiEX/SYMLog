"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@crossmint/client-sdk-react-ui"
import { GlassButton } from "@/components/ui/glass-button"
import { GlassCard } from "@/components/ui/glass-card"
import { Brain, Mail, Globe, Twitter, Zap, Shield, CheckCircle2 } from "lucide-react"
import Link from "next/link"

export default function LoginPage() {
  const router = useRouter()
  
  // Check if Crossmint is available
  const clientApiKey = process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_KEY as string
  const isCrossmintEnabled = clientApiKey && clientApiKey !== 'your_client_api_key_here'

  // Always call the hook, but only use the result if Crossmint is enabled
  const auth = useAuth()
  const login = isCrossmintEnabled ? auth.login : undefined
  const jwt = isCrossmintEnabled ? auth.jwt : undefined
  const user = isCrossmintEnabled ? auth.user : undefined

  // Redirect if already logged in
  useEffect(() => {
    if (jwt && user) {
      router.push("/")
    }
  }, [jwt, user, router])

  const handleSocialLogin = async (provider: string) => {
    try {
      if (login) {
        await login()
      }
    } catch (error) {
      console.error(`${provider} login failed:`, error)
    }
  }

  if (jwt && user) {
    return null // Will redirect
  }

  if (!isCrossmintEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <GlassCard className="p-8 max-w-md w-full text-center">
          <Brain className="h-16 w-16 text-periwinkle mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-4">Crossmint Setup Required</h1>
          <p className="text-white/70 mb-4">
            To enable social login and smart wallets, please configure your Crossmint API keys in the environment variables.
          </p>
          <p className="text-white/60 text-sm">
            Add <code className="bg-white/10 px-2 py-1 rounded">NEXT_PUBLIC_CROSSMINT_CLIENT_KEY</code> to your .env.local file.
          </p>
          <div className="mt-6">
            <Link href="/">
              <GlassButton variant="default">
                Return Home
              </GlassButton>
            </Link>
          </div>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center space-x-3 group mb-8">
            <Brain className="h-12 w-12 text-periwinkle group-hover:animate-pulse" />
            <span className="text-4xl font-bold gradient-text from-periwinkle to-light-green">
              SYMLog
            </span>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-white/70">Sign in to your AI Agent Platform</p>
        </div>

        {/* Login Card */}
        <GlassCard className="p-8 space-y-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-white mb-2">Choose your sign-in method</h2>
            <p className="text-white/60 text-sm">Secure, gasless smart wallet included</p>
          </div>

          {/* Social Login Buttons */}
          <div className="space-y-3">
            <GlassButton
              onClick={() => handleSocialLogin("google")}
              className="w-full flex items-center justify-center gap-3 glow-primary"
              variant="default"
            >
              <Mail className="h-5 w-5" />
              Continue with Google
            </GlassButton>

            <GlassButton
              onClick={() => handleSocialLogin("twitter")}
              className="w-full flex items-center justify-center gap-3"
              variant="secondary"
            >
              <Twitter className="h-5 w-5" />
              Continue with Twitter
            </GlassButton>

            <GlassButton
              onClick={() => handleSocialLogin("email")}
              className="w-full flex items-center justify-center gap-3"
              variant="outline"
            >
              <Mail className="h-5 w-5" />
              Continue with Email
            </GlassButton>

            <GlassButton
              onClick={() => handleSocialLogin("farcaster")}
              className="w-full flex items-center justify-center gap-3"
              variant="ghost"
            >
              <Globe className="h-5 w-5" />
              Continue with Farcaster
            </GlassButton>
          </div>

          {/* Features */}
          <div className="pt-6 border-t border-white/10">
            <p className="text-white/80 text-sm font-medium mb-3 text-center">What you get:</p>
            <div className="space-y-2 text-sm text-white/70">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-secondary" />
                <span>Gasless transactions - no fees required</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-secondary" />
                <span>Secure smart wallet with social recovery</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-secondary" />
                <span>Access to premium AI agents</span>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Footer */}
        <div className="text-center text-white/60 text-sm">
          <p>
            New to SYMLog?{" "}
            <Link href="/signup" className="text-periwinkle hover:text-periwinkle/80 transition-colors">
              Create an account
            </Link>
          </p>
          <p className="mt-2">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="text-periwinkle hover:text-periwinkle/80 transition-colors">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-periwinkle hover:text-periwinkle/80 transition-colors">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}