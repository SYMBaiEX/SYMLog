'use client';

import { useAuth, useWallet } from '@crossmint/client-sdk-react-ui';
import { useMutation } from 'convex/react';
import {
  Brain,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Shield,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { api } from '../../lib/convex';

function SuccessPageContent() {
  const router = useRouter();
  const { jwt, user, logout } = useAuth();
  const { wallet, status: walletStatus } = useWallet();
  const [authCode, setAuthCode] = useState<string>('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(600); // 10 minutes in seconds

  // Convex mutations
  const createAuthSession = useMutation(api.auth.createAuthSession);
  const updateAuthSession = useMutation(api.auth.updateAuthSession);

  const isLoggedIn = !!jwt && !!user;
  const isWalletReady = walletStatus === 'loaded' && wallet;

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/');
      return;
    }
  }, [isLoggedIn, router]);

  // Generate auth code when user arrives and wallet is ready
  useEffect(() => {
    if (isLoggedIn && isWalletReady && !authCode) {
      generateAuthCode();
    }
  }, [isLoggedIn, isWalletReady]);

  // Countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          toast.error(
            'Authentication code expired. Please generate a new one.'
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const generateAuthCode = async () => {
    if (!(user && wallet)) return;

    setIsGeneratingCode(true);
    try {
      // Generate a unique auth code
      const code = `SYM_${Math.random().toString(36).substring(2, 18).toUpperCase()}`;

      // Store auth session in Convex
      await createAuthSession({
        authCode: code,
        userId: user.id,
        userEmail: user.email || '',
        walletAddress: wallet.address || '',
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
        status: 'pending',
      });

      setAuthCode(code);
      setTimeRemaining(600); // Reset timer
      toast.success('Authentication code generated!');

      // Send auth code to parent window if opened as popup
      if (window.opener && window.opener !== window) {
        try {
          window.opener.postMessage(
            {
              type: 'SYMLOG_AUTH_CODE',
              authCode: code,
            },
            '*'
          );
          console.log('Sent auth code to parent window:', code);
        } catch (error) {
          console.error('Failed to send auth code to parent:', error);
        }
      }
    } catch (error) {
      console.error('Failed to generate auth code:', error);
      toast.error('Failed to generate authentication code');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const copyCodeToClipboard = async () => {
    if (!authCode) return;

    try {
      await navigator.clipboard.writeText(authCode);
      setCopiedCode(true);
      toast.success('Code copied to clipboard!');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (error) {
      toast.error('Failed to copy code');
    }
  };

  const handleDeepLink = () => {
    if (!authCode) return;

    try {
      // Send code to parent window if in popup mode
      if (window.opener && window.opener !== window) {
        try {
          window.opener.postMessage(
            {
              type: 'SYMLOG_AUTH_CODE',
              authCode,
            },
            '*'
          );
          toast.success('Code sent to main app!');
          // Close popup after sending
          setTimeout(() => window.close(), 1000);
          return;
        } catch (error) {
          console.error('Failed to send auth code to parent:', error);
          // If messaging fails, try web callback redirect
          const webCallbackUrl = process.env.NEXT_PUBLIC_WEB_CALLBACK_URL;
          if (webCallbackUrl) {
            window.location.href = `${webCallbackUrl}?code=${encodeURIComponent(authCode)}`;
            return;
          }
        }
      }

      // Fallback to deep link
      const deepLinkUrl = `${process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL}?code=${encodeURIComponent(authCode)}`;
      window.location.href = deepLinkUrl;

      // Also show success message
      toast.success('Opening SYMLog app...');

      // Mark as completed in database
      updateAuthSession({
        authCode,
        status: 'completed',
      }).catch(console.error);
    } catch (error) {
      console.error('Deep link failed:', error);
      toast.error('Failed to open SYMLog app. Please copy the code manually.');
    }
  };

  const handleLogout = () => {
    try {
      logout();
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error('Logout failed');
    }
  };

  if (!isLoggedIn) {
    return null; // Will redirect
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6 lg:p-8">
      {/* Theme Toggle - positioned at top right */}
      <div className="fixed top-4 right-4 z-50">
        <ModeToggle />
      </div>

      {/* Background Effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background" />
        <div className="absolute top-0 left-1/4 h-96 w-96 animate-pulse-slow rounded-full bg-primary/10 blur-[100px] filter" />
        <div className="absolute right-1/4 bottom-0 h-96 w-96 animate-pulse-slow rounded-full bg-secondary/10 blur-[100px] filter" />
      </div>

      <div className="relative w-full max-w-sm sm:max-w-md lg:max-w-lg">
        {/* Header */}
        <div className="mb-6 text-center sm:mb-8">
          <div className="mb-4 flex flex-col items-center justify-center sm:flex-row">
            <Brain className="mb-2 h-10 w-10 text-primary sm:mr-3 sm:mb-0 sm:h-12 sm:w-12" />
            <h1 className="gradient-text from-primary to-secondary text-center font-bold text-2xl sm:text-3xl lg:text-4xl">
              Authentication Complete
            </h1>
          </div>
        </div>

        {/* Success Card */}
        <Card className="space-y-4 p-6 sm:space-y-6 sm:p-8">
          <CardHeader className="p-0 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-secondary sm:mb-4 sm:h-16 sm:w-16" />
            <CardTitle className="mb-2 font-semibold text-lg sm:text-xl">
              Success!
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Your authentication code is ready. Use it to sign in to SYMLog.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            {/* Auth Code Display */}
            {authCode ? (
              <div className="space-y-4">
                {/* Timer */}
                <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm sm:text-base">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span>Expires in {formatTime(timeRemaining)}</span>
                </div>

                <div className="glass rounded-lg bg-gray-800/50 p-3 sm:p-4">
                  <label className="mb-2 block text-muted-foreground text-sm sm:text-base">
                    Authentication Code
                  </label>
                  <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
                    <code className="w-full flex-1 break-all rounded border-primary border-l-4 bg-background/50 px-3 py-2 text-center font-mono text-base text-foreground sm:py-3 sm:text-left sm:text-lg">
                      {authCode}
                    </code>
                    <Button
                      className="h-10 w-full touch-manipulation sm:h-9 sm:w-9 sm:w-auto"
                      onClick={copyCodeToClipboard}
                      size="icon"
                      title="Copy code"
                      variant="glass"
                    >
                      {copiedCode ? (
                        <CheckCircle2 className="h-5 w-5 text-secondary" />
                      ) : (
                        <Copy className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="ml-2 sm:hidden">
                        {copiedCode ? 'Copied!' : 'Copy Code'}
                      </span>
                    </Button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button
                    className="h-12 w-full touch-manipulation bg-secondary/20 font-semibold text-base hover:bg-secondary/30 sm:h-14 sm:text-lg"
                    onClick={handleDeepLink}
                    size="lg"
                    variant="glass"
                  >
                    <ExternalLink className="h-5 w-5" />
                    Open SYMLog App
                  </Button>

                  <Button
                    className="h-12 w-full touch-manipulation font-semibold text-base sm:h-14 sm:text-lg"
                    disabled={isGeneratingCode}
                    onClick={generateAuthCode}
                    size="lg"
                    variant="default"
                  >
                    {isGeneratingCode ? 'Generating...' : 'Generate New Code'}
                  </Button>

                  <div className="text-center">
                    <p className="mb-2 text-muted-foreground text-xs sm:text-sm">
                      Can't open the app automatically?
                    </p>
                    <p className="text-muted-foreground/80 text-xs sm:text-sm">
                      Copy the code above and paste it in SYMLog's login dialog
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
                <p className="text-muted-foreground">
                  {isWalletReady
                    ? 'Generating authentication code...'
                    : 'Creating your wallet...'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Info Card */}
        <Card className="mt-4 p-4 sm:mt-6 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center sm:gap-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 sm:h-12 sm:w-12">
                <span className="font-bold text-primary text-sm sm:text-base">
                  {(user?.email || user?.id || 'U')?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="break-all font-medium text-foreground text-sm sm:text-base">
                  {user?.email || user?.id || 'Unknown User'}
                </p>
                <p className="flex items-center gap-1 text-muted-foreground text-xs sm:text-sm">
                  <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
                  {isWalletReady ? 'Wallet Connected' : 'Creating wallet...'}
                </p>
              </div>
            </div>
            <Button
              className="w-full touch-manipulation text-muted-foreground hover:text-foreground sm:w-auto"
              onClick={handleLogout}
              size="sm"
              variant="ghost"
            >
              Sign Out
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
        </div>
      }
    >
      <SuccessPageContent />
    </Suspense>
  );
}
