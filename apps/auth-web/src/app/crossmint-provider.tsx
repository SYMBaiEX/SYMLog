"use client"

import { 
  CrossmintProvider as CrossmintClientProvider, 
  CrossmintAuthProvider, 
  CrossmintWalletProvider 
} from "@crossmint/client-sdk-react-ui"
import { useEffect, useState } from "react"

export function CrossmintProvider({ children }: { children: React.ReactNode }) {
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
}