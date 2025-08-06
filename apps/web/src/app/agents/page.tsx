'use client';

import { useAuth } from '@crossmint/client-sdk-react-ui';
import { Lock, Sparkles, User } from 'lucide-react';
import Link from 'next/link';
import { AgentDashboard } from '@/components/agents/agent-dashboard';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';

export default function AgentsPage() {
  const auth = useAuth();
  const isAuthenticated = !!auth.jwt && !!auth.user;

  // Show authentication required state
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <GlassCard className="p-8 text-center">
            <Lock className="mx-auto mb-6 h-16 w-16 text-muted-foreground" />
            <h1 className="mb-4 font-bold text-3xl">Authentication Required</h1>
            <p className="mb-6 text-lg text-muted-foreground">
              Please sign in to access your AI agent dashboard and view your
              agents&apos; knowledge, memories, and learning progress.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link href="/login">
                <GlassButton className="gap-2">
                  <User className="h-4 w-4" />
                  Sign In
                </GlassButton>
              </Link>
              <Link href="/signup">
                <GlassButton className="gap-2" variant="outline">
                  <Sparkles className="h-4 w-4" />
                  Create Account
                </GlassButton>
              </Link>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-periwinkle" />
          <h1 className="gradient-text from-periwinkle to-light-green font-bold text-4xl">
            Agent Dashboard
          </h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Monitor and explore your AI agents&apos; knowledge, memories, and
          learning journey
        </p>
      </div>

      {/* Agent Dashboard Component */}
      <AgentDashboard
        className="mx-auto max-w-7xl"
        userId={auth.user?.id || 'anonymous'}
      />
    </div>
  );
}
