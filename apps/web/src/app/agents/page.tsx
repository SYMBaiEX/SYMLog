"use client"

import { useAuth } from "@crossmint/client-sdk-react-ui"
import { AgentDashboard } from "@/components/agents/agent-dashboard"
import { GlassCard } from "@/components/ui/glass-card"
import { GlassButton } from "@/components/ui/glass-button"
import { Sparkles, Lock, User } from "lucide-react"
import Link from "next/link"

export default function AgentsPage() {
  const auth = useAuth()
  const isAuthenticated = !!auth.jwt && !!auth.user
  
  // Show authentication required state
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-2xl mx-auto">
          <GlassCard className="p-8 text-center">
            <Lock className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
            <h1 className="text-3xl font-bold mb-4">Authentication Required</h1>
            <p className="text-lg text-muted-foreground mb-6">
              Please sign in to access your AI agent dashboard and view your agents&apos; knowledge, memories, and learning progress.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login">
                <GlassButton className="gap-2">
                  <User className="h-4 w-4" />
                  Sign In
                </GlassButton>
              </Link>
              <Link href="/signup">
                <GlassButton variant="outline" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Create Account
                </GlassButton>
              </Link>
            </div>
          </GlassCard>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="h-8 w-8 text-periwinkle" />
          <h1 className="text-4xl font-bold gradient-text from-periwinkle to-light-green">
            Agent Dashboard
          </h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Monitor and explore your AI agents&apos; knowledge, memories, and learning journey
        </p>
      </div>
      
      {/* Agent Dashboard Component */}
      <AgentDashboard 
        userId={auth.user?.id || auth.user?.userId || 'anonymous'} 
        className="max-w-7xl mx-auto"
      />
    </div>
  )
}