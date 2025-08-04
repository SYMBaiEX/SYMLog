'use client'

import React from 'react'
import { ErrorBoundary } from './error-boundary'
import { AlertCircle, MessageSquareOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface ChatErrorBoundaryProps {
  children: React.ReactNode
  onReset?: () => void
}

export function ChatErrorBoundary({ children, onReset }: ChatErrorBoundaryProps) {
  return (
    <ErrorBoundary
      level="section"
      fallback={
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-destructive/10 rounded-full">
                <MessageSquareOff className="h-8 w-8 text-destructive" />
              </div>
            </div>
            
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Chat Error</AlertTitle>
              <AlertDescription className="mt-2 space-y-3">
                <p>We encountered an error with the chat system. This could be due to:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Connection issues</li>
                  <li>Invalid message format</li>
                  <li>AI service unavailability</li>
                </ul>
                <div className="flex gap-2 pt-2">
                  <Button 
                    onClick={() => {
                      onReset?.()
                      window.location.reload()
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reload Chat
                  </Button>
                  <Button
                    onClick={() => {
                      // Clear chat history from localStorage
                      localStorage.removeItem('chat-history')
                      localStorage.removeItem('chat-session')
                      window.location.reload()
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Clear & Restart
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
            
            <p className="text-sm text-muted-foreground text-center">
              If the problem persists, please contact support.
            </p>
          </div>
        </div>
      }
      onError={(error, errorInfo) => {
        // Log chat-specific errors
        console.error('Chat error:', error)
        console.error('Component stack:', errorInfo.componentStack)
        
        // Could send to error tracking service
        if (typeof window !== 'undefined' && window.Sentry) {
          window.Sentry.captureException(error, {
            contexts: {
              component: {
                name: 'Chat',
                stack: errorInfo.componentStack
              }
            }
          })
        }
      }}
    >
      {children}
    </ErrorBoundary>
  )
}