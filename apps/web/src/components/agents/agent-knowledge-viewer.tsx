"use client"

import { useState, useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { GlassCard } from '@/components/ui/glass-card'
import { GlassButton } from '@/components/ui/glass-button'
import { Badge } from '@/components/ui/badge'
import { 
  Brain,
  BookOpen,
  Users,
  Settings,
  Lightbulb,
  Target,
  Search,
  Filter,
  TrendingUp,
  Clock,
  Star,
  Tag
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgentKnowledgeViewerProps {
  userId: string
  agentId: string
  className?: string
}

export function AgentKnowledgeViewer({ userId, agentId, className }: AgentKnowledgeViewerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'confidence' | 'usage'>('recent')

  // Fetch agent data
  const agent = useQuery(api.agents.getAgentById, { userId, agentId })
  const knowledge = useQuery(api.agents.getAgentKnowledge, { 
    userId, 
    agentId,
    category: selectedCategory === 'all' ? undefined : selectedCategory as any,
    limit: 100 
  })
  const stats = useQuery(api.agents.getAgentKnowledgeStats, { userId, agentId })

  // Filter and sort knowledge
  const filteredKnowledge = useMemo(() => {
    if (!knowledge) return []
    
    const filtered = knowledge.filter(item => {
      const matchesSearch = searchQuery === '' || 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.metadata?.tags && item.metadata.tags.some(tag => 
          tag.toLowerCase().includes(searchQuery.toLowerCase())
        ))
      
      return matchesSearch
    })

    // Sort knowledge items
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'confidence':
          return b.confidence - a.confidence
        case 'usage':
          return (b.metadata?.usageCount || 0) - (a.metadata?.usageCount || 0)
        case 'recent':
        default:
          return b.updatedAt - a.updatedAt
      }
    })

    return filtered
  }, [knowledge, searchQuery, sortBy])

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'facts': return BookOpen
      case 'skills': return Target
      case 'preferences': return Star  
      case 'relationships': return Users
      case 'procedures': return Settings
      case 'concepts': return Lightbulb
      default: return Brain
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'facts': return 'text-blue-400 border-blue-500/50'
      case 'skills': return 'text-green-400 border-green-500/50'
      case 'preferences': return 'text-purple-400 border-purple-500/50'
      case 'relationships': return 'text-pink-400 border-pink-500/50'
      case 'procedures': return 'text-orange-400 border-orange-500/50'
      case 'concepts': return 'text-cyan-400 border-cyan-500/50'
      default: return 'text-gray-400 border-gray-500/50'
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400'
    if (confidence >= 0.6) return 'text-yellow-400'
    return 'text-red-400'
  }

  if (!agent || !knowledge || !stats) {
    return (
      <GlassCard className={cn("p-6", className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/10 rounded w-1/3"></div>
          <div className="space-y-2">
            <div className="h-4 bg-white/10 rounded"></div>
            <div className="h-4 bg-white/10 rounded w-3/4"></div>
          </div>
        </div>
      </GlassCard>
    )
  }

  const categories = [
    { key: 'all', label: 'All Knowledge', count: stats.totalKnowledge },
    ...Object.entries(stats.knowledgeByCategory).map(([key, count]) => ({
      key, 
      label: key.charAt(0).toUpperCase() + key.slice(1), 
      count
    }))
  ]

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-periwinkle" />
          <div>
            <h3 className="text-lg font-semibold">Agent Knowledge</h3>
            <p className="text-sm text-muted-foreground">
              {agent.name} • {stats.totalKnowledge} items • {(stats.avgConfidence * 100).toFixed(1)}% avg confidence
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <TrendingUp className="h-3 w-3" />
            {stats.recentMemories} recent updates
          </Badge>
        </div>
      </div>

      {/* Knowledge Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-muted-foreground">Total Knowledge</span>
          </div>
          <div className="text-2xl font-bold">{stats.totalKnowledge}</div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-green-400" />
            <span className="text-sm text-muted-foreground">Avg Confidence</span>
          </div>
          <div className="text-2xl font-bold text-green-400">
            {(stats.avgConfidence * 100).toFixed(1)}%
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-4 w-4 text-purple-400" />
            <span className="text-sm text-muted-foreground">Total Memories</span>
          </div>
          <div className="text-2xl font-bold">{stats.totalMemories}</div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-orange-400" />
            <span className="text-sm text-muted-foreground">Last Updated</span>
          </div>
          <div className="text-sm">
            {stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleDateString() : 'Never'}
          </div>
        </GlassCard>
      </div>

      {/* Filters and Search */}
      <GlassCard className="p-4">
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search knowledge and memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-transparent border border-white/10 rounded-lg focus:outline-none focus:border-periwinkle/50"
            />
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const Icon = getCategoryIcon(category.key)
              return (
                <GlassButton
                  key={category.key}
                  variant={selectedCategory === category.key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedCategory(category.key)}
                  className="gap-2"
                >
                  <Icon className="h-3 w-3" />
                  {category.label}
                  <Badge variant="secondary" className="text-xs">
                    {category.count || 0}
                  </Badge>
                </GlassButton>
              )
            })}
          </div>

          {/* Sort options */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <div className="flex gap-1">
              {[
                { key: 'recent', label: 'Most Recent' },
                { key: 'confidence', label: 'Highest Confidence' },
                { key: 'usage', label: 'Most Used' }
              ].map((option) => (
                <GlassButton
                  key={option.key}
                  variant={sortBy === option.key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSortBy(option.key as any)}
                >
                  {option.label}
                </GlassButton>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Knowledge Items */}
      <div className="space-y-3">
        {filteredKnowledge.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="font-semibold mb-2">No Knowledge Found</h4>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'Try adjusting your search terms.' : 'This agent hasn\'t learned anything yet.'}
            </p>
          </GlassCard>
        ) : (
          filteredKnowledge.map((item) => {
            const Icon = getCategoryIcon(item.category)
            const categoryColor = getCategoryColor(item.category)
            const confidenceColor = getConfidenceColor(item.confidence)
            
            return (
              <GlassCard key={item._id} className="p-4 hover:bg-white/5 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", categoryColor.split(' ')[0])} />
                    <h4 className="font-medium">{item.title}</h4>
                    <Badge variant="outline" className={cn("text-xs", categoryColor)}>
                      {item.category}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={cn("font-medium", confidenceColor)}>
                      {(item.confidence * 100).toFixed(0)}% confidence
                    </span>
                    {item.metadata?.usageCount && (
                      <span>• {item.metadata.usageCount} uses</span>
                    )}
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {item.content}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {item.metadata?.tags && (
                      <div className="flex gap-1">
                        {item.metadata.tags.slice(0, 3).map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs gap-1">
                            <Tag className="h-2 w-2" />
                            {tag}
                          </Badge>
                        ))}
                        {item.metadata.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{item.metadata.tags.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    Updated {new Date(item.updatedAt).toLocaleDateString()}
                    {item.metadata?.source && (
                      <span> • from {item.metadata.source}</span>
                    )}
                  </div>
                </div>
              </GlassCard>
            )
          })
        )}
      </div>

      {/* Load more if needed */}
      {filteredKnowledge.length === 100 && (
        <div className="text-center">
          <GlassButton variant="outline">
            Load More Knowledge
          </GlassButton>
        </div>
      )}
    </div>
  )
}