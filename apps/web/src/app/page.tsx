'use client';

import { useQuery } from 'convex/react';
import {
  BarChart3,
  Brain,
  ChevronRight,
  Cpu,
  Globe,
  Lock,
  MessageSquare,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';
import { api } from '../../convex/_generated/api';

export default function Home() {
  const [mounted, setMounted] = useState(false);

  // Use optional chaining and error handling for Convex query
  let healthCheck;
  try {
    healthCheck = useQuery(api.healthCheck.get);
  } catch (error) {
    console.warn('Convex health check not available:', error);
    healthCheck = null;
  }

  useEffect(() => {
    setMounted(true);

    // Check for auth code in URL hash (from callback)
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const authCode = params.get('auth-code');

      if (authCode) {
        console.log('Found auth code in URL hash:', authCode);
        // Dispatch custom event to notify auth components
        window.dispatchEvent(
          new CustomEvent('symlog-auth-code', {
            detail: { authCode },
          })
        );

        // Clean up the hash
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search
        );
      }
    }
  }, []);

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden px-4 py-16">
        <div className="container relative mx-auto max-w-6xl text-center">
          <Badge
            className="glass mb-8 animate-fade-in border-periwinkle/30 text-periwinkle"
            variant="outline"
          >
            <Sparkles className="mr-1 h-3 w-3" />
            AI Agent Portal • August 2025
          </Badge>

          <h1 className="animation-delay-200 mb-6 animate-fade-in font-bold text-4xl md:text-6xl lg:text-7xl">
            <span className="gradient-text from-periwinkle to-light-green">
              SYMLog Platform
            </span>
            <br />
            <span className="text-foreground">AI-Powered Solutions</span>
          </h1>

          <p className="animation-delay-400 mx-auto mb-8 max-w-2xl animate-fade-in text-lg text-muted-foreground md:text-xl">
            Advanced AI-powered platform with secure Web3 integration and
            cutting-edge technology solutions.
          </p>

          <div className="animation-delay-600 flex animate-fade-in flex-col items-center justify-center gap-4 sm:flex-row">
            <GlassButton asChild className="min-w-[200px]" glow size="lg">
              <Link href="/contact">Get Started</Link>
            </GlassButton>
            <GlassButton
              asChild
              className="min-w-[200px]"
              size="lg"
              variant="secondary"
            >
              <Link href="/research">Learn More</Link>
            </GlassButton>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-20">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 font-bold text-3xl text-foreground md:text-4xl">
              Advanced Platform Features
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Powerful tools and cutting-edge technology for modern digital
              solutions
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <GlassCard
              className="animation-delay-200 animate-fade-in"
              glow="periwinkle"
              hover
            >
              <Brain className="mb-4 h-10 w-10 text-periwinkle" />
              <h3 className="mb-2 font-semibold text-foreground text-lg">
                Smart Technology
              </h3>
              <p className="text-muted-foreground text-sm">
                Advanced intelligent systems with cutting-edge capabilities and
                modern features
              </p>
            </GlassCard>

            <GlassCard
              className="animation-delay-400 animate-fade-in"
              glow="green"
              hover
            >
              <Globe className="mb-4 h-10 w-10 text-light-green" />
              <h3 className="mb-2 font-semibold text-foreground text-lg">
                Global Platform
              </h3>
              <p className="text-muted-foreground text-sm">
                Worldwide connectivity and integration for enhanced capabilities
                and data access
              </p>
            </GlassCard>

            <GlassCard className="animation-delay-600 animate-fade-in" hover>
              <TrendingUp className="mb-4 h-10 w-10 text-periwinkle" />
              <h3 className="mb-2 font-semibold text-foreground text-lg">
                Analytics Dashboard
              </h3>
              <p className="text-muted-foreground text-sm">
                Comprehensive analytics and insights with real-time monitoring
                and reporting
              </p>
            </GlassCard>

            <GlassCard className="animation-delay-800 animate-fade-in" hover>
              <Shield className="mb-4 h-10 w-10 text-light-green" />
              <h3 className="mb-2 font-semibold text-foreground text-lg">
                Web3 Security
              </h3>
              <p className="text-muted-foreground text-sm">
                Blockchain-secured authentication and decentralized data
                ownership
              </p>
            </GlassCard>

            <GlassCard className="animation-delay-1000 animate-fade-in" hover>
              <Settings className="mb-4 h-10 w-10 text-periwinkle" />
              <h3 className="mb-2 font-semibold text-foreground text-lg">
                Easy Customization
              </h3>
              <p className="text-muted-foreground text-sm">
                Intuitive interface for configuring agent behavior and
                capabilities
              </p>
            </GlassCard>

            <GlassCard className="animation-delay-1200 animate-fade-in" hover>
              <Zap className="mb-4 h-10 w-10 text-light-green" />
              <h3 className="mb-2 font-semibold text-foreground text-lg">
                High Performance
              </h3>
              <p className="text-muted-foreground text-sm">
                Optimized for speed with real-time responses and efficient
                resource usage
              </p>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-4 py-20">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-8 text-center md:grid-cols-3">
            <GlassCard className="text-center">
              <Users className="mx-auto mb-3 h-8 w-8 text-periwinkle" />
              <div className="mb-2 font-bold text-4xl text-foreground">
                1000+
              </div>
              <p className="text-muted-foreground">Active Users</p>
            </GlassCard>
            <GlassCard className="text-center">
              <Globe className="mx-auto mb-3 h-8 w-8 text-light-green" />
              <div className="mb-2 font-bold text-4xl text-foreground">25+</div>
              <p className="text-muted-foreground">Countries Served</p>
            </GlassCard>
            <GlassCard className="text-center">
              <Cpu className="mx-auto mb-3 h-8 w-8 text-periwinkle" />
              <div className="mb-2 font-bold text-4xl text-foreground">
                &lt;50ms
              </div>
              <p className="text-muted-foreground">Average Response Time</p>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative px-4 py-20">
        <div className="container mx-auto max-w-4xl text-center">
          <GlassCard className="p-12" glow="periwinkle">
            <h2 className="mb-4 font-bold text-3xl text-foreground md:text-4xl">
              Ready to Experience the Future?
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
              Join the next generation of digital innovation with cutting-edge
              technology and Web3 integration
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <GlassButton asChild className="min-w-[200px]" glow size="lg">
                <Link href="/contact">Get Started</Link>
              </GlassButton>
              <GlassButton
                asChild
                className="min-w-[200px]"
                size="lg"
                variant="outline"
              >
                <Link href="/research">Learn More</Link>
              </GlassButton>
            </div>
          </GlassCard>
        </div>
      </section>
    </div>
  );
}
