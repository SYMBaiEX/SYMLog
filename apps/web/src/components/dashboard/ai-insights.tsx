'use client';

import {
  Activity,
  BarChart3,
  Brain,
  Clock,
  DollarSign,
  PieChart,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';
import { LazyImage } from '@/components/ui/lazy-image';
import { cn } from '@/lib/utils';

interface ModelUsageInsight {
  selected_model: string;
  task_type: string;
  complexity: string;
  total_tokens: number;
  avg_latency: number;
  estimated_cost: number;
  usage_count: number;
}

interface ModelRecommendation {
  model: string;
  reason: string;
  savings?: number;
}

interface AIInsightsProps {
  userId: string;
  className?: string;
}

export function AIInsights({ userId, className }: AIInsightsProps) {
  const [insights, setInsights] = useState<ModelUsageInsight[]>([]);
  const [recommendations, setRecommendations] = useState<ModelRecommendation[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');

  useEffect(() => {
    fetchInsights();
  }, [userId, timeRange]);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/ai/insights?userId=${userId}&days=${timeRange.replace('d', '')}`
      );
      if (response.ok) {
        const data = await response.json();
        setInsights(data.insights || []);
        setRecommendations(data.recommendations || []);
      }
    } catch (error) {
      console.error('Failed to fetch AI insights:', error);
    }
    setLoading(false);
  };

  const totalTokens = insights.reduce((sum, i) => sum + i.total_tokens, 0);
  const totalCost = insights.reduce(
    (sum, i) => sum + (i.estimated_cost || 0),
    0
  );
  const totalRequests = insights.reduce((sum, i) => sum + i.usage_count, 0);
  const avgLatency =
    insights.length > 0
      ? insights.reduce((sum, i) => sum + i.avg_latency, 0) / insights.length
      : 0;

  const getModelTier = (model: string) => {
    if (model.includes('nano'))
      return { tier: 'nano', color: 'text-green-400' };
    if (model.includes('o3') || model.includes('o4'))
      return { tier: 'reasoning', color: 'text-purple-400' };
    if (model.includes('coding'))
      return { tier: 'coding', color: 'text-blue-400' };
    if (model.includes('embedding'))
      return { tier: 'embedding', color: 'text-cyan-400' };
    if (model.includes('mini'))
      return { tier: 'balanced', color: 'text-yellow-400' };
    return { tier: 'standard', color: 'text-gray-400' };
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'high':
        return 'text-red-400 border-red-500/50';
      case 'medium':
        return 'text-yellow-400 border-yellow-500/50';
      case 'low':
        return 'text-green-400 border-green-500/50';
      default:
        return 'text-gray-400 border-gray-500/50';
    }
  };

  if (loading) {
    return (
      <GlassCard className={cn('p-6', className)}>
        <div className="mb-6 flex items-center gap-3">
          <Brain className="h-6 w-6 text-periwinkle" />
          <h3 className="font-semibold text-lg">AI Model Insights</h3>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-4 rounded bg-white/10" />
          <div className="h-4 w-3/4 rounded bg-white/10" />
          <div className="h-4 w-1/2 rounded bg-white/10" />
        </div>
      </GlassCard>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with time range selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-periwinkle" />
          <h3 className="font-semibold text-lg">AI Model Insights</h3>
        </div>

        <div className="flex gap-1">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <GlassButton
              key={range}
              onClick={() => setTimeRange(range)}
              size="sm"
              variant={timeRange === range ? 'default' : 'ghost'}
            >
              {range}
            </GlassButton>
          ))}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-400" />
            <span className="text-muted-foreground text-sm">
              Total Requests
            </span>
          </div>
          <div className="font-bold text-2xl">
            {totalRequests.toLocaleString()}
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-400" />
            <span className="text-muted-foreground text-sm">Total Tokens</span>
          </div>
          <div className="font-bold text-2xl">
            {totalTokens.toLocaleString()}
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-400" />
            <span className="text-muted-foreground text-sm">Avg Latency</span>
          </div>
          <div className="font-bold text-2xl">{Math.round(avgLatency)}ms</div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-400" />
            <span className="text-muted-foreground text-sm">Est. Cost</span>
          </div>
          <div className="font-bold text-2xl">${totalCost.toFixed(3)}</div>
        </GlassCard>
      </div>

      {/* Model usage breakdown */}
      <GlassCard className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-periwinkle" />
          <h4 className="font-semibold">Model Usage Breakdown</h4>
        </div>

        <div className="space-y-3">
          {insights.slice(0, 5).map((insight, index) => {
            const modelInfo = getModelTier(insight.selected_model);
            const usagePercentage = (insight.usage_count / totalRequests) * 100;

            return (
              <div
                className="space-y-2"
                key={`${insight.selected_model}-${insight.task_type}-${index}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-sm">
                      {insight.selected_model
                        .replace(/^gpt-/, 'GPT-')
                        .replace(/^o(\d)/, 'o$1')}
                    </div>
                    <Badge
                      className={cn(
                        'text-xs',
                        modelInfo.color
                          .replace('text-', 'border-')
                          .replace('400', '500/50')
                      )}
                      variant="outline"
                    >
                      {modelInfo.tier}
                    </Badge>
                    <Badge
                      className={cn(
                        'text-xs',
                        getComplexityColor(insight.complexity)
                      )}
                      variant="outline"
                    >
                      {insight.task_type}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {insight.usage_count} uses ({usagePercentage.toFixed(1)}%)
                  </div>
                </div>

                <div className="flex items-center gap-4 text-muted-foreground text-xs">
                  <span>{insight.total_tokens.toLocaleString()} tokens</span>
                  <span>{Math.round(insight.avg_latency)}ms avg</span>
                  <span>${(insight.estimated_cost || 0).toFixed(4)} cost</span>
                </div>

                <div className="h-2 w-full rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-periwinkle/60 to-periwinkle transition-all duration-300"
                    style={{ width: `${usagePercentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <GlassCard className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-green-400" />
            <h4 className="font-semibold">Optimization Recommendations</h4>
          </div>

          <div className="space-y-3">
            {recommendations.map((rec, index) => (
              <div
                className="flex items-start gap-3 rounded-lg bg-white/5 p-3"
                key={index}
              >
                <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-400" />
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium text-sm">{rec.model}</span>
                    {rec.savings && (
                      <Badge
                        className="border-green-500/50 text-green-400 text-xs"
                        variant="outline"
                      >
                        {Math.round(rec.savings * 100)}% savings
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm">{rec.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* No data state */}
      {insights.length === 0 && (
        <GlassCard className="p-8 text-center">
          <Brain className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h4 className="mb-2 font-semibold">No AI Usage Data</h4>
          <p className="text-muted-foreground text-sm">
            Start chatting with the AI assistant to see insights and
            recommendations here.
          </p>
        </GlassCard>
      )}
    </div>
  );
}
