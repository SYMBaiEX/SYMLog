"use client"

import { useEffect, useState } from "react"
import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { toast } from "sonner"
import { Wallet, LogOut, Check, Loader2, Shield } from "lucide-react"
import { WalletErrorBoundary } from "@/components/wallet-error-boundary"

// Type definitions are now in @/types/phantom.d.ts

function SolanaWalletButtonBase() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [showAccountDialog, setShowAccountDialog] = useState(false)

  useEffect(() => {
    checkWalletConnection()
  }, [])

  const checkWalletConnection = async () => {
    if (window.solana && window.solana.isPhantom) {
      try {
        const response = await window.solana.connect({ onlyIfTrusted: true })
        setWalletAddress(response.publicKey.toString())
      } catch (error) {
        // Wallet is not connected
      }
    }
  }

  const connectWallet = async () => {
    if (!window.solana) {
      toast.error("Phantom wallet not found!", {
        description: "Please install Phantom wallet extension",
        action: {
          label: "Install",
          onClick: () => window.open("https://phantom.app/", "_blank")
        }
      })
      return
    }

    setIsConnecting(true)
    try {
      const response = await window.solana.connect()
      const address = response.publicKey.toString()
      setWalletAddress(address)
      
      toast.success("Wallet connected!", {
        description: `Address: ${formatAddress(address)}`
      })

      // Auto-verify after connection
      await verifyWallet(address)
    } catch (error) {
      console.error("Connection failed:", error)
      toast.error("Failed to connect wallet")
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = async () => {
    if (window.solana) {
      await window.solana.disconnect()
      setWalletAddress(null)
      setIsVerified(false)
      setShowAccountDialog(false)
      toast.info("Wallet disconnected")
    }
  }

  const verifyWallet = async (address?: string) => {
    const walletAddr = address || walletAddress
    if (!walletAddr || !window.solana) return

    setIsVerifying(true)
    try {
      // Create message to sign
      const message = new TextEncoder().encode(
        `Sign this message to verify your wallet ownership for SYMLog.\n\nWallet: ${walletAddr}\nTimestamp: ${new Date().toISOString()}\nNonce: ${Math.random().toString(36).substring(2)}`
      )

      // Request signature
      const { signature } = await window.solana.signMessage(message, "utf8")
      
      // Send to backend for verification
      const verifyResponse = await fetch('/api/wallet/verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          // Add auth token if available
          ...(typeof window !== 'undefined' && window.localStorage.getItem('sessionToken') 
            ? { 'Authorization': `Bearer ${window.localStorage.getItem('sessionToken')}` }
            : {})
        },
        body: JSON.stringify({
          walletAddress: walletAddr,
          message: Buffer.from(message).toString('base64'),
          signature: Buffer.from(signature).toString('base64')
        })
      })

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json()
        throw new Error(error.error || 'Server verification failed')
      }

      const result = await verifyResponse.json()
      setIsVerified(true)
      
      toast.success("Wallet verified successfully!", {
        description: "You can now access all features"
      })
    } catch (error) {
      console.error("Verification failed:", error)
      toast.error("Failed to verify wallet")
    } finally {
      setIsVerifying(false)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  if (walletAddress) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAccountDialog(true)}
          className="flex items-center gap-2 w-full md:w-auto"
          aria-label={`Wallet account menu for ${formatAddress(walletAddress)}`}
          aria-expanded={showAccountDialog}
          aria-haspopup="dialog"
        >
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs">
              {walletAddress.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {formatAddress(walletAddress)}
          {isVerified && <Badge variant="secondary" className="ml-2">Verified</Badge>}
        </Button>

        <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Wallet Account</DialogTitle>
              <DialogDescription>
                Manage your SYMLog account connected via Solana wallet
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {walletAddress.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{formatAddress(walletAddress)}</p>
                    <p className="text-sm text-muted-foreground">
                      Phantom Wallet
                    </p>
                  </div>
                </div>
                {isVerified && (
                  <Badge variant="default" className="flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Verified
                  </Badge>
                )}
              </div>

              {!isVerified && (
                <div className="p-4 rounded-lg border border-warning bg-warning/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-warning" />
                    <p className="text-sm font-medium">Verify your wallet</p>
                  </div>
                  <p className="text-sm mb-3 text-muted-foreground">
                    Sign a message to prove ownership and unlock all features
                  </p>
                  <Button 
                    onClick={() => verifyWallet()} 
                    disabled={isVerifying}
                    className="w-full"
                    aria-label="Verify wallet ownership"
                    aria-busy={isVerifying}
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify Wallet"
                    )}
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Account Features</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Personalized AI conversations</li>
                  <li>• Secure data storage on blockchain</li>
                  <li>• Access to premium features</li>
                  <li>• Cross-device synchronization</li>
                </ul>
              </div>

              <Button
                variant="destructive"
                className="w-full"
                onClick={disconnectWallet}
                aria-label="Disconnect wallet"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Disconnect Wallet
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <Button
      variant="default"
      size="sm"
      onClick={connectWallet}
      disabled={isConnecting}
      className="flex w-full md:w-auto"
      aria-label="Connect Solana wallet"
      aria-busy={isConnecting}
    >
      {isConnecting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <Wallet className="mr-2 h-4 w-4" />
          Connect Wallet
        </>
      )}
    </Button>
  )
}

// Export wrapped component
export function SolanaWalletButton() {
  return (
    <WalletErrorBoundary>
      <SolanaWalletButtonBase />
    </WalletErrorBoundary>
  )
}