"use client"

import { useState, useEffect, useMemo } from 'react'
import { modelOrchestrator, ModelRole } from '@/lib/ai/model-orchestration'
import { GlassButton } from '@/components/ui/glass-button'
import { Badge } from '@/components/ui/badge'
import { 
  Brain, 
  Zap, 
  Code, 
  Search, 
  Eye, 
  Sparkles,
  TrendingUp,
  Clock,
  DollarSign
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SmartModelSelectorProps {
  message: string
  attachments?: any[]
  currentModel?: string
  onModelSelect?: (model: string) => void
  systemPromptType?: string
  className?: string
}

export function SmartModelSelector({
  message,
  attachments = [],
  currentModel,
  onModelSelect,
  systemPromptType = 'default',
  className
}: SmartModelSelectorProps) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Analyze message context and get model suggestions
  const analysis = useMemo(() => {
    if (!message.trim()) return null

    const messageLength = message.length
    const conversationLength = 1 // Single message for now
    
    // Detect task type from message content
    let taskType: ModelRole = 'conversation'
    let complexity: 'low' | 'medium' | 'high' = 'medium'
    let requiresVision = false
    let requiresFunctions = false
    let budget: 'minimal' | 'balanced' | 'premium' = 'balanced'
    
    // Keywords for different task types
    const codeKeywords = /\\b(code|script|function|class|component|algorithm|debug|refactor|optimize|programming|typescript|javascript|python|react|vue|angular|api|database|sql)\\b/i
    const reasoningKeywords = /\\b(analyze|explain|reasoning|logic|problem|solve|think|complex|mathematical|proof|theory|concept|understand|compare|evaluate)\\b/i
    const embeddingKeywords = /\\b(search|find|similar|match|semantic|vector|embedding|recommendation|clustering)\\b/i
    const visionKeywords = /\\b(image|picture|visual|chart|diagram|screenshot|photo|graphic|design|ui|ux)\\b/i
    const creativeKeywords = /\\b(creative|story|poem|article|blog|content|writing|design|brainstorm|idea|innovative)\\b/i
    
    // Determine task type
    if (systemPromptType === 'technical' || codeKeywords.test(message)) {
      taskType = 'coding'
      requiresFunctions = true
    } else if (reasoningKeywords.test(message)) {
      taskType = 'reasoning'
      complexity = 'high'
      budget = 'premium'
    } else if (embeddingKeywords.test(message)) {
      taskType = 'embedding'
      complexity = 'low'
    } else if (creativeKeywords.test(message)) {
      taskType = 'conversation'
      budget = 'minimal'
    }
    
    // Check for vision requirements
    if (visionKeywords.test(message) || attachments.some(a => a.type === 'image')) {
      requiresVision = true
    }
    
    // Determine complexity
    if (messageLength > 1000) {
      complexity = 'high'
    } else if (messageLength > 300) {
      complexity = 'medium'  
    } else {
      complexity = 'low'
      if (taskType === 'conversation') budget = 'minimal'
    }

    return {
      type: taskType,
      complexity,
      requiresVision,
      requiresFunctions,
      budget,
      maxTokens: messageLength > 500 ? 4096 : 2048,
      confidence: calculateConfidence(message, taskType)
    }
  }, [message, attachments, systemPromptType])

  useEffect(() => {
    if (!analysis) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    // Get optimal model suggestion
    const optimalModel = modelOrchestrator.selectOptimalModel(analysis)
    
    // Get alternative models for comparison
    const alternatives = [
      // Always include nano for cost optimization
      modelOrchestrator.selectOptimalModel({ ...analysis, budget: 'minimal' }),
      // Include premium for best quality
      modelOrchestrator.selectOptimalModel({ ...analysis, budget: 'premium' }),
      // Include balanced option
      modelOrchestrator.selectOptimalModel({ ...analysis, budget: 'balanced' })
    ].filter((model, index, arr) => arr.indexOf(model) === index) // Remove duplicates

    setSuggestions([optimalModel, ...alternatives.filter(m => m !== optimalModel)].slice(0, 3))
    setShowSuggestions(currentModel !== optimalModel || alternatives.length > 1)
  }, [analysis, currentModel])

  const getModelIcon = (model: string) => {
    if (model.includes('o3') || model.includes('o4')) return Brain
    if (model.includes('nano')) return Zap
    if (model.includes('coding')) return Code
    if (model.includes('embedding')) return Search
    if (model.includes('vision') || model.includes('4o')) return Eye
    return Sparkles
  }

  const getModelTier = (model: string) => {
    if (model.includes('nano')) return { tier: 'nano', color: 'text-green-400 border-green-500/50' }
    if (model.includes('o3') || model.includes('o4')) return { tier: 'reasoning', color: 'text-purple-400 border-purple-500/50' }
    if (model.includes('coding')) return { tier: 'coding', color: 'text-blue-400 border-blue-500/50' }
    if (model.includes('embedding')) return { tier: 'embedding', color: 'text-cyan-400 border-cyan-500/50' }
    if (model.includes('mini')) return { tier: 'balanced', color: 'text-yellow-400 border-yellow-500/50' }
    return { tier: 'standard', color: 'text-gray-400 border-gray-500/50' }
  }

  const getModelStats = (model: string) => {
    const cost = modelOrchestrator.estimateCost(model, 1000, 500)
    const performance = modelOrchestrator.getModelPerformance(model)
    
    return {
      cost: cost.total,
      latency: performance?.averageLatency || 0,
      success: performance?.successRate || 0
    }
  }

  if (!analysis || !showSuggestions || suggestions.length === 0) {
    return null
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <TrendingUp className="h-4 w-4" />
        <span>Smart model suggestions for this task:</span>
        <Badge variant="outline" className="text-xs">
          {analysis.type} • {analysis.complexity}
        </Badge>
      </div>

      <div className="grid gap-2">
        {suggestions.map((model, index) => {
          const Icon = getModelIcon(model)
          const tierInfo = getModelTier(model)
          const stats = getModelStats(model)
          const isOptimal = index === 0
          const isCurrent = model === currentModel

          return (
            <GlassButton
              key={model}
              variant={isCurrent ? "default" : "ghost"}
              onClick={() => onModelSelect?.(model)}
              className={cn(
                "justify-start gap-3 h-auto p-3",
                isOptimal && !isCurrent && "ring-1 ring-periwinkle/50",
                isCurrent && "ring-2 ring-periwinkle"
              )}
            >
              <Icon className="h-4 w-4 text-periwinkle flex-shrink-0" />
              
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">
                    {model.replace(/^gpt-/, 'GPT-').replace(/^o(\\d)/, 'o$1')}
                  </span>
                  <Badge variant="outline" className={cn("text-xs", tierInfo.color)}>
                    {tierInfo.tier}
                  </Badge>
                  {isOptimal && (
                    <Badge variant="secondary" className="text-xs bg-periwinkle/20 text-periwinkle">
                      Recommended
                    </Badge>
                  )}
                  {isCurrent && (
                    <Badge variant="secondary" className="text-xs">
                      Current
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    <span>${stats.cost.toFixed(4)}</span>
                  </div>
                  {stats.latency > 0 && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{Math.round(stats.latency)}ms</span>
                    </div>
                  )}
                  {stats.success > 0 && (
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      <span>{Math.round(stats.success * 100)}%</span>
                    </div>
                  )}
                </div>
              </div>
              
              {isOptimal && (
                <div className="text-xs text-periwinkle font-medium">
                  Best match
                </div>
              )}
            </GlassButton>
          )
        })}
      </div>

      {analysis.confidence < 0.7 && (
        <div className="text-xs text-muted-foreground">
          <span className="text-yellow-400">⚠</span> Task type detection confidence: {Math.round(analysis.confidence * 100)}%
        </div>
      )}
    </div>
  )
}

function calculateConfidence(message: string, taskType: ModelRole): number {
  const strongIndicators = {
    coding: /\\b(function|class|component|algorithm|typescript|javascript|python|react|api|database)\\b/gi,
    reasoning: /\\b(analyze|explain|solve|complex|mathematical|theory|logic|proof)\\b/gi,
    embedding: /\\b(search|find|similar|semantic|vector|recommendation)\\b/gi,
    conversation: /\\b(help|tell|what|how|can|please|thank)\\b/gi
  }

  const matches = (strongIndicators[taskType]?.exec(message) || []).length
  const messageLength = message.length

  // Base confidence on keyword matches and message complexity
  let confidence = Math.min(0.5 + (matches * 0.15), 0.95)
  
  // Adjust for message length (longer messages = higher confidence)
  if (messageLength > 100) confidence = Math.min(confidence + 0.1, 0.95)
  if (messageLength > 300) confidence = Math.min(confidence + 0.1, 0.95)
  
  return confidence
}