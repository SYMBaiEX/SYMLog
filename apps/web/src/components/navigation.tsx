'use client';

import { useAuth } from '@crossmint/client-sdk-react-ui';
import {
  BookOpen,
  Brain,
  FlaskConical,
  Menu,
  MessageSquare,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { CrossmintWalletAuth } from '@/components/crossmint-wallet-auth';
import { WebAuthFlow } from '@/components/dynamic';
import { ModeToggle } from '@/components/mode-toggle';
import { GlassButton } from '@/components/ui/glass-button';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Home', href: '/', icon: Brain },
  { name: 'Blog', href: '/blog', icon: BookOpen },
  { name: 'Research', href: '/research', icon: FlaskConical },
  { name: 'Contact', href: '/contact', icon: Settings },
];

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [focusedIndex, setFocusedIndex] = React.useState(-1);
  const pathname = usePathname();
  const router = useRouter();
  const navRefs = React.useRef<(HTMLAnchorElement | null)[]>([]);

  // Check if user is authenticated
  const clientApiKey = process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_KEY as string;
  const auth = useAuth();
  const isAuthenticated =
    clientApiKey &&
    clientApiKey !== 'your_client_api_key_here' &&
    !!auth.jwt &&
    !!auth.user;

  // Build navigation items including AI Chat and Agent Dashboard for authenticated users
  const navItems = [
    ...navigation,
    ...(isAuthenticated
      ? [
          { name: 'AI Chat', href: '/chat', icon: MessageSquare },
          { name: 'Agent Dashboard', href: '/agents', icon: Sparkles },
        ]
      : []),
  ];

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle navigation when not in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Arrow key navigation
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const currentIndex = focusedIndex === -1 ? 0 : focusedIndex;
        let newIndex: number;

        if (e.key === 'ArrowLeft') {
          newIndex =
            currentIndex === 0 ? navItems.length - 1 : currentIndex - 1;
        } else {
          newIndex =
            currentIndex === navItems.length - 1 ? 0 : currentIndex + 1;
        }

        setFocusedIndex(newIndex);
        navRefs.current[newIndex]?.focus();
      }

      // Enter key to navigate
      if (e.key === 'Enter' && focusedIndex !== -1) {
        const item = navItems[focusedIndex];
        if (item) {
          router.push(item.href);
        }
      }

      // Escape key to unfocus
      if (e.key === 'Escape') {
        setFocusedIndex(-1);
        (document.activeElement as HTMLElement)?.blur();
      }

      // Number keys for quick navigation (1-6 for authenticated users, 1-4 for guests)
      if (
        e.key >= '1' &&
        e.key <= (isAuthenticated ? '6' : '4') &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        const index = Number.parseInt(e.key) - 1;
        if (index < navItems.length) {
          router.push(navItems[index].href);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, router, isAuthenticated, navItems.length]);

  return (
    <header className="navigation glass sticky top-0 z-50 w-full border-border border-b backdrop-blur-xl">
      <nav className="container mx-auto flex h-16 items-center px-4 sm:px-6 lg:px-8">
        <div className="flex flex-1 items-center justify-between">
          {/* Logo */}
          <Link className="group flex items-center space-x-2" href="/">
            <Brain className="h-8 w-8 text-periwinkle group-hover:animate-pulse" />
            <span className="gradient-text from-periwinkle to-light-green font-bold text-2xl">
              SYMLog
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-2">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  aria-label={`Navigate to ${item.name} (Press ${index + 1} for quick access)`}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-4 py-2 font-medium text-sm transition-all duration-300',
                    'hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    isActive
                      ? 'glow-periwinkle border border-periwinkle/30 bg-periwinkle/20 text-periwinkle'
                      : 'text-muted-foreground',
                    focusedIndex === index && 'ring-2 ring-ring ring-offset-2'
                  )}
                  href={item.href}
                  key={item.name}
                  onBlur={() => setFocusedIndex(-1)}
                  onFocus={() => setFocusedIndex(index)}
                  ref={(el) => {
                    navRefs.current[index] = el;
                  }}
                  tabIndex={0}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-4">
            <ModeToggle />
            <WebAuthFlow />

            {/* Mobile menu button */}
            <GlassButton
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              size="icon"
              variant="ghost"
            >
              <span className="sr-only">Open main menu</span>
              {mobileMenuOpen ? (
                <X aria-hidden="true" className="h-6 w-6" />
              ) : (
                <Menu aria-hidden="true" className="h-6 w-6" />
              )}
            </GlassButton>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="glass animate-slide-down border-border border-t md:hidden">
          <div className="space-y-2 px-4 pt-2 pb-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-4 py-3 font-medium text-base transition-all duration-300',
                    'hover:bg-accent hover:text-foreground',
                    isActive
                      ? 'border border-periwinkle/30 bg-periwinkle/20 text-periwinkle'
                      : 'text-muted-foreground'
                  )}
                  href={item.href}
                  key={item.name}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
            <div className="mt-4 border-white/10 border-t pt-4">
              <WebAuthFlow />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
