"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { 
  Brain, 
  FileText, 
  TrendingUp, 
  Users, 
  Award,
  BookOpen,
  Download,
  ExternalLink,
  Calendar,
  Clock
} from "lucide-react"

const papers = [
  {
    title: "Transformer Architecture Optimization for Real-Time Chat Applications",
    authors: ["Dr. Sarah Chen", "Prof. Michael Torres", "Dr. Emily Watson"],
    date: "July 2025",
    abstract: "We present a novel approach to optimizing transformer architectures specifically for real-time conversational AI, achieving 40% reduction in latency while maintaining accuracy.",
    tags: ["Machine Learning", "Transformers", "Optimization"],
    citations: 145,
    downloads: 3200,
  },
  {
    title: "Web3 Authentication Patterns for AI Systems",
    authors: ["Dr. Alex Johnson", "Dr. Maria Rodriguez"],
    date: "June 2025",
    abstract: "This paper explores secure authentication patterns using blockchain technology for AI applications, with a focus on Solana integration and signature verification.",
    tags: ["Blockchain", "Security", "Web3"],
    citations: 89,
    downloads: 2100,
  },
  {
    title: "Privacy-Preserving Machine Learning in Decentralized Chat Systems",
    authors: ["Prof. David Kim", "Dr. Lisa Anderson", "Dr. James Mitchell"],
    date: "May 2025",
    abstract: "We introduce a framework for implementing privacy-preserving ML models in decentralized chat applications using federated learning and homomorphic encryption.",
    tags: ["Privacy", "Federated Learning", "Decentralization"],
    citations: 203,
    downloads: 4500,
  },
]

const achievements = [
  {
    icon: Award,
    title: "Best Paper Award",
    description: "NeurIPS 2025 - Transformer Optimization",
    year: "2025",
  },
  {
    icon: Users,
    title: "Industry Partnership",
    description: "Collaboration with Solana Foundation",
    year: "2025",
  },
  {
    icon: TrendingUp,
    title: "Performance Milestone",
    description: "Sub-100ms response time achieved",
    year: "2025",
  },
]

export default function ResearchPage() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Research & Development
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          Advancing the frontier of AI and Web3 technology through cutting-edge research 
          and innovation. Our team is dedicated to pushing the boundaries of what's possible 
          in decentralized AI systems.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium">Publications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">24</div>
            <p className="text-sm text-muted-foreground">Peer-reviewed papers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium">Citations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">1,847</div>
            <p className="text-sm text-muted-foreground">Total citations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium">Researchers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">15</div>
            <p className="text-sm text-muted-foreground">PhD researchers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium">Patents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">7</div>
            <p className="text-sm text-muted-foreground">Filed patents</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Papers */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Recent Publications</h2>
        <div className="space-y-6">
          {papers.map((paper, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <CardTitle className="text-xl">{paper.title}</CardTitle>
                    <CardDescription className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {paper.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        {paper.citations} citations
                      </span>
                      <span className="flex items-center gap-1">
                        <Download className="h-4 w-4" />
                        {paper.downloads} downloads
                      </span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">{paper.abstract}</p>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    {paper.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Download className="mr-2 h-4 w-4" />
                      PDF
                    </Button>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View
                    </Button>
                  </div>
                </div>
                <Separator className="my-4" />
                <p className="text-sm text-muted-foreground">
                  Authors: {paper.authors.join(", ")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Research Areas */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Research Areas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <Brain className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Natural Language Processing</CardTitle>
              <CardDescription>
                Advanced transformer models and architectures optimized for real-time 
                conversational AI with sub-100ms response times.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <BookOpen className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Decentralized AI</CardTitle>
              <CardDescription>
                Exploring the intersection of blockchain technology and artificial 
                intelligence for secure, privacy-preserving systems.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <TrendingUp className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Performance Optimization</CardTitle>
              <CardDescription>
                Developing techniques to reduce latency and improve efficiency in 
                large-scale AI deployments across distributed networks.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Achievements */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Recent Achievements</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {achievements.map((achievement, index) => {
            const Icon = achievement.icon
            return (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{achievement.title}</CardTitle>
                      <CardDescription>{achievement.description}</CardDescription>
                      <p className="text-sm text-muted-foreground mt-1">
                        {achievement.year}
                      </p>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      </section>

      {/* CTA */}
      <div className="mt-12 text-center">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl">Collaborate With Us</CardTitle>
            <CardDescription className="text-base">
              We're always looking for talented researchers and industry partners 
              to push the boundaries of AI and Web3 technology.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" asChild>
              <a href="/contact">
                Get in Touch
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}