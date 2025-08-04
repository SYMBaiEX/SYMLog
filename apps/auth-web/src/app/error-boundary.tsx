"use client"

import { useEffect } from "react"
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  useEffect(() => {
    // Log error details for debugging
    console.error("Crossmint Error Details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: (error as any).cause,
    })
  }, [error])

  const isBase58Error = error.message.includes("Non-base58 character")
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-background">
      <div className="relative w-full max-w-sm sm:max-w-md lg:max-w-lg">
        <Card className="p-6 sm:p-8">
          <CardHeader className="text-center p-0">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-xl sm:text-2xl font-semibold mb-2">
              {isBase58Error ? "Configuration Error" : "Something went wrong"}
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              {isBase58Error 
                ? "There's an issue with the Crossmint configuration. This is likely due to an invalid API key or configuration parameter."
                : "An unexpected error occurred while loading the authentication service."
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-0 mt-6">
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <p className="text-sm font-mono text-muted-foreground break-all">
                {error.message}
              </p>
            </div>
            
            <div className="space-y-3">
              <Button
                onClick={resetErrorBoundary}
                variant="default"
                size="lg"
                className="w-full"
              >
                Try Again
              </Button>
              
              <Button
                onClick={() => window.location.href = "/"}
                variant="outline"
                size="lg"
                className="w-full"
              >
                Return to Home
              </Button>
            </div>
            
            {isBase58Error && (
              <div className="mt-6 text-xs text-muted-foreground text-center">
                <p>If this error persists, please check:</p>
                <ul className="mt-2 space-y-1">
                  <li>• The Crossmint API key is correctly formatted</li>
                  <li>• Environment variables are properly set</li>
                  <li>• The Crossmint provider is properly configured</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function ErrorBoundaryWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Clear any cached state if needed
        window.location.reload()
      }}
      onError={(error, errorInfo) => {
        console.error("Error caught by boundary:", error, errorInfo)
      }}
    >
      {children}
    </ReactErrorBoundary>
  )
}