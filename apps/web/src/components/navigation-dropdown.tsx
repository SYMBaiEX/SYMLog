'use client';

import {
  Activity,
  Bell,
  BookOpen,
  ChevronDown,
  Database,
  FileCode,
  FileText,
  FlaskConical,
  GitBranch,
  Globe,
  HelpCircle,
  LogOut,
  MessageSquare,
  Package,
  Palette,
  Settings,
  Shield,
  Sparkles,
  Terminal,
  TrendingUp,
  User,
  Users,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
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
} from '@/components/ui/dropdown-menu';
import { GlassButton } from '@/components/ui/glass-button';
import { cn } from '@/lib/utils';

interface NavigationDropdownProps {
  className?: string;
}

export function NavigationDropdown({ className }: NavigationDropdownProps) {
  const router = useRouter();

  const productItems = [
    {
      label: 'Platform Overview',
      icon: Sparkles,
      description: 'Learn about our AI-powered platform',
      href: '/platform',
    },
    {
      label: 'Features',
      icon: Zap,
      description: 'Explore all platform capabilities',
      href: '/features',
    },
    {
      label: 'API Documentation',
      icon: FileCode,
      description: 'Developer guides and references',
      href: '/docs/api',
    },
    {
      label: 'Integrations',
      icon: Package,
      description: 'Connect with your favorite tools',
      href: '/integrations',
    },
  ];

  const resourceItems = [
    {
      label: 'Documentation',
      icon: BookOpen,
      description: 'Comprehensive guides and tutorials',
      href: '/docs',
    },
    {
      label: 'Research Papers',
      icon: FlaskConical,
      description: 'Latest AI research and findings',
      href: '/research',
    },
    {
      label: 'Blog',
      icon: FileText,
      description: 'News, updates, and insights',
      href: '/blog',
    },
    {
      label: 'Community',
      icon: Users,
      description: 'Join our developer community',
      href: '/community',
    },
    {
      label: 'Status',
      icon: Activity,
      description: 'System status and uptime',
      href: '/status',
    },
  ];

  const developerItems = [
    {
      label: 'Getting Started',
      icon: GitBranch,
      description: 'Quick start guide for developers',
      href: '/docs/getting-started',
    },
    {
      label: 'API Explorer',
      icon: Globe,
      description: 'Interactive API testing',
      href: '/api-explorer',
    },
    {
      label: 'SDKs & Libraries',
      icon: Package,
      description: 'Client libraries for all platforms',
      href: '/sdks',
    },
    {
      label: 'Developer Console',
      icon: Terminal,
      description: 'Manage your applications',
      href: '/console',
    },
  ];

  return (
    <div className={cn('flex items-center space-x-1', className)}>
      {/* Products Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <GlassButton
            className="h-9 px-3 font-medium text-sm"
            size="sm"
            variant="ghost"
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
              className="cursor-pointer"
              key={item.href}
              onClick={() => router.push(item.href)}
            >
              <div className="flex items-start gap-3">
                <item.icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="space-y-0.5">
                  <div className="font-medium text-sm">{item.label}</div>
                  <div className="text-muted-foreground text-xs">
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
            className="h-9 px-3 font-medium text-sm"
            size="sm"
            variant="ghost"
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
              className="cursor-pointer"
              key={item.href}
              onClick={() => router.push(item.href)}
            >
              <div className="flex items-start gap-3">
                <item.icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="space-y-0.5">
                  <div className="font-medium text-sm">{item.label}</div>
                  <div className="text-muted-foreground text-xs">
                    {item.description}
                  </div>
                </div>
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => router.push('/support')}
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
            className="h-9 px-3 font-medium text-sm"
            size="sm"
            variant="ghost"
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
              className="cursor-pointer"
              key={item.href}
              onClick={() => router.push(item.href)}
            >
              <div className="flex items-start gap-3">
                <item.icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="space-y-0.5">
                  <div className="font-medium text-sm">{item.label}</div>
                  <div className="text-muted-foreground text-xs">
                    {item.description}
                  </div>
                </div>
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => window.open('https://github.com/symlog', '_blank')}
          >
            <GitBranch className="mr-2 h-4 w-4" />
            GitHub Repository
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
