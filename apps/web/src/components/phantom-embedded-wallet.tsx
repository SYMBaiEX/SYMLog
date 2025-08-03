"use client"

import { useEffect, useState, useRef } from "react"
import { createPhantom, Position } from "@phantom/wallet-sdk"
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

export function PhantomEmbeddedWallet() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [showAccountDialog, setShowAccountDialog] = useState(false)
  const [phantomReady, setPhantomReady] = useState(false)
  const phantomRef = useRef<any>(null)

  useEffect(() => {
    let mounted = true

    const initializePhantom = async () => {
      try {
        // Create embedded Phantom instance following the documentation
        const phantom = await createPhantom({
          position: Position.bottomRight,
          hideLauncherBeforeOnboarded: false,
          namespace: "symlog-app"
        })

        if (!mounted) return

        phantomRef.current = phantom
        setPhantomReady(true)

        // Show the wallet UI
        phantom.show()

      } catch (error) {
        console.error("Failed to initialize Phantom:", error)
      }
    }

    initializePhantom()

    return () => {
      mounted = false
    }
  }, [])

  const connectWallet = async () => {
    if (!phantomRef.current || !phantomReady) {
      toast.error("Wallet not ready", {
        description: "Please wait for wallet to initialize"
      })
      return
    }

    setIsConnecting(true)
    try {
      // Connect to wallet following the documentation pattern
      const solanaPublicKey = await phantomRef.current.solana.connect()
      const address = solanaPublicKey.toString()
      
      setWalletAddress(address)
      
      toast.success("Wallet connected!", {
        description: `Address: ${formatAddress(address)}`
      })

      // Auto-verify after connection
      await verifyWallet(address)
    } catch (error: any) {
      console.error("Connection failed:", error)
      
      // Handle user rejection gracefully
      if (error?.code === 4001 || error?.message?.includes('User rejected')) {
        // User rejected - just close silently
        toast.info("Connection cancelled", {
          description: "You can connect your wallet anytime"
        })
      } else {
        // Actual error
        toast.error("Failed to connect wallet", {
          description: error?.message || "Please try again"
        })
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = async () => {
    if (phantomRef.current?.solana) {
      try {
        await phantomRef.current.solana.disconnect()
        setWalletAddress(null)
        setIsVerified(false)
        setShowAccountDialog(false)
        toast.info("Wallet disconnected")
      } catch (error) {
        console.error("Disconnect failed:", error)
      }
    }
  }

  const verifyWallet = async (address?: string) => {
    const walletAddr = address || walletAddress
    if (!walletAddr || !phantomRef.current?.solana) return

    setIsVerifying(true)
    try {
      // Create message to sign
      const message = new TextEncoder().encode(`Sign this message to verify your wallet ownership for SYMLog.\n\nWallet: ${walletAddr}\nTimestamp: ${new Date().toISOString()}\nNonce: ${Math.random().toString(36).substring(2)}`)

      // Request signature using embedded wallet
      const signature = await phantomRef.current.solana.signMessage(message, "utf8")
      
      console.log("Signature:", signature)
      setIsVerified(true)
      
      toast.success("Wallet verified successfully!", {
        description: "You can now access all features"
      })

      // In production, send signature to backend for verification
    } catch (error: any) {
      console.error("Verification failed:", error)
      
      // Handle user rejection gracefully
      if (error?.code === 4001 || error?.message?.includes('User rejected')) {
        // User rejected - show gentle message
        toast.info("Verification cancelled", {
          description: "You can verify your wallet later from account settings"
        })
      } else {
        // Actual error
        toast.error("Failed to verify wallet", {
          description: error?.message || "Please try again"
        })
      }
    } finally {
      setIsVerifying(false)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const showPhantomUI = () => {
    if (phantomRef.current) {
      phantomRef.current.show()
    }
  }

  if (walletAddress) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAccountDialog(true)}
          className="flex items-center gap-2 w-full md:w-auto"
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
                Manage your SYMLog account connected via embedded Phantom wallet
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
                      Phantom Embedded Wallet
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

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={showPhantomUI}
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  Open Wallet
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={disconnectWallet}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Disconnect
                </Button>
              </div>
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
      disabled={isConnecting || !phantomReady}
      className="flex w-full md:w-auto"
    >
      {isConnecting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : !phantomReady ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading...
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