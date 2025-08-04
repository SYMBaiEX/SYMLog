"use client"

import { 
  CrossmintProvider as CrossmintClientProvider, 
  CrossmintAuthProvider, 
  CrossmintWalletProvider 
} from "@crossmint/client-sdk-react-ui"

export function CrossmintProvider({ children }: { children: React.ReactNode }) {
  const clientApiKey = process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_KEY
  
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