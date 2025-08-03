"use client"

import { useState } from "react"
import { SolanaWalletButton } from "@/components/solana-wallet-button"
// import { PhantomEmbeddedWallet } from "@/components/phantom-embedded-wallet"
import { Button } from "@/components/ui/button"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Settings } from "lucide-react"

export function WalletConnectionButton() {
  // For now, default to standard mode since embedded has type issues
  const [walletMode, setWalletMode] = useState<"standard" | "embedded">("standard")
  
  return (
    <div className="flex items-center gap-2">
      {walletMode === "standard" ? (
        <SolanaWalletButton />
      ) : (
        // Uncomment when Phantom SDK types are fixed
        // <PhantomEmbeddedWallet />
        <SolanaWalletButton />
      )}
      
      {/* Wallet mode selector - can be removed if not needed */}
      {false && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setWalletMode("standard")}>
              Standard Wallet
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setWalletMode("embedded")}>
              Embedded Wallet
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}