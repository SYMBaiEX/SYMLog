'use client';

import { useAuth } from '@crossmint/client-sdk-react-ui';
import { Brain, CheckCircle2, Shield, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
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

export default function HomePage() {
  const router = useRouter();
  const { login, jwt, user } = useAuth();

  const isLoggedIn = !!jwt && !!user;

  // Redirect to success page if already authenticated
  useEffect(() => {
    if (isLoggedIn) {
      router.push('/success');
    }
  }, [isLoggedIn, router]);

  const handleLogin = async () => {
    try {
      // Show loading state
      toast.loading('Connecting to authentication service...');

      await login();

      // Success will be handled by the useEffect redirect
      toast.dismiss();
      toast.success('Authentication successful! Redirecting...');
    } catch (error) {
      console.error('Login failed:', error);
      toast.dismiss();
      toast.error('Login failed. Please try again.');

      // Redirect to error page with details
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      router.push(
        `/error?type=auth_failed&message=${encodeURIComponent(errorMessage)}`
      );
    }
  };

  // Don't render if user is logged in (will redirect)
  if (isLoggedIn) {
    return null;
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
          <div className="mb-4 flex items-center justify-center sm:mb-6">
            <Brain className="h-12 w-12 text-primary sm:h-16 sm:w-16" />
          </div>
          <h1 className="gradient-text mb-3 from-primary to-secondary font-bold text-3xl sm:mb-4 sm:text-4xl lg:text-5xl">
            Welcome to SYMLog
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Secure Authentication Portal
          </p>
        </div>

        {/* Login Card */}
        <Card className="space-y-4 p-6 sm:space-y-6 sm:p-8">
          <CardHeader className="p-0 text-center">
            <CardTitle className="mb-2 font-semibold text-xl sm:mb-3 sm:text-2xl">
              Sign in to continue
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Connect your account to generate an authentication code for your
              SYMLog desktop application.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            {/* Login Button */}
            <Button
              className="h-12 w-full touch-manipulation font-semibold text-base sm:h-14 sm:text-lg"
              onClick={handleLogin}
              size="lg"
              variant="default"
            >
              Sign in with Crossmint
            </Button>
          </CardContent>

          {/* Features */}
          <div className="grid grid-cols-3 gap-3 pt-3 sm:gap-4 sm:pt-4">
            <div className="text-center">
              <div className="glass mb-2 rounded-lg p-2 sm:p-3">
                <Shield className="mx-auto h-5 w-5 text-primary sm:h-6 sm:w-6" />
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm">Secure</p>
            </div>
            <div className="text-center">
              <div className="glass mb-2 rounded-lg p-2 sm:p-3">
                <Zap className="mx-auto h-5 w-5 text-secondary sm:h-6 sm:w-6" />
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm">Fast</p>
            </div>
            <div className="text-center">
              <div className="glass mb-2 rounded-lg p-2 sm:p-3">
                <CheckCircle2 className="mx-auto h-5 w-5 text-accent sm:h-6 sm:w-6" />
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Trusted
              </p>
            </div>
          </div>
        </Card>

        {/* How it Works */}
        <Card className="mt-4 p-4 sm:mt-6 sm:p-6">
          <CardHeader className="p-0 pb-3 text-center sm:pb-4">
            <CardTitle className="font-semibold text-base sm:text-lg">
              How it works
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/20">
                  <span className="font-bold text-primary text-xs">1</span>
                </div>
                <p className="text-foreground text-sm sm:text-base">
                  Sign in with your Crossmint account
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-secondary/20">
                  <span className="font-bold text-secondary text-xs">2</span>
                </div>
                <p className="text-foreground text-sm sm:text-base">
                  Get your unique authentication code
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent/20">
                  <span className="font-bold text-accent text-xs">3</span>
                </div>
                <p className="text-foreground text-sm sm:text-base">
                  Return to SYMLog and paste the code
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Support */}
        <div className="mt-6 text-center sm:mt-8">
          <p className="mb-2 text-muted-foreground text-xs sm:text-sm">
            Need help? Make sure SYMLog desktop app is running
          </p>
          <p className="text-muted-foreground/80 text-xs sm:text-sm">
            Authentication codes expire after 10 minutes for security
          </p>
        </div>
      </div>
    </div>
  );
}
