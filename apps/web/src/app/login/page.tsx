'use client';

import { useAuth } from '@crossmint/client-sdk-react-ui';
import {
  Brain,
  CheckCircle2,
  Globe,
  Mail,
  Shield,
  Twitter,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';

export default function LoginPage() {
  const router = useRouter();

  // Check if Crossmint is available
  const clientApiKey = process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_KEY as string;
  const isCrossmintEnabled =
    clientApiKey && clientApiKey !== 'your_client_api_key_here';

  // Always call the hook, but only use the result if Crossmint is enabled
  const auth = useAuth();
  const login = isCrossmintEnabled ? auth.login : undefined;
  const jwt = isCrossmintEnabled ? auth.jwt : undefined;
  const user = isCrossmintEnabled ? auth.user : undefined;

  // Redirect if already logged in
  useEffect(() => {
    if (jwt && user) {
      router.push('/');
    }
  }, [jwt, user, router]);

  const handleSocialLogin = async (provider: string) => {
    try {
      if (login) {
        await login();
      }
    } catch (error) {
      console.error(`${provider} login failed:`, error);
    }
  };

  if (jwt && user) {
    return null; // Will redirect
  }

  if (!isCrossmintEnabled) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <GlassCard className="w-full max-w-md p-8 text-center">
          <Brain className="mx-auto mb-4 h-16 w-16 text-periwinkle" />
          <h1 className="mb-4 font-bold text-2xl text-white">
            Crossmint Setup Required
          </h1>
          <p className="mb-4 text-white/70">
            To enable social login and smart wallets, please configure your
            Crossmint API keys in the environment variables.
          </p>
          <p className="text-sm text-white/60">
            Add{' '}
            <code className="rounded bg-white/10 px-2 py-1">
              NEXT_PUBLIC_CROSSMINT_CLIENT_KEY
            </code>{' '}
            to your .env.local file.
          </p>
          <div className="mt-6">
            <Link href="/">
              <GlassButton variant="default">Return Home</GlassButton>
            </Link>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link
            className="group mb-8 inline-flex items-center space-x-3"
            href="/"
          >
            <Brain className="h-12 w-12 text-periwinkle group-hover:animate-pulse" />
            <span className="gradient-text from-periwinkle to-light-green font-bold text-4xl">
              SYMLog
            </span>
          </Link>
          <h1 className="mb-2 font-bold text-3xl text-white">Welcome Back</h1>
          <p className="text-white/70">Sign in to your AI Agent Platform</p>
        </div>

        {/* Login Card */}
        <GlassCard className="space-y-6 p-8">
          <div className="mb-6 text-center">
            <h2 className="mb-2 font-semibold text-white text-xl">
              Choose your sign-in method
            </h2>
            <p className="text-sm text-white/60">
              Secure, gasless smart wallet included
            </p>
          </div>

          {/* Social Login Buttons */}
          <div className="space-y-3">
            <GlassButton
              className="glow-primary flex w-full items-center justify-center gap-3"
              onClick={() => handleSocialLogin('google')}
              variant="default"
            >
              <Mail className="h-5 w-5" />
              Continue with Google
            </GlassButton>

            <GlassButton
              className="flex w-full items-center justify-center gap-3"
              onClick={() => handleSocialLogin('twitter')}
              variant="secondary"
            >
              <Twitter className="h-5 w-5" />
              Continue with Twitter
            </GlassButton>

            <GlassButton
              className="flex w-full items-center justify-center gap-3"
              onClick={() => handleSocialLogin('email')}
              variant="outline"
            >
              <Mail className="h-5 w-5" />
              Continue with Email
            </GlassButton>

            <GlassButton
              className="flex w-full items-center justify-center gap-3"
              onClick={() => handleSocialLogin('farcaster')}
              variant="ghost"
            >
              <Globe className="h-5 w-5" />
              Continue with Farcaster
            </GlassButton>
          </div>

          {/* Features */}
          <div className="border-white/10 border-t pt-6">
            <p className="mb-3 text-center font-medium text-sm text-white/80">
              What you get:
            </p>
            <div className="space-y-2 text-sm text-white/70">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-secondary" />
                <span>Gasless transactions - no fees required</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-secondary" />
                <span>Secure smart wallet with social recovery</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-secondary" />
                <span>Access to premium AI agents</span>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Footer */}
        <div className="text-center text-sm text-white/60">
          <p>
            New to SYMLog?{' '}
            <Link
              className="text-periwinkle transition-colors hover:text-periwinkle/80"
              href="/signup"
            >
              Create an account
            </Link>
          </p>
          <p className="mt-2">
            By signing in, you agree to our{' '}
            <Link
              className="text-periwinkle transition-colors hover:text-periwinkle/80"
              href="/terms"
            >
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link
              className="text-periwinkle transition-colors hover:text-periwinkle/80"
              href="/privacy"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
