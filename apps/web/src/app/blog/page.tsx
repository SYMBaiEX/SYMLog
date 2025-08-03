"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { 
  Calendar, 
  Clock, 
  ArrowRight, 
  Search,
  TrendingUp,
  BookOpen,
  Tag
} from "lucide-react"

const categories = [
  { name: "AI Technology", count: 12, color: "bg-blue-500" },
  { name: "Web3", count: 8, color: "bg-purple-500" },
  { name: "Product Updates", count: 15, color: "bg-green-500" },
  { name: "Tutorials", count: 10, color: "bg-orange-500" },
  { name: "Company News", count: 5, color: "bg-pink-500" },
]

const blogPosts = [
  {
    id: 1,
    title: "Introducing SYMLog: The Future of AI-Powered Chat",
    excerpt: "Today, we're excited to announce the launch of SYMLog, a revolutionary AI chat platform that combines the power of advanced language models with the security of Web3 technology.",
    author: {
      name: "Sarah Chen",
      avatar: "/avatars/sarah.jpg",
      role: "CEO & Co-founder",
    },
    date: "August 3, 2025",
    readTime: "5 min read",
    category: "Company News",
    featured: true,
    image: "/blog/launch.jpg",
  },
  {
    id: 2,
    title: "How We Achieved Sub-100ms Response Times",
    excerpt: "Dive deep into the technical optimizations that allow SYMLog to deliver lightning-fast AI responses while maintaining high accuracy and context awareness.",
    author: {
      name: "Michael Torres",
      avatar: "/avatars/michael.jpg",
      role: "CTO",
    },
    date: "July 28, 2025",
    readTime: "8 min read",
    category: "AI Technology",
    featured: false,
    image: "/blog/performance.jpg",
  },
  {
    id: 3,
    title: "A Beginner's Guide to Web3 Authentication",
    excerpt: "Learn how to connect your Solana wallet to SYMLog and understand the benefits of decentralized authentication for AI applications.",
    author: {
      name: "Emily Watson",
      avatar: "/avatars/emily.jpg",
      role: "Lead Developer",
    },
    date: "July 20, 2025",
    readTime: "6 min read",
    category: "Tutorials",
    featured: false,
    image: "/blog/web3-auth.jpg",
  },
  {
    id: 4,
    title: "Privacy in the Age of AI: Our Approach",
    excerpt: "Explore how SYMLog implements end-to-end encryption and privacy-preserving technologies to ensure your conversations remain confidential.",
    author: {
      name: "David Kim",
      avatar: "/avatars/david.jpg",
      role: "Security Engineer",
    },
    date: "July 15, 2025",
    readTime: "7 min read",
    category: "Web3",
    featured: false,
    image: "/blog/privacy.jpg",
  },
  {
    id: 5,
    title: "Building Conversational AI with Transformers",
    excerpt: "A technical deep-dive into the transformer architecture optimizations that power SYMLog's intelligent conversation capabilities.",
    author: {
      name: "Lisa Anderson",
      avatar: "/avatars/lisa.jpg",
      role: "ML Research Lead",
    },
    date: "July 10, 2025",
    readTime: "10 min read",
    category: "AI Technology",
    featured: false,
    image: "/blog/transformers.jpg",
  },
]

const trendingPosts = [
  {
    id: 1,
    title: "Getting Started with SYMLog API",
    views: "15.2k",
  },
  {
    id: 2,
    title: "Top 10 Use Cases for AI Chat",
    views: "12.8k",
  },
  {
    id: 3,
    title: "Solana Integration Tutorial",
    views: "9.4k",
  },
  {
    id: 4,
    title: "Understanding Token Economics",
    views: "7.1k",
  },
]

export default function BlogPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const filteredPosts = blogPosts.filter((post) => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         post.excerpt.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || post.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const featuredPost = blogPosts.find(post => post.featured)

  return (
    <div className="container mx-auto max-w-7xl px-4 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Blog & Insights
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Stay updated with the latest in AI technology, Web3 innovations, and product updates from the SYMLog team.
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-xl mx-auto mb-12">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          type="search"
          placeholder="Search articles..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-8">
          {/* Featured Post */}
          {featuredPost && !searchQuery && !selectedCategory && (
            <Card className="overflow-hidden border-2">
              <div className="aspect-video bg-muted" />
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="default">Featured</Badge>
                  <Badge variant="outline">{featuredPost.category}</Badge>
                </div>
                <CardTitle className="text-2xl md:text-3xl">
                  {featuredPost.title}
                </CardTitle>
                <CardDescription className="text-base">
                  {featuredPost.excerpt}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {featuredPost.author.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{featuredPost.author.name}</p>
                      <p className="text-xs text-muted-foreground">{featuredPost.author.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {featuredPost.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {featuredPost.readTime}
                    </span>
                  </div>
                </div>
                <Button className="mt-4" asChild>
                  <Link href={`/blog/${featuredPost.id}`}>
                    Read More <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Blog Posts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredPosts
              .filter(post => !post.featured || searchQuery || selectedCategory)
              .map((post) => (
                <Card key={post.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-video bg-muted" />
                  <CardHeader>
                    <Badge variant="outline" className="mb-2 w-fit">
                      {post.category}
                    </Badge>
                    <CardTitle className="line-clamp-2">
                      {post.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-3">
                      {post.excerpt}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {post.author.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{post.author.name}</p>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {post.readTime}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {post.date}
                      </span>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/blog/${post.id}`}>
                          Read <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>

          {filteredPosts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No articles found matching your search.</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant={selectedCategory === null ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => setSelectedCategory(null)}
              >
                All Posts
              </Button>
              {categories.map((category) => (
                <Button
                  key={category.name}
                  variant={selectedCategory === category.name ? "secondary" : "ghost"}
                  className="w-full justify-between"
                  onClick={() => setSelectedCategory(category.name)}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${category.color}`} />
                    {category.name}
                  </span>
                  <span className="text-muted-foreground">{category.count}</span>
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Trending Posts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Trending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trendingPosts.map((post, index) => (
                  <div key={post.id} className="flex items-start gap-3">
                    <span className="text-2xl font-bold text-muted-foreground">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1">
                      <Link 
                        href={`/blog/${post.id}`}
                        className="text-sm font-medium hover:underline line-clamp-2"
                      >
                        {post.title}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-1">
                        {post.views} views
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Newsletter */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Newsletter
              </CardTitle>
              <CardDescription>
                Get the latest updates delivered to your inbox
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3">
                <Input 
                  type="email" 
                  placeholder="Enter your email"
                  className="bg-background"
                />
                <Button className="w-full">
                  Subscribe
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}