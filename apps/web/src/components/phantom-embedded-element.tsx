"use client"

import { useEffect, useState, useRef } from "react"
import { createPhantom } from "@phantom/wallet-sdk"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { toast } from "sonner"
import { Wallet, Check, Loader2, Shield, X } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export function PhantomEmbeddedElement() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [phantomReady, setPhantomReady] = useState(false)
  const phantomRef = useRef<any>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  useEffect(() => {
    // Only initialize when sheet is opened
    if (isSheetOpen && !phantomRef.current) {
      initializePhantom()
    }
  }, [isSheetOpen])

  const initializePhantom = async () => {
    try {
      setIsInitializing(true)
      
      // Wait a bit for the DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Check if container exists
      const container = document.getElementById("phantom-wallet-container")
      if (!container) {
        console.error("Phantom wallet container not found")
        return
      }
      
      // Create embedded Phantom instance in element mode
      const phantom = await createPhantom({
        element: "phantom-wallet-container",
        namespace: "symlog-app-element",
      })

      phantomRef.current = phantom
      setPhantomReady(true)

      // Check if already connected
      if (phantom.solana) {
        try {
          const account = await phantom.solana.getAccount()
          if (account) {
            setWalletAddress(account)
          }
        } catch (error) {
          // Not connected yet
          console.log("Wallet not connected yet")
        }
      }

      // Show the wallet UI
      phantom.show()
    } catch (error) {
      console.error("Failed to initialize Phantom:", error)
      toast.error("Failed to initialize wallet", {
        description: "Please check your browser settings or try again later"
      })
    } finally {
      setIsInitializing(false)
    }
  }

  const connectWallet = async () => {
    if (!phantomRef.current || !phantomReady) {
      toast.error("Wallet not ready", {
        description: "Please wait for wallet to initialize"
      })
      return
    }

    setIsConnecting(true)
    try {
      // Connect to wallet
      const publicKey = await phantomRef.current.solana.connect()
      const address = publicKey.toString()
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
    if (phantomRef.current && phantomRef.current.solana) {
      try {
        await phantomRef.current.solana.disconnect()
        setWalletAddress(null)
        setIsVerified(false)
        toast.info("Wallet disconnected")
        setIsSheetOpen(false)
      } catch (error) {
        console.error("Disconnect failed:", error)
      }
    }
  }

  const verifyWallet = async (address?: string) => {
    const walletAddr = address || walletAddress
    if (!walletAddr || !phantomRef.current || !phantomRef.current.solana) return

    setIsVerifying(true)
    try {
      // Create message to sign
      const message = `Sign this message to verify your wallet ownership for SYMLog.\n\nWallet: ${walletAddr}\nTimestamp: ${new Date().toISOString()}\nNonce: ${Math.random().toString(36).substring(2)}`

      // Request signature using embedded wallet
      const encodedMessage = new TextEncoder().encode(message)
      const { signature } = await phantomRef.current.solana.signMessage(encodedMessage, "utf8")
      
      console.log("Signature:", signature)
      setIsVerified(true)
      
      toast.success("Wallet verified successfully!", {
        description: "You can now access all features"
      })

      // In production, send signature to backend for verification
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
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
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
        </SheetTrigger>
        <SheetContent side="right" className="w-[400px] sm:w-[540px] p-0">
          <SheetHeader className="p-6 pb-0">
            <SheetTitle>Phantom Wallet</SheetTitle>
            <SheetDescription>
              Manage your wallet and account settings
            </SheetDescription>
          </SheetHeader>
          
          <div className="p-6 space-y-4">
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
                    Connected
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

            <div 
              id="phantom-wallet-container" 
              className="w-full h-[400px] rounded-lg overflow-hidden border bg-background"
            >
              {isInitializing && (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>

            <Button
              variant="destructive"
              className="w-full"
              onClick={disconnectWallet}
            >
              Disconnect Wallet
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
      <SheetTrigger asChild>
        <Button
          variant="default"
          size="sm"
          className="flex w-full md:w-auto"
        >
          <Wallet className="mr-2 h-4 w-4" />
          Connect Wallet
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] p-0">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle>Connect Phantom Wallet</SheetTitle>
          <SheetDescription>
            Connect your wallet to access all features
          </SheetDescription>
        </SheetHeader>
        
        <div className="p-6">
          <div 
            id="phantom-wallet-container" 
            className="w-full h-[500px] rounded-lg overflow-hidden border bg-background"
          >
            {isInitializing && (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}