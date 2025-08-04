"use client"

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { GlassCard } from '@/components/ui/glass-card'
import { GlassButton } from '@/components/ui/glass-button'
import { Badge } from '@/components/ui/badge'
import { AgentKnowledgeViewer } from './agent-knowledge-viewer'
import { AgentMemoryTimeline } from './agent-memory-timeline'
import { AgentLearningAnalytics } from './agent-learning-analytics'
import { 
  Brain,
  Clock,
  BarChart3,
  MessageSquare,
  Settings,
  User,
  Sparkles,
  Activity,
  ChevronDown
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgentDashboardProps {
  userId: string
  className?: string
}

type DashboardView = 'overview' | 'knowledge' | 'memories' | 'analytics' | 'conversations'

export function AgentDashboard({ userId, className }: AgentDashboardProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [currentView, setCurrentView] = useState<DashboardView>('overview')

  // Fetch user's agents
  const agents = useQuery(api.agents.getActiveAgents, { userId })
  const selectedAgent = useQuery(api.agents.getAgentById, 
    selectedAgentId ? { userId, agentId: selectedAgentId } : undefined
  )
  const stats = useQuery(api.agents.getAgentKnowledgeStats, 
    selectedAgentId ? { userId, agentId: selectedAgentId } : undefined
  )

  const viewOptions = [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'knowledge', label: 'Knowledge', icon: Brain },
    { key: 'memories', label: 'Memory Timeline', icon: Clock },
    { key: 'analytics', label: 'Learning Analytics', icon: BarChart3 },
    { key: 'conversations', label: 'Conversations', icon: MessageSquare },
  ]

  if (!agents) {
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

  // Auto-select first agent if none selected
  if (agents.length > 0 && !selectedAgentId) {
    setSelectedAgentId(agents[0]._id)
  }

  if (agents.length === 0) {
    return (
      <GlassCard className={cn("p-8 text-center", className)}>
        <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Agents Found</h3>
        <p className="text-sm text-muted-foreground mb-4">
          You haven&apos;t created any AI agents yet. Create your first agent to start building knowledge and memories.
        </p>
        <GlassButton className="gap-2">
          <Sparkles className="h-4 w-4" />
          Create Your First Agent
        </GlassButton>
      </GlassCard>
    )
  }

  const renderOverview = () => {
    if (!selectedAgent || !stats) return null

    return (
      <div className="space-y-6">
        {/* Agent Overview */}
        <GlassCard className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-periwinkle/20 to-purple-500/20 flex items-center justify-center">
                <Brain className="h-6 w-6 text-periwinkle" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{selectedAgent.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedAgent.description || 'No description provided'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" />
                {selectedAgent.model}
              </Badge>
              <Badge variant={selectedAgent.isActive ? "default" : "secondary"}>
                {selectedAgent.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{stats.totalKnowledge}</div>
              <div className="text-xs text-muted-foreground">Knowledge Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{stats.totalMemories}</div>
              <div className="text-xs text-muted-foreground">Total Memories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">
                {(stats.avgConfidence * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">Avg Confidence</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-400">{stats.recentMemories}</div>
              <div className="text-xs text-muted-foreground">Recent Updates</div>
            </div>
          </div>
        </GlassCard>

        {/* Knowledge Categories */}
        <GlassCard className="p-6">
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <Brain className="h-5 w-5 text-periwinkle" />
            Knowledge Distribution
          </h4>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(stats.knowledgeByCategory).map(([category, count]) => (
              <div key={category} className="text-center p-3 rounded-lg bg-white/5">
                <div className="text-lg font-bold">{count}</div>
                <div className="text-xs text-muted-foreground capitalize">
                  {category}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Memory Types */}
        <GlassCard className="p-6">
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-periwinkle" />
            Memory Types
          </h4>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(stats.memoriesByType).map(([type, count]) => (
              <div key={type} className="text-center p-3 rounded-lg bg-white/5">
                <div className="text-lg font-bold">{count}</div>
                <div className="text-xs text-muted-foreground capitalize">
                  {type.replace('_', ' ')}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {viewOptions.slice(1).map((option) => {
            const Icon = option.icon
            return (
              <GlassButton
                key={option.key}
                variant="outline"
                onClick={() => setCurrentView(option.key as DashboardView)}
                className="h-auto p-4 flex-col gap-2"
                aria-label={`View ${option.label}`}
                aria-current={currentView === option.key ? "page" : undefined}
              >
                <Icon className="h-6 w-6" />
                <span className="text-sm">{option.label}</span>
              </GlassButton>
            )
          })}
        </div>
      </div>
    )
  }

  const renderContent = () => {
    if (!selectedAgentId) return null

    switch (currentView) {
      case 'overview':
        return renderOverview()
      case 'knowledge':
        return <AgentKnowledgeViewer userId={userId} agentId={selectedAgentId} />
      case 'memories':
        return <AgentMemoryTimeline userId={userId} agentId={selectedAgentId} />
      case 'analytics':
        return <AgentLearningAnalytics userId={userId} agentId={selectedAgentId} />
      case 'conversations':
        return (
          <GlassCard className="p-8 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="font-semibold mb-2">Conversations Coming Soon</h4>
            <p className="text-sm text-muted-foreground">
              Conversation history and analysis will be available in a future update.
            </p>
          </GlassCard>
        )
      default:
        return renderOverview()
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with Agent Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <User className="h-6 w-6 text-periwinkle" />
          <div>
            <h2 className="text-xl font-semibold">Agent Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              View your AI agents&apos; knowledge, memories, and learning progress
            </p>
          </div>
        </div>

        {/* Agent Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Agent:</span>
          <div className="relative">
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="appearance-none bg-white/10 border border-white/20 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:border-periwinkle/50"
            >
              {agents.map((agent) => (
                <option key={agent._id} value={agent._id} className="bg-gray-800">
                  {agent.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {viewOptions.map((option) => {
          const Icon = option.icon
          return (
            <GlassButton
              key={option.key}
              variant={currentView === option.key ? "default" : "ghost"}
              onClick={() => setCurrentView(option.key as DashboardView)}
              className="gap-2 whitespace-nowrap"
              aria-label={`View ${option.label}`}
              aria-current={currentView === option.key ? "page" : undefined}
            >
              <Icon className="h-4 w-4" />
              {option.label}
            </GlassButton>
          )
        })}
      </div>

      {/* Main Content */}
      {renderContent()}
    </div>
  )
}