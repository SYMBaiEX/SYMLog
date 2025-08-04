"use client"

import { 
  CrossmintProvider, 
  CrossmintAuthProvider, 
  CrossmintWalletProvider 
} from "@crossmint/client-sdk-react-ui"
import { useEffect, useState } from "react"

export function CrossmintProviderWrapper({ children }: { children: React.ReactNode }) {
  const clientApiKey = process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_KEY
  const [isTauri, setIsTauri] = useState(false)
  
  // Detect if running in Tauri
  useEffect(() => {
    const checkTauri = async () => {
      try {
        // Check if we're in a Tauri environment
        if (typeof window !== 'undefined' && window.__TAURI__) {
          setIsTauri(true)
        }
      } catch (error) {
        setIsTauri(false)
      }
    }
    checkTauri()
  }, [])
  
  // Only render provider if API key is available
  if (!clientApiKey || clientApiKey === 'your_client_api_key_here') {
    console.warn("Crossmint API key not configured")
    return <>{children}</>
  }

  return (
    <CrossmintProvider 
      apiKey={clientApiKey}
      // Configure for desktop/local environment
      environment="production"
    >
      <CrossmintAuthProvider
        embeddedWallets={{
          createOnLogin: "all-users",
          defaultChain: "polygon", 
          type: "evm-smart-wallet",
        }}
        loginMethods={[
          "email",
          "google", 
          "apple",
          "discord",
          "twitter"
        ]}
        // Disable popup-based flows for desktop
        appearance={{
          embedded: true,
          forceEmbedded: isTauri
        }}
      >
        <CrossmintWalletProvider
          createOnLogin={{
            chain: "polygon",
            signer: {
              type: "evm-smart-wallet",
            },
          }}
        >
          {children}
        </CrossmintWalletProvider>
      </CrossmintAuthProvider>
    </CrossmintProvider>
  )
}