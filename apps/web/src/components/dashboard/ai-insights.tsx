"use client"

import { useState, useEffect } from 'react'
import { GlassCard } from '@/components/ui/glass-card'
import { GlassButton } from '@/components/ui/glass-button'
import { Badge } from '@/components/ui/badge'
import { LazyImage } from '@/components/ui/lazy-image'
import { 
  Brain, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  Zap,
  Target,
  BarChart3,
  PieChart,
  Activity,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModelUsageInsight {
  selected_model: string
  task_type: string
  complexity: string
  total_tokens: number
  avg_latency: number
  estimated_cost: number
  usage_count: number
}

interface ModelRecommendation {
  model: string
  reason: string
  savings?: number
}

interface AIInsightsProps {
  userId: string
  className?: string
}

export function AIInsights({ userId, className }: AIInsightsProps) {
  const [insights, setInsights] = useState<ModelUsageInsight[]>([])
  const [recommendations, setRecommendations] = useState<ModelRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d')

  useEffect(() => {
    fetchInsights()
  }, [userId, timeRange])

  const fetchInsights = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/ai/insights?userId=${userId}&days=${timeRange.replace('d', '')}`)
      if (response.ok) {
        const data = await response.json()
        setInsights(data.insights || [])
        setRecommendations(data.recommendations || [])
      }
    } catch (error) {
      console.error('Failed to fetch AI insights:', error)
    }
    setLoading(false)
  }

  const totalTokens = insights.reduce((sum, i) => sum + i.total_tokens, 0)
  const totalCost = insights.reduce((sum, i) => sum + (i.estimated_cost || 0), 0)
  const totalRequests = insights.reduce((sum, i) => sum + i.usage_count, 0)
  const avgLatency = insights.length > 0 
    ? insights.reduce((sum, i) => sum + i.avg_latency, 0) / insights.length 
    : 0

  const getModelTier = (model: string) => {
    if (model.includes('nano')) return { tier: 'nano', color: 'text-green-400' }
    if (model.includes('o3') || model.includes('o4')) return { tier: 'reasoning', color: 'text-purple-400' }
    if (model.includes('coding')) return { tier: 'coding', color: 'text-blue-400' }
    if (model.includes('embedding')) return { tier: 'embedding', color: 'text-cyan-400' }
    if (model.includes('mini')) return { tier: 'balanced', color: 'text-yellow-400' }
    return { tier: 'standard', color: 'text-gray-400' }
  }

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'high': return 'text-red-400 border-red-500/50'
      case 'medium': return 'text-yellow-400 border-yellow-500/50'
      case 'low': return 'text-green-400 border-green-500/50'
      default: return 'text-gray-400 border-gray-500/50'
    }
  }

  if (loading) {
    return (
      <GlassCard className={cn("p-6", className)}>
        <div className="flex items-center gap-3 mb-6">
          <Brain className="h-6 w-6 text-periwinkle" />
          <h3 className="text-lg font-semibold">AI Model Insights</h3>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-white/10 rounded"></div>
          <div className="h-4 bg-white/10 rounded w-3/4"></div>
          <div className="h-4 bg-white/10 rounded w-1/2"></div>
        </div>
      </GlassCard>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with time range selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-periwinkle" />
          <h3 className="text-lg font-semibold">AI Model Insights</h3>
        </div>
        
        <div className="flex gap-1">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <GlassButton
              key={range}
              variant={timeRange === range ? "default" : "ghost"}
              size="sm"
              onClick={() => setTimeRange(range)}
            >
              {range}
            </GlassButton>
          ))}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-muted-foreground">Total Requests</span>
          </div>
          <div className="text-2xl font-bold">{totalRequests.toLocaleString()}</div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-yellow-400" />
            <span className="text-sm text-muted-foreground">Total Tokens</span>
          </div>
          <div className="text-2xl font-bold">{totalTokens.toLocaleString()}</div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-orange-400" />
            <span className="text-sm text-muted-foreground">Avg Latency</span>
          </div>
          <div className="text-2xl font-bold">{Math.round(avgLatency)}ms</div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-green-400" />
            <span className="text-sm text-muted-foreground">Est. Cost</span>
          </div>
          <div className="text-2xl font-bold">${totalCost.toFixed(3)}</div>
        </GlassCard>
      </div>

      {/* Model usage breakdown */}
      <GlassCard className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-periwinkle" />
          <h4 className="font-semibold">Model Usage Breakdown</h4>
        </div>
        
        <div className="space-y-3">
          {insights.slice(0, 5).map((insight, index) => {
            const modelInfo = getModelTier(insight.selected_model)
            const usagePercentage = (insight.usage_count / totalRequests) * 100
            
            return (
              <div key={`${insight.selected_model}-${insight.task_type}-${index}`} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-sm">
                      {insight.selected_model.replace(/^gpt-/, 'GPT-').replace(/^o(\d)/, 'o$1')}
                    </div>
                    <Badge variant="outline" className={cn("text-xs", modelInfo.color.replace('text-', 'border-').replace('400', '500/50'))}>
                      {modelInfo.tier}
                    </Badge>
                    <Badge variant="outline" className={cn("text-xs", getComplexityColor(insight.complexity))}>
                      {insight.task_type}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {insight.usage_count} uses ({usagePercentage.toFixed(1)}%)
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{insight.total_tokens.toLocaleString()} tokens</span>
                  <span>{Math.round(insight.avg_latency)}ms avg</span>
                  <span>${(insight.estimated_cost || 0).toFixed(4)} cost</span>
                </div>
                
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-periwinkle/60 to-periwinkle rounded-full h-2 transition-all duration-300"
                    style={{ width: `${usagePercentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </GlassCard>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-green-400" />
            <h4 className="font-semibold">Optimization Recommendations</h4>
          </div>
          
          <div className="space-y-3">
            {recommendations.map((rec, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                <Sparkles className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{rec.model}</span>
                    {rec.savings && (
                      <Badge variant="outline" className="text-xs text-green-400 border-green-500/50">
                        {Math.round(rec.savings * 100)}% savings
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{rec.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* No data state */}
      {insights.length === 0 && (
        <GlassCard className="p-8 text-center">
          <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h4 className="font-semibold mb-2">No AI Usage Data</h4>
          <p className="text-sm text-muted-foreground">
            Start chatting with the AI assistant to see insights and recommendations here.
          </p>
        </GlassCard>
      )}
    </div>
  )
}