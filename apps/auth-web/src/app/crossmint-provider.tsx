"use client"

import { 
  CrossmintProvider as CrossmintClientProvider, 
  CrossmintAuthProvider, 
  CrossmintWalletProvider 
} from "@crossmint/client-sdk-react-ui"
import { useEffect, useState, Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div role="alert" className="p-4 text-sm text-red-600">
      <p>Something went wrong with Crossmint initialization:</p>
      <pre className="mt-2 text-xs">{error.message}</pre>
    </div>
  )
}

function CrossmintProviderInner({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false)
  const clientApiKey = process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_KEY
  
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  if (!isClient) {
    return <>{children}</>
  }
  
  if (!clientApiKey || clientApiKey === 'your_client_api_key_here') {
    console.warn("Crossmint API key not configured")
    return <>{children}</>
  }

  try {
    return (
      <CrossmintClientProvider 
        apiKey={clientApiKey}
      >
        <CrossmintAuthProvider>
          <CrossmintWalletProvider>
            {children}
          </CrossmintWalletProvider>
        </CrossmintAuthProvider>
      </CrossmintClientProvider>
    )
  } catch (error) {
    console.error("Crossmint initialization error:", error)
    return <>{children}</>
  }
}

export function CrossmintProvider({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary 
      FallbackComponent={ErrorFallback}
      onError={(error) => console.error("Crossmint Provider Error:", error)}
    >
      <Suspense fallback={<>{children}</>}>
        <CrossmintProviderInner>
          {children}
        </CrossmintProviderInner>
      </Suspense>
    </ErrorBoundary>
  )
}