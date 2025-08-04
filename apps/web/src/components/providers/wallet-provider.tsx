"use client"

import { 
  CrossmintProvider, 
  CrossmintAuthProvider 
} from "@crossmint/client-sdk-react-ui"

interface WalletProviderWrapperProps {
  children: React.ReactNode
}

export function WalletProviderWrapper({ children }: WalletProviderWrapperProps) {
  const clientApiKey = process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_KEY as string

  // For development, if no API key is provided, fallback gracefully
  if (!clientApiKey || clientApiKey === 'your_client_api_key_here') {
    console.warn("NEXT_PUBLIC_CROSSMINT_CLIENT_KEY is not configured. Crossmint features will be disabled.")
    return <>{children}</>
  }

  return (
    <CrossmintProvider apiKey={clientApiKey}>
      <CrossmintAuthProvider
        loginMethods={["google", "twitter", "email", "farcaster"]}
      >
        {children}  
      </CrossmintAuthProvider>
    </CrossmintProvider>
  )
}