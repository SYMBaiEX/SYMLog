"use client"

import { useState, useEffect, useCallback } from "react"
import { useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
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
  Zap,
  ExternalLink,
  Key,
  Monitor
} from "lucide-react"
import { getPKCEVerifier, clearPKCEVerifier } from "@/lib/auth/pkce"



interface AuthUser {
  id: string
  email: string
  walletAddress: string
}

export function WebAuthFlow() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [showAccountDialog, setShowAccountDialog] = useState(false)
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [authCode, setAuthCode] = useState("")
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [isValidatingCode, setIsValidatingCode] = useState(false)
  const [authPopupWindow, setAuthPopupWindow] = useState<Window | null>(null)

  // Convex mutations
  const validateAuthCode = useMutation(api.auth.validateAuthCode)

  // Define handleAuthCode before using it in effects
  const handleAuthCode = useCallback(async (code: string) => {
    if (!code || code.trim() === "") {
      toast.error("Please enter a valid authentication code")
      return
    }

    // Get PKCE verifier from session storage
    const codeVerifier = sessionStorage.getItem(`pkce_verifier_${code.trim()}`)
    if (!codeVerifier) {
      toast.error("Security verification data not found. Please try signing in again.")
      return
    }

    setIsValidatingCode(true)
    try {
      const result = await validateAuthCode({ 
        authCode: code.trim()
      })
      
      const newUser: AuthUser = {
        id: result.userId,
        email: result.userEmail,
        walletAddress: result.walletAddress,
      }
      
      localStorage.setItem('symlog_auth_user', JSON.stringify(newUser))
      setUser(newUser)
      setShowAuthDialog(false)
      setAuthCode("")
      
      // Clear PKCE verifier from session storage
      clearPKCEVerifier()
      sessionStorage.removeItem(`pkce_verifier_${code.trim()}`)
      
      toast.success("Authentication successful!", {
        description: `Welcome back, ${newUser.email}`
      })
    } catch (error: any) {
      // Auth code validation failed
      
      // Handle Convex connection errors gracefully
      if (error?.message?.includes('ConvexError') || error?.message?.includes('Connection failed')) {
        toast.error("Connection Error", {
          description: "Unable to validate code. Please check your connection and try again."
        })
      } else {
        toast.error("Authentication failed", {
          description: error?.message || "Invalid or expired code"
        })
      }
    } finally {
      setIsValidatingCode(false)
    }
  }, [validateAuthCode, setUser, setShowAuthDialog])

  // Check for existing session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('symlog_auth_user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (error) {
        console.error('Failed to parse saved user:', error)
        localStorage.removeItem('symlog_auth_user')
      }
    }
  }, [])

  // Listen for deep link auth codes from Tauri
  useEffect(() => {
    let unlisten: (() => void) | undefined

    const setupDeepLinkListener = async () => {
      try {
        // Check if we're in Tauri environment
        if (typeof window !== 'undefined' && window.__TAURI__) {
          const { listen } = await import('@tauri-apps/api/event')
          
          unlisten = await listen<{ authCode: string; codeVerifier?: string }>('auth-code-received', (event) => {
            // Auth code received from deep link
            const { authCode, codeVerifier } = event.payload
            
            // Store PKCE verifier if provided
            if (codeVerifier) {
              sessionStorage.setItem(`pkce_verifier_${authCode}`, codeVerifier)
            }
            
            handleAuthCode(authCode)
          })
        }
      } catch (error) {
        console.error('Failed to setup deep link listener:', error)
      }
    }

    setupDeepLinkListener()

    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  }, [handleAuthCode])

  // Listen for auth codes from popup window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security check: only accept messages from our auth domains
      const authWebUrl = process.env.NEXT_PUBLIC_AUTH_WEB_URL || 'https://auth-web-two.vercel.app'
      const allowedOrigins = [
        'http://localhost:3003', // Development fallback
        'https://auth-web-two.vercel.app', // Production auth web
        'https://symlog-api.vercel.app', // Alternative deployment URL
        'https://symlog-web.vercel.app', // Expected deployment URL
        authWebUrl // Environment configured URL
      ].filter((url, index, arr) => arr.indexOf(url) === index) // Remove duplicates
      
      if (!allowedOrigins.includes(event.origin)) {
        return
      }

      if (event.data.type === 'SYMLOG_AUTH_CODE') {
        const { authCode: receivedCode, codeVerifier } = event.data
        if (receivedCode && receivedCode.startsWith('SYM_')) {
          // Auth code and PKCE verifier received from popup
          setAuthCode(receivedCode)
          
          // Store PKCE verifier in session storage
          if (codeVerifier) {
            sessionStorage.setItem(`pkce_verifier_${receivedCode}`, codeVerifier)
          }
          
          // Auto-validate the code with PKCE
          handleAuthCode(receivedCode)
          
          // Close the popup if it's still open
          if (authPopupWindow && !authPopupWindow.closed) {
            authPopupWindow.close()
            setAuthPopupWindow(null)
          }
        }
      }
    }

    // Add event listener for messages from popup
    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [authPopupWindow, handleAuthCode])

  // Listen for auth codes from URL hash (callback redirects)
  useEffect(() => {
    const handleCustomEvent = (event: CustomEvent) => {
      const { authCode: receivedCode, codeVerifier } = event.detail
      if (receivedCode && receivedCode.startsWith('SYM_')) {
        // Auth code received from URL callback
        setAuthCode(receivedCode)
        
        // Store PKCE verifier if provided
        if (codeVerifier) {
          sessionStorage.setItem(`pkce_verifier_${receivedCode}`, codeVerifier)
        }
        
        setShowAuthDialog(true)
        
        // Auto-validate the code with PKCE
        handleAuthCode(receivedCode)
      }
    }

    // Add event listener for custom auth code events
    window.addEventListener('symlog-auth-code', handleCustomEvent as EventListener)

    return () => {
      window.removeEventListener('symlog-auth-code', handleCustomEvent as EventListener)
    }
  }, [handleAuthCode])

  const handleManualCodeSubmit = () => {
    handleAuthCode(authCode)
  }

  const openAuthPopup = () => {
    const authUrl = process.env.NEXT_PUBLIC_AUTH_WEB_URL || 'https://auth-web-two.vercel.app' // SYMLog Auth Portal
    
    setIsLoading(true)
    
    // Open the auth website in external browser
    try {
      if (typeof window !== 'undefined' && window.__TAURI__) {
        // In Tauri, use shell plugin through IPC
        window.__TAURI__.invoke('plugin:shell|open', { path: authUrl }).then(() => {
          setShowAuthDialog(true)
          setIsLoading(false)
        }).catch(() => {
          // Fallback to window.open if Tauri API is not available
          window.open(authUrl, '_blank')
          setShowAuthDialog(true)
          setIsLoading(false)
        })
      } else {
        // In web browser, open popup and store reference
        const popup = window.open(authUrl, 'symlog-auth', 'width=500,height=700,scrollbars=yes,resizable=yes')
        setAuthPopupWindow(popup)
        setShowAuthDialog(true)
        setIsLoading(false)
        
        // Monitor popup for closure
        if (popup) {
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              setAuthPopupWindow(null)
              clearInterval(checkClosed)
            }
          }, 1000)
        }
      }
    } catch (error) {
      console.error("Failed to open auth popup:", error)
      toast.error("Failed to open authentication page")
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      localStorage.removeItem('symlog_auth_user')
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
    const displayName = user?.email || "User"
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
          {user.walletAddress ? formatAddress(user.walletAddress) : user.email}
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
                      <p className="font-medium text-white">{user.email}</p>
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

  // Not logged in - show login button and auth dialog
  return (
    <>
      <GlassButton
        variant="default"
        size="sm"
        onClick={openAuthPopup}
        disabled={isLoading}
        className="flex w-full md:w-auto items-center gap-2 glow-primary"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Opening...
          </>
        ) : (
          <>
            <User className="mr-2 h-4 w-4" />
            Sign In
          </>
        )}
      </GlassButton>

      {/* Authentication Code Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="glass border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Enter Authentication Code
            </DialogTitle>
            <DialogDescription className="text-white/70">
              Complete authentication in your browser, then enter the code here
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="glass rounded-lg p-4 bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <Monitor className="h-5 w-5 text-blue-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-400">
                    Authentication Page Opened
                  </p>
                  <p className="text-xs text-white/70">
                    Sign in with your Crossmint account in the browser window that just opened.
                    Once complete, the code will appear automatically or you can paste it below.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="authCode" className="text-sm font-medium text-white">
                Authentication Code
              </label>
              <input
                id="authCode"
                type="text"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value.toUpperCase())}
                placeholder="SYM_XXXXXXXXXXXXXXXX"
                className="w-full px-3 py-2 bg-background/50 border border-border rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                onKeyDown={(e) => e.key === 'Enter' && handleManualCodeSubmit()}
              />
            </div>
            
            <div className="flex gap-3">
              <GlassButton
                variant="ghost"
                onClick={() => setShowAuthDialog(false)}
                className="flex-1"
              >
                Cancel
              </GlassButton>
              <GlassButton
                onClick={handleManualCodeSubmit}
                disabled={isValidatingCode || !authCode.trim()}
                className="flex-1 glow-primary"
              >
                {isValidatingCode ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </GlassButton>
            </div>
            
            <p className="text-xs text-white/50 text-center">
              The authentication code expires in 10 minutes for security.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}