"use client"

import { useState, useEffect } from "react"
import { useAuth, useWallet } from "@crossmint/client-sdk-react-ui"
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
  Copy,
  CheckCircle2,
  User,
  Mail,
  Globe,
  Twitter,
  Zap
} from "lucide-react"
import { CrossmintErrorBoundary } from "@/components/wallet-error-boundary"

function CrossmintWalletAuthBase() {
  const [showAccountDialog, setShowAccountDialog] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Check if Crossmint is available
  const clientApiKey = process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_KEY as string
  const isCrossmintEnabled = clientApiKey && clientApiKey !== 'your_client_api_key_here'

  // Only use Crossmint hooks if enabled
  const auth = useAuth()
  const walletHooks = useWallet()
  
  const login = isCrossmintEnabled ? auth.login : undefined
  const logout = isCrossmintEnabled ? auth.logout : undefined
  const jwt = isCrossmintEnabled ? auth.jwt : undefined
  const user = isCrossmintEnabled ? auth.user : undefined
  const wallet = isCrossmintEnabled ? walletHooks.wallet : undefined
  const walletStatus = isCrossmintEnabled ? walletHooks.status : undefined

  const isLoggedIn = !!jwt && !!user
  const isWalletReady = walletStatus === 'loaded' && wallet
  const walletAddress = wallet?.address

  // Handle connection state changes
  useEffect(() => {
    if (isLoggedIn && user) {
      toast.success("Welcome to SYMLog!", {
        description: `Signed in as ${user.email || user.id}`
      })
    }
  }, [isLoggedIn, user])

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const copyAddressToClipboard = async () => {
    if (walletAddress) {
      try {
        await navigator.clipboard.writeText(walletAddress)
        setCopiedAddress(true)
        toast.success("Address copied to clipboard")
        const timeoutId = setTimeout(() => setCopiedAddress(false), 2000)
        return () => clearTimeout(timeoutId)
      } catch (error) {
        toast.error("Failed to copy address")
      }
    }
  }

  const handleLogin = async () => {
    try {
      await login()
    } catch (error: any) {
      console.error("Login error:", error)
      toast.error("Login failed", {
        description: error?.message || "Please try again"
      })
    }
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
      setShowAccountDialog(false)
      toast.info("Signed out successfully")
    } catch (error: any) {
      toast.error("Logout failed", {
        description: error?.message || "Please try again"
      })
    } finally {
      setIsLoggingOut(false)
    }
  }

  const getUserDisplayName = () => {
    if (user?.email) return user.email
    return user?.id?.slice(0, 8) || "User"
  }

  const getUserInitials = () => {
    const displayName = getUserDisplayName()
    return displayName.slice(0, 2).toUpperCase()
  }

  // Logged in state - show account button  
  if (isLoggedIn) {
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
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
          {isWalletReady && walletAddress ? formatAddress(walletAddress) : getUserDisplayName()}
          <Badge className="ml-2 bg-secondary/20 text-secondary border-secondary/30">
            <Zap className="h-3 w-3 mr-1" />
            Smart Wallet
          </Badge>
        </GlassButton>

        <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
          <DialogContent className="glass border-white/10">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Your Account
              </DialogTitle>
              <DialogDescription className="text-white/70">
                Manage your SYMLog account with Crossmint smart wallet
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* User Profile Card */}
              <GlassCard className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border border-primary/30">
                      <AvatarFallback className="bg-primary/20 text-primary font-bold">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-white">{getUserDisplayName()}</p>
                      <p className="text-sm text-white/60 flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Crossmint Account
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-secondary/20 text-secondary border-secondary/30 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Verified
                  </Badge>
                </div>
              </GlassCard>

              {/* Wallet Card */}
              {isWalletReady && walletAddress && (
                <GlassCard className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/20">
                        <Wallet className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white">{formatAddress(walletAddress)}</p>
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
                        <p className="text-sm text-white/60 flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          Solana Smart Wallet
                        </p>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              )}

              {/* Features Card */}
              <GlassCard className="p-4">
                <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-secondary" />
                  Smart Wallet Features
                </h4>
                <ul className="space-y-2 text-sm text-white/70">
                  <li className="flex items-center gap-2">
                    <Zap className="w-3 h-3 text-secondary" />
                    Gasless transactions - no fees required
                  </li>
                  <li className="flex items-center gap-2">
                    <Shield className="w-3 h-3 text-secondary" />
                    Programmable security via smart contracts
                  </li>
                  <li className="flex items-center gap-2">
                    <Globe className="w-3 h-3 text-secondary" />
                    Cross-device synchronization
                  </li>
                  <li className="flex items-center gap-2">
                    <User className="w-3 h-3 text-secondary" />
                    Social login - no seed phrases to lose
                  </li>
                </ul>
              </GlassCard>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <GlassButton
                  variant="ghost"
                  className="flex-1"
                  onClick={() => window.open('https://www.crossmint.com/', '_blank')}
                >
                  <Globe className="mr-2 h-4 w-4" />
                  About Crossmint
                </GlassButton>
                <GlassButton
                  variant="outline"
                  className="flex-1 border-red-400/30 text-red-400 hover:bg-red-400/10"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing out...
                    </>
                  ) : (
                    <>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
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

  // Not logged in - show login button
  if (!isCrossmintEnabled) {
    return (
      <GlassButton
        variant="ghost"
        size="sm"
        onClick={() => window.location.href = '/login'}
        className="flex w-full md:w-auto items-center gap-2"
      >
        <User className="mr-2 h-4 w-4" />
        Sign In
      </GlassButton>
    )
  }

  return (
    <GlassButton
      variant="default"
      size="sm"
      onClick={handleLogin}
      className="flex w-full md:w-auto items-center gap-2 glow-primary"
    >
      <User className="mr-2 h-4 w-4" />
      Sign In
    </GlassButton>
  )
}

// Export wrapped component
export function CrossmintWalletAuth() {
  return (
    <CrossmintErrorBoundary>
      <CrossmintWalletAuthBase />
    </CrossmintErrorBoundary>
  )
}