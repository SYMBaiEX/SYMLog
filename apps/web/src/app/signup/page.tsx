"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@crossmint/client-sdk-react-ui"
import { GlassButton } from "@/components/ui/glass-button"
import { GlassCard } from "@/components/ui/glass-card"
import { Brain, Mail, Globe, Twitter, Zap, Shield, CheckCircle2, Sparkles, Bot, Database } from "lucide-react"
import Link from "next/link"

export default function SignupPage() {
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
      console.error(`${provider} signup failed:`, error)
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
            To enable social signup and smart wallets, please configure your Crossmint API keys in the environment variables.
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
          <h1 className="text-3xl font-bold text-white mb-2">Join SYMLog</h1>
          <p className="text-white/70">Create your AI Agent Platform account</p>
        </div>

        {/* Signup Card */}
        <GlassCard className="p-8 space-y-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-white mb-2">Get started in seconds</h2>
            <p className="text-white/60 text-sm">Your smart wallet will be created automatically</p>
          </div>

          {/* Social Signup Buttons */}
          <div className="space-y-3">
            <GlassButton
              onClick={() => handleSocialLogin("google")}
              className="w-full flex items-center justify-center gap-3 glow-primary"
              variant="default"
            >
              <Mail className="h-5 w-5" />
              Sign up with Google
            </GlassButton>

            <GlassButton
              onClick={() => handleSocialLogin("twitter")}
              className="w-full flex items-center justify-center gap-3"
              variant="secondary"
            >
              <Twitter className="h-5 w-5" />
              Sign up with Twitter
            </GlassButton>

            <GlassButton
              onClick={() => handleSocialLogin("email")}
              className="w-full flex items-center justify-center gap-3"
              variant="outline"
            >
              <Mail className="h-5 w-5" />
              Sign up with Email
            </GlassButton>

            <GlassButton
              onClick={() => handleSocialLogin("farcaster")}
              className="w-full flex items-center justify-center gap-3"
              variant="ghost"
            >
              <Globe className="h-5 w-5" />
              Sign up with Farcaster
            </GlassButton>
          </div>

          {/* Benefits */}
          <div className="pt-6 border-t border-white/10">
            <p className="text-white/80 text-sm font-medium mb-4 text-center flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-secondary" />
              Included with your account:
            </p>
            <div className="space-y-3 text-sm text-white/70">
              <div className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white font-medium">Gasless Smart Wallet</p>
                  <p className="text-white/60">No fees, no seed phrases, no hassle</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Bot className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white font-medium">AI Agent Access</p>
                  <p className="text-white/60">Chat with premium AI models</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Database className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white font-medium">MCP Server Management</p>
                  <p className="text-white/60">Configure AI agent capabilities</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white font-medium">Enterprise Security</p>
                  <p className="text-white/60">SOC2 Type II compliant infrastructure</p>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Footer */}
        <div className="text-center text-white/60 text-sm">
          <p>
            Already have an account?{" "}
            <Link href="/login" className="text-periwinkle hover:text-periwinkle/80 transition-colors">
              Sign in
            </Link>
          </p>
          <p className="mt-2">
            By creating an account, you agree to our{" "}
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