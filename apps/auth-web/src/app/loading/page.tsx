'use client';

import { Brain, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function LoadingPage() {
  const message = 'Authenticating...';
  const progress = undefined;
  const [dots, setDots] = useState('');

  // Animated dots effect
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Background Effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black" />
        <div className="absolute top-0 left-1/4 h-96 w-96 animate-pulse-slow rounded-full bg-periwinkle/10 blur-[100px] filter" />
        <div className="absolute right-1/4 bottom-0 h-96 w-96 animate-pulse-slow rounded-full bg-light-green/10 blur-[100px] filter" />
      </div>

      <div className="relative w-full max-w-sm sm:max-w-md lg:max-w-lg">
        {/* Header */}
        <div className="mb-6 text-center sm:mb-8">
          <div className="mb-4 flex flex-col items-center justify-center sm:flex-row">
            <Brain className="mb-2 h-10 w-10 animate-pulse text-periwinkle sm:mr-3 sm:mb-0 sm:h-12 sm:w-12" />
            <h1 className="gradient-text from-periwinkle to-light-green font-bold text-2xl sm:text-3xl">
              SYMLog Auth
            </h1>
          </div>
        </div>

        {/* Loading Card */}
        <Card className="space-y-4 p-6 sm:space-y-6 sm:p-8">
          <CardHeader className="p-0 text-center">
            {/* Spinner */}
            <div className="relative">
              <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-periwinkle sm:mb-6 sm:h-16 sm:w-16" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-8 w-8 animate-ping rounded-full bg-periwinkle/20 sm:h-12 sm:w-12" />
              </div>
            </div>

            {/* Loading Message */}
            <CardTitle className="mb-2 font-semibold text-lg text-white sm:text-xl">
              {message}
              {dots}
            </CardTitle>
            <CardDescription className="mb-4 text-gray-400 text-sm sm:mb-6 sm:text-base">
              Please wait while we process your request
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            {/* Progress Bar */}
            {progress !== undefined && (
              <div className="mb-4 h-2 w-full rounded-full bg-gray-800">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-periwinkle to-light-green transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
            )}

            {/* Loading Steps */}
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-gray-400 text-sm sm:text-base">
                <div className="h-2 w-2 animate-pulse rounded-full bg-periwinkle" />
                <span>Connecting to authentication service</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-gray-500 text-sm sm:text-base">
                <div className="h-2 w-2 rounded-full bg-gray-600" />
                <span>Verifying credentials</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-gray-500 text-sm sm:text-base">
                <div className="h-2 w-2 rounded-full bg-gray-600" />
                <span>Setting up secure session</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tips Card */}
        <Card className="mt-4 p-4 sm:mt-6 sm:p-6">
          <div className="text-center">
            <h3 className="mb-2 font-medium text-sm text-white sm:text-base">
              💡 Tip
            </h3>
            <p className="text-gray-400 text-xs sm:text-sm">
              Keep this window open while authenticating. The process usually
              takes less than 30 seconds.
            </p>
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
