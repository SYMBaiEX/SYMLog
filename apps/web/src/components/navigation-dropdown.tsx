"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ChevronDown,
  FileText,
  BookOpen,
  FlaskConical,
  Sparkles,
  TrendingUp,
  Users,
  HelpCircle,
  MessageSquare,
  Settings,
  Shield,
  Database,
  Globe,
  Terminal,
  Palette,
  Bell,
  User,
  LogOut,
  Activity,
  FileCode,
  GitBranch,
  Package,
  Zap
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GlassButton } from "@/components/ui/glass-button"
import { cn } from "@/lib/utils"

interface NavigationDropdownProps {
  className?: string
}

export function NavigationDropdown({ className }: NavigationDropdownProps) {
  const router = useRouter()

  const productItems = [
    {
      label: "Platform Overview",
      icon: Sparkles,
      description: "Learn about our AI-powered platform",
      href: "/platform"
    },
    {
      label: "Features",
      icon: Zap,
      description: "Explore all platform capabilities",
      href: "/features"
    },
    {
      label: "API Documentation",
      icon: FileCode,
      description: "Developer guides and references",
      href: "/docs/api"
    },
    {
      label: "Integrations",
      icon: Package,
      description: "Connect with your favorite tools",
      href: "/integrations"
    },
  ]

  const resourceItems = [
    {
      label: "Documentation",
      icon: BookOpen,
      description: "Comprehensive guides and tutorials",
      href: "/docs"
    },
    {
      label: "Research Papers",
      icon: FlaskConical,
      description: "Latest AI research and findings",
      href: "/research"
    },
    {
      label: "Blog",
      icon: FileText,
      description: "News, updates, and insights",
      href: "/blog"
    },
    {
      label: "Community",
      icon: Users,
      description: "Join our developer community",
      href: "/community"
    },
    {
      label: "Status",
      icon: Activity,
      description: "System status and uptime",
      href: "/status"
    },
  ]

  const developerItems = [
    {
      label: "Getting Started",
      icon: GitBranch,
      description: "Quick start guide for developers",
      href: "/docs/getting-started"
    },
    {
      label: "API Explorer",
      icon: Globe,
      description: "Interactive API testing",
      href: "/api-explorer"
    },
    {
      label: "SDKs & Libraries",
      icon: Package,
      description: "Client libraries for all platforms",
      href: "/sdks"
    },
    {
      label: "Developer Console",
      icon: Terminal,
      description: "Manage your applications",
      href: "/console"
    },
  ]

  return (
    <div className={cn("flex items-center space-x-1", className)}>
      {/* Products Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <GlassButton
            variant="ghost"
            size="sm"
            className="h-9 px-3 text-sm font-medium"
          >
            Products
            <ChevronDown className="ml-1 h-3 w-3" />
          </GlassButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[280px]">
          <DropdownMenuLabel>Our Products</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {productItems.map((item) => (
            <DropdownMenuItem
              key={item.href}
              className="cursor-pointer"
              onClick={() => router.push(item.href)}
            >
              <div className="flex items-start gap-3">
                <item.icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.description}
                  </div>
                </div>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Resources Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <GlassButton
            variant="ghost"
            size="sm"
            className="h-9 px-3 text-sm font-medium"
          >
            Resources
            <ChevronDown className="ml-1 h-3 w-3" />
          </GlassButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[280px]">
          <DropdownMenuLabel>Resources & Support</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {resourceItems.map((item) => (
            <DropdownMenuItem
              key={item.href}
              className="cursor-pointer"
              onClick={() => router.push(item.href)}
            >
              <div className="flex items-start gap-3">
                <item.icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.description}
                  </div>
                </div>
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => router.push("/support")}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Contact Support
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Developers Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <GlassButton
            variant="ghost"
            size="sm"
            className="h-9 px-3 text-sm font-medium"
          >
            Developers
            <ChevronDown className="ml-1 h-3 w-3" />
          </GlassButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[280px]">
          <DropdownMenuLabel>Developer Resources</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {developerItems.map((item) => (
            <DropdownMenuItem
              key={item.href}
              className="cursor-pointer"
              onClick={() => router.push(item.href)}
            >
              <div className="flex items-start gap-3">
                <item.icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.description}
                  </div>
                </div>
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => window.open("https://github.com/symlog", "_blank")}
          >
            <GitBranch className="mr-2 h-4 w-4" />
            GitHub Repository
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}