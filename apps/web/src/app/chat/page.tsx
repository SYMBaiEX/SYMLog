'use client';

import { useAuth } from '@crossmint/client-sdk-react-ui';
import { Brain, Loader2, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChatContainer } from '@/components/chat/chat-container';
import { ChatErrorBoundary } from '@/components/chat-error-boundary';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';
import { config } from '@/lib/config';

export default function ChatPage() {
  const router = useRouter();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if Crossmint is available
  const isCrossmintEnabled = config.isCrossmintAuthEnabled();

  // Always call the hook, but only use the result if Crossmint is enabled
  const auth = useAuth();
  const jwt = isCrossmintEnabled ? auth.jwt : undefined;
  const user = isCrossmintEnabled ? auth.user : undefined;

  useEffect(() => {
    const verifyAndCreateSession = async () => {
      if (!(jwt && user)) {
        setIsLoading(false);
        return;
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
        });

        if (!response.ok) {
          throw new Error('Failed to verify authentication');
        }

        const data = await response.json();

        if (data.isValid && data.sessionToken) {
          setSessionToken(data.sessionToken);
        } else {
          throw new Error('Invalid authentication');
        }
      } catch (error) {
        console.error('Authentication error:', error);
        // Redirect to login on auth failure
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    verifyAndCreateSession();
  }, [jwt, user, router]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <GlassCard className="p-8 text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-periwinkle" />
          <h2 className="mb-2 font-semibold text-xl">Loading AI Chat</h2>
          <p className="text-muted-foreground">
            Verifying your authentication...
          </p>
        </GlassCard>
      </div>
    );
  }

  // Not authenticated
  if (!(sessionToken && user)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <GlassCard className="w-full max-w-md p-8 text-center">
          <Lock className="mx-auto mb-4 h-16 w-16 text-periwinkle" />
          <h1 className="mb-4 font-bold text-2xl">Authentication Required</h1>
          <p className="mb-6 text-muted-foreground">
            Please sign in to access the AI chat assistant. Only authenticated
            users can use this feature.
          </p>
          <div className="space-y-3">
            <Link className="block" href="/login">
              <GlassButton className="w-full" size="lg">
                Sign In
              </GlassButton>
            </Link>
            <Link className="block" href="/signup">
              <GlassButton className="w-full" size="lg" variant="outline">
                Create Account
              </GlassButton>
            </Link>
          </div>
        </GlassCard>
      </div>
    );
  }

  // Check if AI is configured
  const isAIConfigured = true; // Config service will handle validation

  if (!isAIConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <GlassCard className="w-full max-w-md p-8 text-center">
          <Brain className="mx-auto mb-4 h-16 w-16 text-periwinkle" />
          <h1 className="mb-4 font-bold text-2xl">AI Configuration Required</h1>
          <p className="mb-4 text-muted-foreground">
            The AI service is not configured. Please add your OpenAI API key to
            the environment variables.
          </p>
          <p className="text-muted-foreground text-sm">
            Add{' '}
            <code className="rounded bg-white/10 px-2 py-1">
              OPENAI_API_KEY
            </code>{' '}
            to your .env.local file.
          </p>
        </GlassCard>
      </div>
    );
  }

  // Authenticated - show chat
  return (
    <ChatErrorBoundary onReset={() => setSessionToken(null)}>
      <div className="min-h-screen bg-background">
        <ChatContainer
          sessionToken={sessionToken}
          userEmail={user.email}
          userId={user.id || (user as any).sub}
        />
      </div>
    </ChatErrorBoundary>
  );
}
