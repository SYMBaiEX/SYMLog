"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@crossmint/client-sdk-react-ui"
import { ChatContainer } from "@/components/chat/chat-container"
import { GlassCard } from "@/components/ui/glass-card"
import { GlassButton } from "@/components/ui/glass-button"
import { Brain, Lock, Loader2 } from "lucide-react"
import Link from "next/link"
import { ChatErrorBoundary } from "@/components/chat-error-boundary"
import { config } from "@/lib/config"

export default function ChatPage() {
  const router = useRouter()
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Check if Crossmint is available
  const isCrossmintEnabled = config.isCrossmintAuthEnabled()

  // Always call the hook, but only use the result if Crossmint is enabled
  const auth = useAuth()
  const jwt = isCrossmintEnabled ? auth.jwt : undefined
  const user = isCrossmintEnabled ? auth.user : undefined

  useEffect(() => {
    const verifyAndCreateSession = async () => {
      if (!jwt || !user) {
        setIsLoading(false)
        return
      }

      try {
        // Verify the Crossmint token and get a session token
        const response = await fetch('/api/auth/crossmint-verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: jwt,
            walletAddress: (user as any).walletAddress,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to verify authentication')
        }

        const data = await response.json()
        
        if (data.isValid && data.sessionToken) {
          setSessionToken(data.sessionToken)
        } else {
          throw new Error('Invalid authentication')
        }
      } catch (error) {
        console.error('Authentication error:', error)
        // Redirect to login on auth failure
        router.push('/login')
      } finally {
        setIsLoading(false)
      }
    }

    verifyAndCreateSession()
  }, [jwt, user, router])

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <GlassCard className="p-8 text-center">
          <Loader2 className="h-12 w-12 text-periwinkle animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Loading AI Chat</h2>
          <p className="text-muted-foreground">Verifying your authentication...</p>
        </GlassCard>
      </div>
    )
  }

  // Not authenticated
  if (!sessionToken || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <GlassCard className="p-8 max-w-md w-full text-center">
          <Lock className="h-16 w-16 text-periwinkle mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="text-muted-foreground mb-6">
            Please sign in to access the AI chat assistant. Only authenticated users can use this feature.
          </p>
          <div className="space-y-3">
            <Link href="/login" className="block">
              <GlassButton className="w-full" size="lg">
                Sign In
              </GlassButton>
            </Link>
            <Link href="/signup" className="block">
              <GlassButton variant="outline" className="w-full" size="lg">
                Create Account
              </GlassButton>
            </Link>
          </div>
        </GlassCard>
      </div>
    )
  }

  // Check if AI is configured
  const isAIConfigured = true // Config service will handle validation

  if (!isAIConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <GlassCard className="p-8 max-w-md w-full text-center">
          <Brain className="h-16 w-16 text-periwinkle mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">AI Configuration Required</h1>
          <p className="text-muted-foreground mb-4">
            The AI service is not configured. Please add your OpenAI API key to the environment variables.
          </p>
          <p className="text-sm text-muted-foreground">
            Add <code className="bg-white/10 px-2 py-1 rounded">OPENAI_API_KEY</code> to your .env.local file.
          </p>
        </GlassCard>
      </div>
    )
  }

  // Authenticated - show chat
  return (
    <div className="min-h-screen bg-background">
      <ChatContainer
        sessionToken={sessionToken}
        userId={user.id || (user as any).sub}
        userEmail={user.email}
      />
    </div>
  )
}