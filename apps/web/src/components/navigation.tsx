"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Menu, X, Brain, Settings, BookOpen, FlaskConical, MessageSquare } from "lucide-react"

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { GlassButton } from "@/components/ui/glass-button"
import { ModeToggle } from "@/components/mode-toggle"
import { cn } from "@/lib/utils"
import { CrossmintWalletAuth } from "@/components/crossmint-wallet-auth"
import { useAuth } from "@crossmint/client-sdk-react-ui"

const navigation = [
  { name: "Home", href: "/", icon: Brain },
  { name: "Blog", href: "/blog", icon: BookOpen },
  { name: "Research", href: "/research", icon: FlaskConical },
  { name: "Contact", href: "/contact", icon: Settings },
]

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [focusedIndex, setFocusedIndex] = React.useState(-1)
  const pathname = usePathname()
  const router = useRouter()
  const navRefs = React.useRef<(HTMLAnchorElement | null)[]>([])

  // Check if user is authenticated
  let isAuthenticated = false
  try {
    const clientApiKey = process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_KEY as string
    if (clientApiKey && clientApiKey !== 'your_client_api_key_here') {
      const auth = useAuth()
      isAuthenticated = !!auth.jwt && !!auth.user
    }
  } catch (error) {
    // Crossmint not available
  }

  // Build navigation items including AI Chat for authenticated users
  const navItems = [
    ...navigation,
    ...(isAuthenticated ? [{ name: "AI Chat", href: "/chat", icon: MessageSquare }] : [])
  ]

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle navigation when not in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Arrow key navigation
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault()
        const currentIndex = focusedIndex === -1 ? 0 : focusedIndex
        let newIndex: number

        if (e.key === "ArrowLeft") {
          newIndex = currentIndex === 0 ? navItems.length - 1 : currentIndex - 1
        } else {
          newIndex = currentIndex === navItems.length - 1 ? 0 : currentIndex + 1
        }

        setFocusedIndex(newIndex)
        navRefs.current[newIndex]?.focus()
      }

      // Enter key to navigate
      if (e.key === "Enter" && focusedIndex !== -1) {
        const item = navItems[focusedIndex]
        if (item) {
          router.push(item.href)
        }
      }

      // Escape key to unfocus
      if (e.key === "Escape") {
        setFocusedIndex(-1)
        ;(document.activeElement as HTMLElement)?.blur()
      }

      // Number keys for quick navigation (1-4)
      if (e.key >= "1" && e.key <= "5" && !e.metaKey && !e.ctrlKey) {
        const index = parseInt(e.key) - 1
        if (index < navItems.length) {
          router.push(navItems[index].href)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [focusedIndex, router])

  return (
    <header className="sticky top-0 z-50 w-full glass backdrop-blur-xl border-b border-border">
      <nav className="container mx-auto flex h-16 items-center px-4 sm:px-6 lg:px-8">
        <div className="flex flex-1 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <Brain className="h-8 w-8 text-periwinkle group-hover:animate-pulse" />
            <span className="text-2xl font-bold gradient-text from-periwinkle to-light-green">
              SYMLog
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-2">
            {navItems.map((item, index) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  ref={(el) => { navRefs.current[index] = el }}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300",
                    "hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    isActive 
                      ? "bg-periwinkle/20 text-periwinkle border border-periwinkle/30 glow-periwinkle" 
                      : "text-muted-foreground",
                    focusedIndex === index && "ring-2 ring-ring ring-offset-2"
                  )}
                  onFocus={() => setFocusedIndex(index)}
                  onBlur={() => setFocusedIndex(-1)}
                  tabIndex={0}
                  aria-label={`Navigate to ${item.name} (Press ${index + 1} for quick access)`}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              )
            })}
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-4">
            <ModeToggle />
            <CrossmintWalletAuth />

            {/* Mobile menu button */}
            <GlassButton
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className="sr-only">Open main menu</span>
              {mobileMenuOpen ? (
                <X className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="h-6 w-6" aria-hidden="true" />
              )}
            </GlassButton>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden glass border-t border-border animate-slide-down">
          <div className="space-y-2 px-4 pb-4 pt-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all duration-300",
                    "hover:bg-accent hover:text-foreground",
                    isActive 
                      ? "bg-periwinkle/20 text-periwinkle border border-periwinkle/30" 
                      : "text-muted-foreground"
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
            <div className="mt-4 pt-4 border-t border-white/10">
              <CrossmintWalletAuth />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}