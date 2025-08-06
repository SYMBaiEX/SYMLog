'use client';

import { AlertTriangle, ArrowLeft, Brain, Home, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface ErrorInfo {
  type: string;
  message: string;
  code?: string;
}

const errorTypes = {
  auth_failed: {
    title: 'Authentication Failed',
    message: "We couldn't authenticate your account. Please try again.",
    suggestion: 'Check your credentials and try signing in again.',
  },
  wallet_error: {
    title: 'Wallet Connection Error',
    message: 'There was an issue connecting to your wallet.',
    suggestion:
      'Please ensure your wallet is properly configured and try again.',
  },
  session_expired: {
    title: 'Session Expired',
    message: 'Your authentication session has expired.',
    suggestion: 'Please start the authentication process again.',
  },
  network_error: {
    title: 'Network Error',
    message: 'Unable to connect to the authentication service.',
    suggestion: 'Check your internet connection and try again.',
  },
  server_error: {
    title: 'Server Error',
    message: "We're experiencing technical difficulties.",
    suggestion: 'Please try again in a few moments.',
  },
  invalid_request: {
    title: 'Invalid Request',
    message: 'The authentication request is invalid or malformed.',
    suggestion: 'Please start the authentication process from SYMLog again.',
  },
  default: {
    title: 'Authentication Error',
    message: 'An unexpected error occurred during authentication.',
    suggestion: 'Please try again or contact support if the issue persists.',
  },
};

function ErrorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);

  useEffect(() => {
    const errorType = searchParams.get('type') || 'default';
    const message = searchParams.get('message');
    const code = searchParams.get('code');

    const errorData =
      errorTypes[errorType as keyof typeof errorTypes] || errorTypes.default;

    setErrorInfo({
      type: errorType,
      message: message || errorData.message,
      code: code || undefined,
    });
  }, [searchParams]);

  const getErrorDetails = () => {
    if (!errorInfo) return errorTypes.default;
    return (
      errorTypes[errorInfo.type as keyof typeof errorTypes] ||
      errorTypes.default
    );
  };

  const handleRetry = () => {
    router.push('/');
  };

  const errorDetails = getErrorDetails();

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Background Effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black" />
        <div className="absolute top-0 left-1/4 h-96 w-96 animate-pulse-slow rounded-full bg-red-500/10 blur-[100px] filter" />
        <div className="absolute right-1/4 bottom-0 h-96 w-96 animate-pulse-slow rounded-full bg-orange-500/10 blur-[100px] filter" />
      </div>

      <div className="relative w-full max-w-sm sm:max-w-md lg:max-w-lg">
        {/* Header */}
        <div className="mb-6 text-center sm:mb-8">
          <div className="mb-4 flex flex-col items-center justify-center sm:mb-6 sm:flex-row">
            <Brain className="mb-2 h-10 w-10 text-gray-400 sm:mr-3 sm:mb-0 sm:h-12 sm:w-12" />
            <h1 className="font-bold text-2xl text-white sm:text-3xl">
              SYMLog Auth
            </h1>
          </div>
        </div>

        {/* Error Card */}
        <Card className="space-y-4 border border-red-500/20 p-6 sm:space-y-6 sm:p-8">
          <CardHeader className="p-0 text-center">
            <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-red-400 sm:mb-4 sm:h-16 sm:w-16" />
            <CardTitle className="mb-2 font-semibold text-lg text-white sm:text-xl">
              {errorDetails.title}
            </CardTitle>
            <CardDescription className="mb-3 text-gray-400 text-sm sm:mb-4 sm:text-base">
              {errorInfo?.message || errorDetails.message}
            </CardDescription>
            {errorInfo?.code && (
              <div className="mb-3 rounded-lg border border-red-500/30 bg-red-900/20 p-3 sm:mb-4">
                <code className="break-all text-red-300 text-xs sm:text-sm">
                  Error Code: {errorInfo.code}
                </code>
              </div>
            )}
            <p className="text-gray-300 text-sm sm:text-base">
              {errorDetails.suggestion}
            </p>
          </CardHeader>

          <CardContent className="p-0">
            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                className="h-12 w-full touch-manipulation font-semibold text-base sm:h-14 sm:text-lg"
                onClick={handleRetry}
                size="lg"
                variant="default"
              >
                <RefreshCw className="h-5 w-5" />
                Try Again
              </Button>

              <Button
                asChild
                className="h-12 w-full touch-manipulation font-semibold text-base sm:h-14 sm:text-lg"
                size="lg"
                variant="glass"
              >
                <Link href="/">
                  <Home className="h-5 w-5" />
                  Back to Login
                </Link>
              </Button>

              <Button
                className="h-10 w-full touch-manipulation text-gray-500 hover:text-gray-300"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.history.back();
                  }
                }}
                size="sm"
                variant="ghost"
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card className="mt-4 p-4 sm:mt-6 sm:p-6">
          <div className="text-center">
            <h3 className="mb-2 font-medium text-sm text-white sm:text-base">
              Need Help?
            </h3>
            <p className="mb-3 text-gray-400 text-xs sm:text-sm">
              If you continue to experience issues, try these steps:
            </p>
            <ul className="space-y-1 text-left text-gray-500 text-xs sm:text-sm">
              <li>• Clear your browser cache and cookies</li>
              <li>• Disable browser extensions temporarily</li>
              <li>• Try using an incognito/private window</li>
              <li>• Ensure SYMLog desktop app is running</li>
            </ul>
          </div>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center sm:mt-8">
          <p className="text-gray-500 text-xs sm:text-sm">
            SYMLog Authentication Portal
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-red-500 border-b-2" />
        </div>
      }
    >
      <ErrorPageContent />
    </Suspense>
  );
}
