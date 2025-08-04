'use client'

import React from 'react'
import { ErrorBoundary } from './error-boundary'
import { AlertCircle, Wallet, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface WalletErrorBoundaryProps {
  children: React.ReactNode
}

export function WalletErrorBoundary({ children }: WalletErrorBoundaryProps) {
  return (
    <ErrorBoundary
      level="component"
      isolate
      fallback={
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 text-destructive">
          <Wallet className="h-4 w-4" />
          <span className="text-sm">Wallet connection error</span>
          <Button
            onClick={() => window.location.reload()}
            variant="ghost"
            size="sm"
            className="h-auto py-0.5 px-2"
          >
            Retry
          </Button>
        </div>
      }
      onError={(error) => {
        // Common wallet errors
        const errorMessage = error.message.toLowerCase()
        
        if (errorMessage.includes('user rejected')) {
          console.log('User rejected wallet connection')
        } else if (errorMessage.includes('phantom') && errorMessage.includes('not found')) {
          console.log('Phantom wallet not installed')
        } else if (errorMessage.includes('network')) {
          console.log('Network error during wallet connection')
        } else {
          console.error('Wallet error:', error)
        }
      }}
    >
      {children}
    </ErrorBoundary>
  )
}

// Specific error boundary for Crossmint authentication
export function CrossmintErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      level="component"
      isolate
      resetOnPropsChange
      fallback={
        <Alert variant="destructive" className="max-w-md">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>Crossmint Connection Error</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3">Unable to connect to Crossmint authentication service.</p>
            <div className="space-y-2 text-sm">
              <p>Possible solutions:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Check your internet connection</li>
                <li>Disable ad blockers for this site</li>
                <li>Try a different browser</li>
              </ul>
            </div>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              size="sm"
              className="mt-3"
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      }
    >
      {children}
    </ErrorBoundary>
  )
}