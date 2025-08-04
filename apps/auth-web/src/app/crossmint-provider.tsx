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
        appearance={{
          embedded: true,
          colors: {
            primary: "#9999FF",
            accent: "#90EE90",
          }
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
    </CrossmintClientProvider>
  )
}