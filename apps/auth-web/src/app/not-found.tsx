'use client';

import { ArrowLeft, Brain, Home } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Background Effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black" />
        <div className="absolute top-0 left-1/4 h-96 w-96 animate-pulse-slow rounded-full bg-primary/10 blur-[100px] filter" />
        <div className="absolute right-1/4 bottom-0 h-96 w-96 animate-pulse-slow rounded-full bg-secondary/10 blur-[100px] filter" />
      </div>

      <div className="relative w-full max-w-sm text-center sm:max-w-md lg:max-w-lg">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="mb-4 flex items-center justify-center sm:mb-6">
            <Brain className="h-12 w-12 text-primary sm:h-16 sm:w-16" />
          </div>
          <h1 className="mb-3 font-bold text-5xl text-white sm:mb-4 sm:text-6xl lg:text-7xl">
            404
          </h1>
          <h2 className="gradient-text mb-2 from-primary to-secondary font-semibold text-xl sm:text-2xl lg:text-3xl">
            Page Not Found
          </h2>
          <p className="text-gray-400 text-sm sm:text-base">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Action Card */}
        <Card className="space-y-4 p-6 sm:space-y-6 sm:p-8">
          <div className="space-y-3 sm:space-y-4">
            <Button
              asChild
              className="h-12 w-full touch-manipulation font-semibold text-base sm:h-14 sm:text-lg"
              size="lg"
              variant="default"
            >
              <Link href="/">
                <Home className="h-5 w-5" />
                Go to Authentication
              </Link>
            </Button>

            <Button
              className="h-12 w-full touch-manipulation font-semibold text-base sm:h-14 sm:text-lg"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.history.back();
                }
              }}
              size="lg"
              variant="glass"
            >
              <ArrowLeft className="h-5 w-5" />
              Go Back
            </Button>
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
