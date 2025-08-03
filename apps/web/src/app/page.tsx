"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@SYMLog/backend/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Brain, 
  Zap, 
  Shield, 
  Code, 
  Users, 
  Globe, 
  ChevronRight,
  Sparkles,
  Lock,
  MessageSquare,
  TrendingUp,
  BarChart3
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
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
        
        {/* Animated background elements */}
        {mounted && (
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl animate-pulse animation-delay-2000" />
          </div>
        )}

        <div className="relative container mx-auto max-w-6xl text-center">
          <Badge variant="outline" className="mb-8 animate-fade-in">
            <Sparkles className="mr-1 h-3 w-3" />
            Launching August 2025
          </Badge>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 animate-fade-in animation-delay-200">
            <span className="bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">
              AI-Powered Chat
            </span>
            <br />
            <span className="text-foreground">
              for the Web3 Era
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-fade-in animation-delay-400">
            Experience intelligent conversations secured by blockchain technology. 
            Connect your Solana wallet for personalized AI interactions with complete data ownership.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in animation-delay-600">
            <Button size="lg" className="min-w-[200px]" asChild>
              <Link href="/chat">
                Get Started <ChevronRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="min-w-[200px]" asChild>
              <Link href="/research">
                View Research
              </Link>
            </Button>
          </div>

          {/* API Status indicator */}
          <div className="mt-12 flex justify-center animate-fade-in animation-delay-800">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background/50 backdrop-blur-sm border">
              <div
                className={`h-2 w-2 rounded-full ${
                  healthCheck === "OK" ? "bg-green-500" : healthCheck === undefined ? "bg-orange-400" : "bg-red-500"
                }`}
              />
              <span className="text-sm text-muted-foreground">
                System {healthCheck === undefined ? "Checking..." : healthCheck === "OK" ? "Online" : "Error"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why Choose SYMLog?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Combining cutting-edge AI technology with Web3 security for the ultimate chat experience
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <Brain className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Advanced AI</CardTitle>
                <CardDescription>
                  State-of-the-art language models for intelligent, context-aware conversations
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <Shield className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Web3 Security</CardTitle>
                <CardDescription>
                  Solana blockchain integration ensures data ownership and secure authentication
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <Zap className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Lightning Fast</CardTitle>
                <CardDescription>
                  Real-time responses with optimized performance across all devices
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <Lock className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Privacy First</CardTitle>
                <CardDescription>
                  Your conversations remain private with end-to-end encryption
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <Users className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Multi-User Support</CardTitle>
                <CardDescription>
                  Collaborate with team members in shared AI-powered workspaces
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <Globe className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Global Access</CardTitle>
                <CardDescription>
                  Available worldwide with multi-language support and regional optimization
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <MessageSquare className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-4xl font-bold mb-2">1M+</div>
              <p className="text-muted-foreground">Messages Processed</p>
            </div>
            <div>
              <TrendingUp className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-4xl font-bold mb-2">99.9%</div>
              <p className="text-muted-foreground">Uptime Guarantee</p>
            </div>
            <div>
              <BarChart3 className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-4xl font-bold mb-2">&lt;100ms</div>
              <p className="text-muted-foreground">Average Response Time</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary/5">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Experience the Future?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of users already leveraging AI with Web3 security
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="min-w-[200px]">
              Start Free Trial <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="min-w-[200px]" asChild>
              <Link href="/contact">
                Contact Sales
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}