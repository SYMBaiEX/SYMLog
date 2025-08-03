"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, Brain, Bot, Database, Settings } from "lucide-react"

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
import { PhantomWalletConnect } from "@/components/phantom-wallet-connect"
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

const navigation = [
  { name: "Home", href: "/", icon: Brain },
  { name: "Agents", href: "/agents", icon: Bot },
  { name: "MCP Servers", href: "/mcp", icon: Database },
  { name: "Contact", href: "/contact", icon: Settings },
]

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full glass backdrop-blur-xl border-b border-white/10">
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
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300",
                    "hover:bg-white/10 hover:text-white",
                    isActive 
                      ? "bg-periwinkle/20 text-periwinkle border border-periwinkle/30 glow-periwinkle" 
                      : "text-gray-300"
                  )}
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
            <PhantomWalletConnect />

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
        <div className="md:hidden glass border-t border-white/10 animate-slide-down">
          <div className="space-y-2 px-4 pb-4 pt-2">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all duration-300",
                    "hover:bg-white/10 hover:text-white",
                    isActive 
                      ? "bg-periwinkle/20 text-periwinkle border border-periwinkle/30" 
                      : "text-gray-300"
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
            <div className="mt-4 pt-4 border-t border-white/10">
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
                  width: '100%'
                }}
              />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}