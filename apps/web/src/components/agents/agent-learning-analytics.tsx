"use client"

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { GlassCard } from '@/components/ui/glass-card'
import { GlassButton } from '@/components/ui/glass-button'
import { Badge } from '@/components/ui/badge'
import { 
  TrendingUp,
  Brain,
  Target,
  Zap,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Award,
  Clock,
  Lightbulb
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgentLearningAnalyticsProps {
  userId: string
  agentId: string
  className?: string
}

export function AgentLearningAnalytics({ userId, agentId, className }: AgentLearningAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(30)

  // Fetch analytics data
  const agent = useQuery(api.agents.getAgentById, { userId, agentId })
  const learningProgress = useQuery(api.agents.getAgentLearningProgress, { 
    userId, 
    agentId, 
    days: timeRange 
  })
  const learningEvents = useQuery(api.agents.getAgentLearningEvents, { 
    userId, 
    agentId, 
    limit: 20 
  })
  const stats = useQuery(api.agents.getAgentKnowledgeStats, { userId, agentId })

  const getEventTypeIcon = (eventType: string) => {
    switch (eventType) {
      case 'knowledge_gained': return Brain
      case 'memory_created': return Lightbulb
      case 'skill_improved': return Target
      case 'preference_learned': return Award
      case 'mistake_corrected': return Zap
      default: return Activity
    }
  }

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case 'knowledge_gained': return 'text-blue-400 border-blue-500/50'
      case 'memory_created': return 'text-green-400 border-green-500/50'
      case 'skill_improved': return 'text-purple-400 border-purple-500/50'
      case 'preference_learned': return 'text-pink-400 border-pink-500/50'
      case 'mistake_corrected': return 'text-orange-400 border-orange-500/50'
      default: return 'text-gray-400 border-gray-500/50'
    }
  }

  const getImpactColor = (impact: number) => {
    if (impact >= 8) return 'text-green-400'
    if (impact >= 6) return 'text-yellow-400'
    if (impact >= 4) return 'text-orange-400'
    return 'text-red-400'
  }

  if (!agent || !learningProgress || !learningEvents || !stats) {
    return (
      <GlassCard className={cn("p-6", className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/10 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-white/10 rounded"></div>
            ))}
          </div>
          <div className="h-40 bg-white/10 rounded"></div>
        </div>
      </GlassCard>
    )
  }

  // Calculate trends
  const recentProgress = learningProgress.progressData.slice(-7) // Last 7 days
  const totalRecentEvents = recentProgress.reduce((sum, day) => sum + day.events, 0)
  const avgDailyImpact = learningProgress.totalImpact / learningProgress.period.days
  const learningVelocity = totalRecentEvents / 7 // Events per day in last week

  // Get top event types
  const eventTypeCounts = learningEvents.reduce((acc, event) => {
    acc[event.eventType] = (acc[event.eventType] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-periwinkle" />
          <div>
            <h3 className="text-lg font-semibold">Learning Analytics</h3>
            <p className="text-sm text-muted-foreground">
              {agent.name} • {timeRange} day analysis
            </p>
          </div>
        </div>
        
        <div className="flex gap-1">
          {[7, 30, 90].map((days) => (
            <GlassButton
              key={days}
              variant={timeRange === days ? "default" : "ghost"}
              size="sm"
              onClick={() => setTimeRange(days)}
            >
              {days}d
            </GlassButton>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-muted-foreground">Total Events</span>
          </div>
          <div className="text-2xl font-bold">{learningProgress.totalEvents}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {learningProgress.avgDailyEvents.toFixed(1)} per day avg
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-green-400" />
            <span className="text-sm text-muted-foreground">Learning Impact</span>
          </div>
          <div className="text-2xl font-bold">{learningProgress.totalImpact}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {avgDailyImpact.toFixed(1)} daily impact
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-yellow-400" />
            <span className="text-sm text-muted-foreground">Learning Velocity</span>
          </div>
          <div className="text-2xl font-bold">{learningVelocity.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            events per day (7d avg)
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award className="h-4 w-4 text-purple-400" />
            <span className="text-sm text-muted-foreground">Knowledge Score</span>
          </div>
          <div className="text-2xl font-bold text-purple-400">
            {(stats.avgConfidence * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            avg confidence level
          </div>
        </GlassCard>
      </div>

      {/* Learning Progress Chart */}
      <GlassCard className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-periwinkle" />
          <h4 className="font-semibold">Daily Learning Progress</h4>
        </div>
        
        <div className="space-y-3">
          {learningProgress.progressData.slice(-14).map((day, index) => (
            <div key={day.date} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{new Date(day.date).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                })}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{day.events} events</span>
                  <span className={cn("font-medium", getImpactColor(day.avgImpact))}>
                    {day.avgImpact.toFixed(1)} impact
                  </span>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="flex gap-1 h-2">
                {Object.entries(day.eventTypes).map(([type, count]) => {
                  const percentage = (count / day.events) * 100
                  const color = getEventTypeColor(type).split(' ')[0].replace('text-', 'bg-')
                  
                  return (
                    <div
                      key={type}
                      className={cn("h-full rounded-sm", color)}
                      style={{ width: `${percentage}%` }}
                      title={`${type}: ${count} events`}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Event Type Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="h-5 w-5 text-periwinkle" />
            <h4 className="font-semibold">Learning Event Types</h4>
          </div>
          
          <div className="space-y-3">
            {Object.entries(eventTypeCounts)
              .sort(([,a], [,b]) => b - a)
              .map(([type, count]) => {
                const Icon = getEventTypeIcon(type)
                const color = getEventTypeColor(type)
                const percentage = (count / learningEvents.length) * 100
                
                return (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-4 w-4", color.split(' ')[0])} />
                        <span className="text-sm capitalize">
                          {type.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{count}</span>
                        <span className="text-xs text-muted-foreground">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div 
                        className={cn("h-2 rounded-full transition-all duration-300", 
                          color.split(' ')[0].replace('text-', 'bg-')
                        )}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </GlassCard>

        {/* Recent Learning Events */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-periwinkle" />
            <h4 className="font-semibold">Recent Learning Events</h4>
          </div>
          
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {learningEvents.slice(0, 10).map((event) => {
              const Icon = getEventTypeIcon(event.eventType)
              const color = getEventTypeColor(event.eventType)
              const impactColor = getImpactColor(event.impact)
              
              return (
                <div key={event._id} className="flex gap-3 p-3 rounded-lg bg-white/5">
                  <div className={cn(
                    "w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0",
                    color
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={cn("text-xs", color.split(' bg-')[0])}>
                        {event.eventType.replace('_', ' ')}
                      </Badge>
                      <span className={cn("text-xs font-medium", impactColor)}>
                        {event.impact}/10 impact
                      </span>
                    </div>
                    
                    <p className="text-sm line-clamp-2 mb-1">
                      {event.description}
                    </p>
                    
                    <div className="text-xs text-muted-foreground">
                      {new Date(event.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          
          {learningEvents.length > 10 && (
            <div className="mt-4 text-center">
              <GlassButton variant="ghost" size="sm">
                View All Events
              </GlassButton>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Insights and Recommendations */}
      <GlassCard className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-5 w-5 text-yellow-400" />
          <h4 className="font-semibold">Learning Insights</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h5 className="text-sm font-medium text-muted-foreground">Strengths</h5>
            
            {stats.avgConfidence > 0.8 && (
              <div className="flex items-start gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-green-400 mt-2 flex-shrink-0"></div>
                <span>High knowledge confidence ({(stats.avgConfidence * 100).toFixed(1)}%)</span>
              </div>
            )}
            
            {learningVelocity > 1 && (
              <div className="flex items-start gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-green-400 mt-2 flex-shrink-0"></div>
                <span>Active learning pace ({learningVelocity.toFixed(1)} events/day)</span>
              </div>
            )}
            
            {stats.totalKnowledge > 50 && (
              <div className="flex items-start gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-green-400 mt-2 flex-shrink-0"></div>
                <span>Rich knowledge base ({stats.totalKnowledge} items)</span>
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            <h5 className="text-sm font-medium text-muted-foreground">Opportunities</h5>
            
            {stats.avgConfidence < 0.6 && (
              <div className="flex items-start gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-orange-400 mt-2 flex-shrink-0"></div>
                <span>Knowledge confidence could be improved</span>
              </div>
            )}
            
            {learningVelocity < 0.5 && (
              <div className="flex items-start gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-orange-400 mt-2 flex-shrink-0"></div>
                <span>Learning pace could be increased</span>
              </div>
            )}
            
            {stats.recentMemories < 5 && (
              <div className="flex items-start gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-orange-400 mt-2 flex-shrink-0"></div>
                <span>More recent interactions would help</span>
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  )
}