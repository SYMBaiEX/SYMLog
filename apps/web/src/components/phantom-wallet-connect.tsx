"use client"

import { useState, useEffect } from "react"
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useWallet } from '@solana/wallet-adapter-react'
import { GlassButton } from "@/components/ui/glass-button"
import { GlassCard } from "@/components/ui/glass-card"
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
import { 
  Wallet, 
  LogOut, 
  Check, 
  Loader2, 
  Shield, 
  AlertTriangle,
  Copy,
  CheckCircle2
} from "lucide-react"

export function PhantomWalletConnect() {
  const [showAccountDialog, setShowAccountDialog] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isVerified, setIsVerified] = useState(false)

  const { 
    publicKey, 
    connected, 
    connecting, 
    disconnecting,
    disconnect,
    signMessage
  } = useWallet()

  const address = publicKey?.toString()

  // Handle connection state changes
  useEffect(() => {
    if (connected && address) {
      toast.success("Wallet Connected!", {
        description: `Welcome ${formatAddress(address)}`
      })
    }
  }, [connected, address])

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const copyAddressToClipboard = async () => {
    if (address) {
      try {
        await navigator.clipboard.writeText(address)
        setCopiedAddress(true)
        toast.success("Address copied to clipboard")
        const timeoutId = setTimeout(() => setCopiedAddress(false), 2000)
        return () => clearTimeout(timeoutId)
      } catch (error) {
        toast.error("Failed to copy address")
      }
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
      setShowAccountDialog(false)
      setIsVerified(false)
      toast.info("Wallet disconnected successfully")
    } catch (error) {
      toast.error("Failed to disconnect wallet")
    }
  }

  const verifyWallet = async () => {
    if (!address || !signMessage) return

    setIsVerifying(true)
    try {
      // Create structured sign-in message (SIWS format)
      const signInMessage = {
        domain: process.env.NEXT_PUBLIC_APP_DOMAIN || 'localhost:3001',
        statement: 'Sign in to SYMLog AI Agent Platform',
        version: '1',
        chainId: 'solana:101',
        nonce: crypto.randomUUID(),
        issuedAt: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        resources: ['https://symlog.ai']
      }

      const messageString = Object.entries(signInMessage)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n')

      // Sign the message
      const messageBytes = new TextEncoder().encode(messageString)
      const signature = await signMessage(messageBytes)

      // Verify signature on server
      const response = await fetch('/api/auth/verify-signature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageString,
          signature: Array.from(signature),
          publicKey: address
        })
      })

      if (!response.ok) {
        throw new Error('Server verification failed')
      }

      const result = await response.json()

      if (result.isValid) {
        setIsVerified(true)
        toast.success("Wallet verified successfully!", {
          description: "You can now access all premium features"
        })
      } else {
        throw new Error(result.message || 'Signature verification failed')
      }

    } catch (error: any) {
      if (error?.code === 4001 || error?.message?.includes('rejected')) {
        toast.info("Verification cancelled", {
          description: "You can verify your wallet later from account settings"
        })
      } else {
        toast.error("Failed to verify wallet", {
          description: error?.message || "Please try again"
        })
      }
    } finally {
      setIsVerifying(false)
    }
  }

  // Connected state - show account button
  if (connected && address) {
    return (
      <>
        <GlassButton
          variant="ghost"
          size="sm"
          onClick={() => setShowAccountDialog(true)}
          className="flex items-center gap-2 w-full md:w-auto glass-hover"
        >
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs bg-primary/20 text-primary">
              {address.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {formatAddress(address)}
          {isVerified && (
            <Badge className="ml-2 bg-secondary/20 text-secondary border-secondary/30">
              <Check className="h-3 w-3 mr-1" />
              Verified
            </Badge>
          )}
        </GlassButton>

        <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
          <DialogContent className="glass border-white/10">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Wallet Account
              </DialogTitle>
              <DialogDescription className="text-white/70">
                Manage your SYMLog account connected via Phantom wallet
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <GlassCard className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border border-primary/30">
                      <AvatarFallback className="bg-primary/20 text-primary font-bold">
                        {address.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">{formatAddress(address)}</p>
                        <GlassButton
                          variant="ghost"
                          size="sm"
                          onClick={copyAddressToClipboard}
                          className="p-1 h-auto"
                        >
                          {copiedAddress ? (
                            <CheckCircle2 className="h-4 w-4 text-secondary" />
                          ) : (
                            <Copy className="h-4 w-4 text-white/50" />
                          )}
                        </GlassButton>
                      </div>
                      <p className="text-sm text-white/60">
                        Phantom Wallet
                      </p>
                    </div>
                  </div>
                  {isVerified && (
                    <Badge className="bg-secondary/20 text-secondary border-secondary/30 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Verified
                    </Badge>
                  )}
                </div>
              </GlassCard>

              {!isVerified && (
                <GlassCard variant="dark" className="p-4 border-orange-400/30 bg-orange-400/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-orange-400" />
                    <p className="text-sm font-medium text-white">Verify your wallet</p>
                  </div>
                  <p className="text-sm mb-3 text-white/70">
                    Sign a message to prove ownership and unlock premium features
                  </p>
                  <GlassButton 
                    onClick={verifyWallet} 
                    disabled={isVerifying}
                    className="w-full"
                    variant="default"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <Shield className="mr-2 h-4 w-4" />
                        Verify Wallet
                      </>
                    )}
                  </GlassButton>
                </GlassCard>
              )}

              <GlassCard className="p-4">
                <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-secondary" />
                  Account Features
                </h4>
                <ul className="space-y-2 text-sm text-white/70">
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-primary rounded-full" />
                    Personalized AI agent conversations
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-primary rounded-full" />
                    Secure data storage on Solana blockchain
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-primary rounded-full" />
                    Access to premium AI models
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-primary rounded-full" />
                    Cross-device synchronization
                  </li>
                </ul>
              </GlassCard>

              <div className="flex gap-3">
                <GlassButton
                  variant="ghost"
                  className="flex-1"
                  onClick={() => window.open('https://phantom.app/', '_blank')}
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  Open Phantom
                </GlassButton>
                <GlassButton
                  variant="outline"
                  className="flex-1 border-red-400/30 text-red-400 hover:bg-red-400/10"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    <>
                      <LogOut className="mr-2 h-4 w-4" />
                      Disconnect
                    </>
                  )}
                </GlassButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // Not connected - show connect button
  return (
    <div className="hidden">
      {/* The WalletMultiButton handles connection UI */}
      <WalletMultiButton 
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '0.5rem',
          color: 'white',
          fontFamily: 'inherit',
          fontSize: '0.875rem',
          padding: '0.5rem 1rem',
        }}
      />
    </div>
  )
}