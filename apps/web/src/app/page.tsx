"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { GlassButton } from "@/components/ui/glass-button"
import { GlassCard } from "@/components/ui/glass-card"
import { Badge } from "@/components/ui/badge"
import { 
  Brain, 
  Zap, 
  Shield, 
  Users, 
  Globe, 
  ChevronRight,
  Sparkles,
  Lock,
  MessageSquare,
  TrendingUp,
  BarChart3,
  Settings,
  Cpu
} from "lucide-react"

export default function Home() {
  const [mounted, setMounted] = useState(false)
  
  // Use optional chaining and error handling for Convex query
  let healthCheck
  try {
    healthCheck = useQuery(api.healthCheck.get)
  } catch (error) {
    console.warn("Convex health check not available:", error)
    healthCheck = null
  }

  useEffect(() => {
    setMounted(true)
    
    // Check for auth code in URL hash (from callback)
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.substring(1)
      const params = new URLSearchParams(hash)
      const authCode = params.get('auth-code')
      
      if (authCode) {
        console.log('Found auth code in URL hash:', authCode)
        // Dispatch custom event to notify auth components
        window.dispatchEvent(new CustomEvent('symlog-auth-code', { 
          detail: { authCode } 
        }))
        
        // Clean up the hash
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    }
  }, [])

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center px-4 py-16 overflow-hidden">
        <div className="relative container mx-auto max-w-6xl text-center">
          <Badge variant="outline" className="mb-8 animate-fade-in glass border-periwinkle/30 text-periwinkle">
            <Sparkles className="mr-1 h-3 w-3" />
            AI Agent Portal • August 2025
          </Badge>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 animate-fade-in animation-delay-200">
            <span className="gradient-text from-periwinkle to-light-green">
              SYMLog Platform
            </span>
            <br />
            <span className="text-foreground">
              AI-Powered Solutions
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-fade-in animation-delay-400">
            Advanced AI-powered platform with secure Web3 integration and cutting-edge technology solutions.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in animation-delay-600">
            <GlassButton size="lg" glow className="min-w-[200px]" asChild>
              <Link href="/contact">
                Get Started
              </Link>
            </GlassButton>
            <GlassButton size="lg" variant="secondary" className="min-w-[200px]" asChild>
              <Link href="/research">
                Learn More
              </Link>
            </GlassButton>
          </div>

        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Advanced Platform Features
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful tools and cutting-edge technology for modern digital solutions
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <GlassCard hover glow="periwinkle" className="animate-fade-in animation-delay-200">
              <Brain className="h-10 w-10 text-periwinkle mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Smart Technology</h3>
              <p className="text-muted-foreground text-sm">
                Advanced intelligent systems with cutting-edge capabilities and modern features
              </p>
            </GlassCard>

            <GlassCard hover glow="green" className="animate-fade-in animation-delay-400">
              <Globe className="h-10 w-10 text-light-green mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Global Platform</h3>
              <p className="text-muted-foreground text-sm">
                Worldwide connectivity and integration for enhanced capabilities and data access
              </p>
            </GlassCard>

            <GlassCard hover className="animate-fade-in animation-delay-600">
              <TrendingUp className="h-10 w-10 text-periwinkle mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Analytics Dashboard</h3>
              <p className="text-muted-foreground text-sm">
                Comprehensive analytics and insights with real-time monitoring and reporting
              </p>
            </GlassCard>

            <GlassCard hover className="animate-fade-in animation-delay-800">
              <Shield className="h-10 w-10 text-light-green mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Web3 Security</h3>
              <p className="text-muted-foreground text-sm">
                Blockchain-secured authentication and decentralized data ownership
              </p>
            </GlassCard>

            <GlassCard hover className="animate-fade-in animation-delay-1000">
              <Settings className="h-10 w-10 text-periwinkle mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Easy Customization</h3>
              <p className="text-muted-foreground text-sm">
                Intuitive interface for configuring agent behavior and capabilities
              </p>
            </GlassCard>

            <GlassCard hover className="animate-fade-in animation-delay-1200">
              <Zap className="h-10 w-10 text-light-green mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">High Performance</h3>
              <p className="text-muted-foreground text-sm">
                Optimized for speed with real-time responses and efficient resource usage
              </p>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <GlassCard className="text-center">
              <Users className="h-8 w-8 text-periwinkle mx-auto mb-3" />
              <div className="text-4xl font-bold mb-2 text-foreground">1000+</div>
              <p className="text-muted-foreground">Active Users</p>
            </GlassCard>
            <GlassCard className="text-center">
              <Globe className="h-8 w-8 text-light-green mx-auto mb-3" />
              <div className="text-4xl font-bold mb-2 text-foreground">25+</div>
              <p className="text-muted-foreground">Countries Served</p>
            </GlassCard>
            <GlassCard className="text-center">
              <Cpu className="h-8 w-8 text-periwinkle mx-auto mb-3" />
              <div className="text-4xl font-bold mb-2 text-foreground">&lt;50ms</div>
              <p className="text-muted-foreground">Average Response Time</p>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 relative">
        <div className="container mx-auto max-w-4xl text-center">
          <GlassCard className="p-12" glow="periwinkle">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Ready to Experience the Future?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join the next generation of digital innovation with cutting-edge technology and Web3 integration
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <GlassButton size="lg" glow className="min-w-[200px]" asChild>
                <Link href="/contact">
                  Get Started
                </Link>
              </GlassButton>
              <GlassButton size="lg" variant="outline" className="min-w-[200px]" asChild>
                <Link href="/research">
                  Learn More
                </Link>
              </GlassButton>
            </div>
          </GlassCard>
        </div>
      </section>
      
    </div>
  )
}