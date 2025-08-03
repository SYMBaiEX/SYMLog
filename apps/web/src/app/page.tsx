"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@SYMLog/backend/convex/_generated/api"
import { GlassButton } from "@/components/ui/glass-button"
import { GlassCard } from "@/components/ui/glass-card"
import { Badge } from "@/components/ui/badge"
import { 
  Brain, 
  Zap, 
  Shield, 
  Bot, 
  Users, 
  Globe, 
  ChevronRight,
  Sparkles,
  Lock,
  MessageSquare,
  TrendingUp,
  BarChart3,
  Settings,
  Database,
  Cpu
} from "lucide-react"

export default function Home() {
  const healthCheck = useQuery(api.healthCheck.get)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
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
              Intelligent AI Agents
            </span>
            <br />
            <span className="text-white">
              MCP Enabled Platform
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl mx-auto animate-fade-in animation-delay-400">
            Create, customize, and manage AI agents with advanced memory systems. 
            Connect Model Context Protocol servers for enhanced capabilities and secure Web3 integration.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in animation-delay-600">
            <GlassButton size="lg" glow className="min-w-[200px]" asChild>
              <Link href="/agents">
                Launch Agent Portal <Bot className="ml-2 h-4 w-4" />
              </Link>
            </GlassButton>
            <GlassButton size="lg" variant="secondary" className="min-w-[200px]" asChild>
              <Link href="/mcp">
                MCP Servers <Database className="ml-2 h-4 w-4" />
              </Link>
            </GlassButton>
          </div>

          {/* System Status */}
          <div className="mt-12 flex justify-center animate-fade-in animation-delay-800">
            <GlassCard className="inline-flex items-center gap-3 px-6 py-3">
              <div
                className={`h-2 w-2 rounded-full pulse-indicator ${
                  healthCheck === "OK" ? "bg-light-green" : healthCheck === undefined ? "bg-yellow-400" : "bg-red-500"
                }`}
              />
              <span className="text-sm text-gray-300">
                System {healthCheck === undefined ? "Initializing..." : healthCheck === "OK" ? "Online" : "Error"}
              </span>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
              Advanced AI Agent Management
            </h2>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Powerful tools for creating, customizing, and deploying intelligent AI agents
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <GlassCard hover glow="periwinkle" className="animate-fade-in animation-delay-200">
              <Bot className="h-10 w-10 text-periwinkle mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Smart AI Agents</h3>
              <p className="text-gray-300 text-sm">
                Create intelligent agents with customizable personalities and advanced reasoning capabilities
              </p>
            </GlassCard>

            <GlassCard hover glow="green" className="animate-fade-in animation-delay-400">
              <Database className="h-10 w-10 text-light-green mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">MCP Integration</h3>
              <p className="text-gray-300 text-sm">
                Connect Model Context Protocol servers for enhanced capabilities and data access
              </p>
            </GlassCard>

            <GlassCard hover className="animate-fade-in animation-delay-600">
              <Brain className="h-10 w-10 text-periwinkle mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Memory Systems</h3>
              <p className="text-gray-300 text-sm">
                Advanced memory management with persistent context and learning capabilities
              </p>
            </GlassCard>

            <GlassCard hover className="animate-fade-in animation-delay-800">
              <Shield className="h-10 w-10 text-light-green mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Web3 Security</h3>
              <p className="text-gray-300 text-sm">
                Blockchain-secured authentication and decentralized data ownership
              </p>
            </GlassCard>

            <GlassCard hover className="animate-fade-in animation-delay-1000">
              <Settings className="h-10 w-10 text-periwinkle mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Easy Customization</h3>
              <p className="text-gray-300 text-sm">
                Intuitive interface for configuring agent behavior and capabilities
              </p>
            </GlassCard>

            <GlassCard hover className="animate-fade-in animation-delay-1200">
              <Zap className="h-10 w-10 text-light-green mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">High Performance</h3>
              <p className="text-gray-300 text-sm">
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
              <Bot className="h-8 w-8 text-periwinkle mx-auto mb-3" />
              <div className="text-4xl font-bold mb-2 text-white">50+</div>
              <p className="text-gray-300">AI Agents Created</p>
            </GlassCard>
            <GlassCard className="text-center">
              <Database className="h-8 w-8 text-light-green mx-auto mb-3" />
              <div className="text-4xl font-bold mb-2 text-white">25+</div>
              <p className="text-gray-300">MCP Servers Connected</p>
            </GlassCard>
            <GlassCard className="text-center">
              <Cpu className="h-8 w-8 text-periwinkle mx-auto mb-3" />
              <div className="text-4xl font-bold mb-2 text-white">&lt;50ms</div>
              <p className="text-gray-300">Average Response Time</p>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 relative">
        <div className="container mx-auto max-w-4xl text-center">
          <GlassCard className="p-12" glow="periwinkle">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
              Ready to Build Your AI Agent Army?
            </h2>
            <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
              Join the next generation of AI-powered productivity with intelligent agents and MCP integration
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <GlassButton size="lg" glow className="min-w-[200px]">
                <Link href="/agents" className="flex items-center">
                  Create First Agent <Bot className="ml-2 h-4 w-4" />
                </Link>
              </GlassButton>
              <GlassButton size="lg" variant="outline" className="min-w-[200px]" asChild>
                <Link href="/contact">
                  Get Support <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </GlassButton>
            </div>
          </GlassCard>
        </div>
      </section>
    </div>
  )
}