'use client';

import { useMutation } from 'convex/react';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Key,
  Loader2,
  LogOut,
  Mail,
  Monitor,
  Shield,
  User,
  Wallet,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';
import { logError } from '@/lib/logger';
import { api } from '../../convex/_generated/api';

interface AuthUser {
  id: string;
  email: string;
  walletAddress: string;
}

export function WebAuthFlow() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const isMountedRef = useRef(true);
  const popupCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [authPopupWindow, setAuthPopupWindow] = useState<Window | null>(null);

  // Convex mutations
  const validateAuthCode = useMutation(api.auth.validateAuthCode);

  // Check for existing session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('symlog_auth_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        logError('WebAuthFlow.loadSavedUser', error);
        localStorage.removeItem('symlog_auth_user');
      }
    }
  }, []);

  // Listen for deep link auth codes from Tauri
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupDeepLinkListener = async () => {
      try {
        // Check if we're in Tauri environment
        if (typeof window !== 'undefined' && window.__TAURI__) {
          const { listen } = await import('@tauri-apps/api/event');

          unlisten = await listen<string>('auth-code-received', (event) => {
            console.log('Received auth code from deep link:', event.payload);
            handleAuthCode(event.payload);
          });
        }
      } catch (error) {
        logError('WebAuthFlow.setupDeepLinkListener', error);
      }
    };

    setupDeepLinkListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // Listen for auth codes from popup window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security check: only accept messages from our auth domains
      const authWebUrl =
        process.env.NEXT_PUBLIC_AUTH_WEB_URL ||
        'https://auth-web-two.vercel.app';
      const allowedOrigins = [
        'http://localhost:3003', // Development fallback
        'https://auth-web-two.vercel.app', // Production auth web
        authWebUrl, // Environment configured URL
      ].filter((url, index, arr) => arr.indexOf(url) === index); // Remove duplicates

      if (!allowedOrigins.includes(event.origin)) {
        return;
      }

      if (event.data.type === 'SYMLOG_AUTH_CODE') {
        const { authCode: receivedCode } = event.data;
        if (receivedCode && receivedCode.startsWith('SYM_')) {
          console.log('Received auth code from popup:', receivedCode);
          setAuthCode(receivedCode);

          // Auto-validate the code
          handleAuthCode(receivedCode);

          // Close the popup if it's still open
          if (authPopupWindow && !authPopupWindow.closed) {
            authPopupWindow.close();
            setAuthPopupWindow(null);
          }
        }
      }
    };

    // Add event listener for messages from popup
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [authPopupWindow]);

  // Listen for auth codes from URL hash (callback redirects)
  useEffect(() => {
    const handleCustomEvent = (event: CustomEvent) => {
      const { authCode: receivedCode } = event.detail;
      if (receivedCode && receivedCode.startsWith('SYM_')) {
        console.log('Received auth code from URL callback:', receivedCode);
        setAuthCode(receivedCode);
        setShowAuthDialog(true);

        // Auto-validate the code
        handleAuthCode(receivedCode);
      }
    };

    // Add event listener for custom auth code events
    window.addEventListener(
      'symlog-auth-code',
      handleCustomEvent as EventListener
    );

    return () => {
      window.removeEventListener(
        'symlog-auth-code',
        handleCustomEvent as EventListener
      );
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Clear any popup check intervals
      if (popupCheckIntervalRef.current) {
        clearInterval(popupCheckIntervalRef.current);
      }
    };
  }, []);

  const handleAuthCode = async (code: string) => {
    if (!code || code.trim() === '') {
      toast.error('Please enter a valid authentication code');
      return;
    }

    setIsValidatingCode(true);
    try {
      const result = await validateAuthCode({ authCode: code.trim() });

      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;

      const newUser: AuthUser = {
        id: result.userId,
        email: result.userEmail,
        walletAddress: result.walletAddress,
      };

      localStorage.setItem('symlog_auth_user', JSON.stringify(newUser));
      setUser(newUser);
      setShowAuthDialog(false);
      setAuthCode('');

      toast.success('Authentication successful!', {
        description: `Welcome back, ${newUser.email}`,
      });
    } catch (error: any) {
      logError('WebAuthFlow.handleAuthCode', error, {
        authCode: code.substring(0, 10) + '...',
      });

      // Handle Convex connection errors gracefully
      if (
        error?.message?.includes('ConvexError') ||
        error?.message?.includes('Connection failed')
      ) {
        toast.error('Connection Error', {
          description:
            'Unable to validate code. Please check your connection and try again.',
        });
      } else {
        toast.error('Authentication failed', {
          description: error?.message || 'Invalid or expired code',
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsValidatingCode(false);
      }
    }
  };

  const handleManualCodeSubmit = () => {
    handleAuthCode(authCode);
  };

  const openAuthPopup = () => {
    const authUrl =
      process.env.NEXT_PUBLIC_AUTH_WEB_URL || 'https://auth-web-two.vercel.app'; // SYMLog Auth Portal

    setIsLoading(true);

    // Open the auth website in external browser
    try {
      if (typeof window !== 'undefined' && window.__TAURI__) {
        // In Tauri, use shell plugin through IPC
        window.__TAURI__
          .invoke('plugin:shell|open', { path: authUrl })
          .then(() => {
            if (isMountedRef.current) {
              setShowAuthDialog(true);
              setIsLoading(false);
            }
          })
          .catch(() => {
            // Fallback to window.open if Tauri API is not available
            window.open(authUrl, '_blank');
            if (isMountedRef.current) {
              setShowAuthDialog(true);
              setIsLoading(false);
            }
          });
      } else {
        // In web browser, open popup and store reference
        const popup = window.open(
          authUrl,
          'symlog-auth',
          'width=500,height=700,scrollbars=yes,resizable=yes'
        );
        setAuthPopupWindow(popup);
        setShowAuthDialog(true);
        setIsLoading(false);

        // Monitor popup for closure
        if (popup) {
          // Clear any existing interval
          if (popupCheckIntervalRef.current) {
            clearInterval(popupCheckIntervalRef.current);
          }

          popupCheckIntervalRef.current = setInterval(() => {
            if (popup.closed || !isMountedRef.current) {
              if (isMountedRef.current) {
                setAuthPopupWindow(null);
              }
              if (popupCheckIntervalRef.current) {
                clearInterval(popupCheckIntervalRef.current);
                popupCheckIntervalRef.current = null;
              }
            }
          }, 1000);
        }
      }
    } catch (error) {
      logError('WebAuthFlow.openAuthPopup', error);
      if (isMountedRef.current) {
        toast.error('Failed to open authentication page');
        setIsLoading(false);
      }
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;

      localStorage.removeItem('symlog_auth_user');
      setUser(null);
      setShowAccountDialog(false);
      toast.info('Signed out successfully');
    } catch (error) {
      if (isMountedRef.current) {
        toast.error('Logout failed');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoggingOut(false);
      }
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyAddressToClipboard = async () => {
    if (user?.walletAddress) {
      try {
        await navigator.clipboard.writeText(user.walletAddress);
        if (isMountedRef.current) {
          setCopiedAddress(true);
          toast.success('Address copied to clipboard');
          setTimeout(() => {
            if (isMountedRef.current) {
              setCopiedAddress(false);
            }
          }, 2000);
        }
      } catch (error) {
        if (isMountedRef.current) {
          toast.error('Failed to copy address');
        }
      }
    }
  };

  const getUserInitials = () => {
    const displayName = user?.email || 'User';
    return displayName.slice(0, 2).toUpperCase();
  };

  // Logged in state - show account button
  if (user) {
    return (
      <>
        <GlassButton
          aria-label="Open account menu"
          className="glass-hover flex w-full items-center gap-2 md:w-auto"
          onClick={() => setShowAccountDialog(true)}
          size="sm"
          variant="ghost"
        >
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-primary/20 text-primary text-xs">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
          {user.walletAddress ? formatAddress(user.walletAddress) : user.email}
          <Badge className="ml-2 border-secondary/30 bg-secondary/20 text-secondary">
            <Zap className="mr-1 h-3 w-3" />
            Smart Wallet
          </Badge>
        </GlassButton>

        <Dialog onOpenChange={setShowAccountDialog} open={showAccountDialog}>
          <DialogContent className="glass border-white/10">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
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
                      <AvatarFallback className="bg-primary/20 font-bold text-primary">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-white">{user.email}</p>
                      <p className="flex items-center gap-1 text-sm text-white/60">
                        <User className="h-3 w-3" />
                        Crossmint Account
                      </p>
                    </div>
                  </div>
                  <Badge className="flex items-center gap-1 border-secondary/30 bg-secondary/20 text-secondary">
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
                      <div className="rounded-lg bg-primary/20 p-2">
                        <Wallet className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white">
                            {formatAddress(user.walletAddress)}
                          </p>
                          <GlassButton
                            aria-label="Copy wallet address to clipboard"
                            className="h-auto p-1"
                            onClick={copyAddressToClipboard}
                            size="sm"
                            variant="ghost"
                          >
                            {copiedAddress ? (
                              <CheckCircle2 className="h-4 w-4 text-secondary" />
                            ) : (
                              <Copy className="h-4 w-4 text-white/50" />
                            )}
                          </GlassButton>
                        </div>
                        <p className="flex items-center gap-1 text-sm text-white/60">
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
                <h4 className="mb-3 flex items-center gap-2 font-medium text-sm text-white">
                  <CheckCircle2 className="h-4 w-4 text-secondary" />
                  Smart Wallet Features
                </h4>
                <ul className="space-y-2 text-sm text-white/70">
                  <li className="flex items-center gap-2">
                    <Zap className="h-3 w-3 text-secondary" />
                    Gasless transactions - no fees required
                  </li>
                  <li className="flex items-center gap-2">
                    <Shield className="h-3 w-3 text-secondary" />
                    Programmable security via smart contracts
                  </li>
                  <li className="flex items-center gap-2">
                    <Globe className="h-3 w-3 text-secondary" />
                    Cross-device synchronization
                  </li>
                  <li className="flex items-center gap-2">
                    <User className="h-3 w-3 text-secondary" />
                    Social login - no seed phrases to lose
                  </li>
                </ul>
              </GlassCard>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <GlassButton
                  aria-label="Learn more about Crossmint - opens in new tab"
                  className="flex-1"
                  onClick={() =>
                    window.open('https://www.crossmint.com/', '_blank')
                  }
                  variant="ghost"
                >
                  <Globe className="mr-2 h-4 w-4" />
                  About Crossmint
                </GlassButton>
                <GlassButton
                  aria-label="Sign out of your account"
                  className="flex-1 border-red-400/30 text-red-400 hover:bg-red-400/10"
                  disabled={isLoggingOut}
                  onClick={handleLogout}
                  variant="outline"
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
    );
  }

  // Not logged in - show login button and auth dialog
  return (
    <>
      <GlassButton
        aria-label="Authenticate with wallet"
        className="glow-primary flex w-full items-center gap-2 md:w-auto"
        disabled={isLoading}
        onClick={openAuthPopup}
        size="sm"
        variant="default"
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
      <Dialog onOpenChange={setShowAuthDialog} open={showAuthDialog}>
        <DialogContent className="glass border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Key className="h-5 w-5 text-primary" />
              Enter Authentication Code
            </DialogTitle>
            <DialogDescription className="text-white/70">
              Complete authentication in your browser, then enter the code here
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="glass rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
              <div className="flex items-start gap-3">
                <Monitor className="mt-0.5 h-5 w-5 text-blue-400" />
                <div className="space-y-1">
                  <p className="font-medium text-blue-400 text-sm">
                    Authentication Page Opened
                  </p>
                  <p className="text-white/70 text-xs">
                    Sign in with your Crossmint account in the browser window
                    that just opened. Once complete, the code will appear
                    automatically or you can paste it below.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label
                className="font-medium text-sm text-white"
                htmlFor="authCode"
              >
                Authentication Code
              </label>
              <input
                aria-describedby="auth-code-description"
                aria-invalid={false}
                aria-label="Authentication code"
                className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 font-mono text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                id="authCode"
                onChange={(e) => setAuthCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleManualCodeSubmit()}
                placeholder="SYM_XXXXXXXXXXXXXXXX"
                type="text"
                value={authCode}
              />
              <span className="sr-only" id="auth-code-description">
                Enter the authentication code that starts with SYM underscore
                followed by characters
              </span>
            </div>

            <div className="flex gap-3">
              <GlassButton
                className="flex-1"
                onClick={() => setShowAuthDialog(false)}
                variant="ghost"
              >
                Cancel
              </GlassButton>
              <GlassButton
                className="glow-primary flex-1"
                disabled={isValidatingCode || !authCode.trim()}
                onClick={handleManualCodeSubmit}
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

            <p className="text-center text-white/50 text-xs">
              The authentication code expires in 10 minutes for security.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
