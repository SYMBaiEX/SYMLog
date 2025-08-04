"use client"

import { useState, useEffect } from "react"
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
  Zap
} from "lucide-react"

// Simple local storage-based auth for desktop fallback
interface LocalUser {
  id: string
  email?: string
  displayName: string
  walletAddress?: string
  createdAt: string
}

export function DesktopAuthFallback() {
  const [user, setUser] = useState<LocalUser | null>(null)
  const [showAccountDialog, setShowAccountDialog] = useState(false)
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)

  // Check for existing session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('symlog_user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (error) {
        console.error('Failed to parse saved user:', error)
        localStorage.removeItem('symlog_user')
      }
    }
  }, [])

  const generateWalletAddress = () => {
    // Generate a mock EVM address for demonstration
    const chars = '0123456789abcdef'
    let address = '0x'
    for (let i = 0; i < 40; i++) {
      address += chars[Math.floor(Math.random() * chars.length)]
    }
    return address
  }

  const handleLogin = async () => {
    if (!email || !email.includes('@')) {
      toast.error("Please enter a valid email address")
      return
    }

    setIsLoading(true)
    try {
      // Simulate authentication delay
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const newUser: LocalUser = {
        id: Math.random().toString(36).substr(2, 9),
        email,
        displayName: email.split('@')[0],
        walletAddress: generateWalletAddress(),
        createdAt: new Date().toISOString()
      }
      
      localStorage.setItem('symlog_user', JSON.stringify(newUser))
      setUser(newUser)
      setShowLoginDialog(false)
      setEmail("")
      
      toast.success("Welcome to SYMLog!", {
        description: `Signed in as ${newUser.email}`
      })
    } catch (error) {
      toast.error("Login failed", {
        description: "Please try again"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      localStorage.removeItem('symlog_user')
      setUser(null)
      setShowAccountDialog(false)
      toast.info("Signed out successfully")
    } catch (error) {
      toast.error("Logout failed")
    } finally {
      setIsLoggingOut(false)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const copyAddressToClipboard = async () => {
    if (user?.walletAddress) {
      try {
        await navigator.clipboard.writeText(user.walletAddress)
        setCopiedAddress(true)
        toast.success("Address copied to clipboard")
        setTimeout(() => setCopiedAddress(false), 2000)
      } catch (error) {
        toast.error("Failed to copy address")
      }
    }
  }

  const getUserInitials = () => {
    const displayName = user?.displayName || user?.email || "User"
    return displayName.slice(0, 2).toUpperCase()
  }

  // Logged in state - show account button  
  if (user) {
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
          {user.walletAddress ? formatAddress(user.walletAddress) : user.displayName}
          <Badge className="ml-2 bg-secondary/20 text-secondary border-secondary/30">
            <Zap className="h-3 w-3 mr-1" />
            Local Wallet
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
                Manage your SYMLog account with local wallet
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
                      <p className="font-medium text-white">{user.displayName}</p>
                      <p className="text-sm text-white/60 flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-secondary/20 text-secondary border-secondary/30 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Local
                  </Badge>
                </div>
              </GlassCard>

              {/* Wallet Card */}
              {user.walletAddress && (
                <GlassCard className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/20">
                        <Wallet className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white">{formatAddress(user.walletAddress)}</p>
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
                          <Shield className="h-3 w-3" />
                          Local Demo Wallet
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
                  Desktop App Features
                </h4>
                <ul className="space-y-2 text-sm text-white/70">
                  <li className="flex items-center gap-2">
                    <Shield className="w-3 h-3 text-secondary" />
                    Local storage - no external dependencies
                  </li>
                  <li className="flex items-center gap-2">
                    <Zap className="w-3 h-3 text-secondary" />
                    Fast and secure desktop experience
                  </li>
                  <li className="flex items-center gap-2">
                    <User className="w-3 h-3 text-secondary" />
                    Simplified authentication for local use
                  </li>
                </ul>
              </GlassCard>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <GlassButton
                  variant="ghost"
                  className="flex-1"
                  onClick={() => toast.info("This is a local demo wallet")}
                >
                  <Globe className="mr-2 h-4 w-4" />
                  About Local Wallet
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

  // Not logged in - show login button and dialog
  return (
    <>
      <GlassButton
        variant="default"
        size="sm"
        onClick={() => setShowLoginDialog(true)}
        className="flex w-full md:w-auto items-center gap-2 glow-primary"
      >
        <User className="mr-2 h-4 w-4" />
        Sign In
      </GlassButton>

      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="glass border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Sign In to SYMLog
            </DialogTitle>
            <DialogDescription className="text-white/70">
              Enter your email to access your local desktop account
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-white">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-3 py-2 bg-background/50 border border-border rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            
            <GlassButton
              onClick={handleLogin}
              disabled={isLoading || !email}
              className="w-full glow-primary"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <User className="mr-2 h-4 w-4" />
                  Sign In
                </>
              )}
            </GlassButton>
            
            <p className="text-xs text-white/50 text-center">
              This is a local desktop demo. Your data stays on your device.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}