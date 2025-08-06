'use client';

import { useQuery } from 'convex/react';
import {
  Activity,
  Award,
  BarChart3,
  Brain,
  Calendar,
  Clock,
  Lightbulb,
  PieChart,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';

interface AgentLearningAnalyticsProps {
  userId: string;
  agentId: Id<'agents'> | string;
  className?: string;
}

export function AgentLearningAnalytics({
  userId,
  agentId,
  className,
}: AgentLearningAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(30);

  // Fetch analytics data
  const agent = useQuery(api.agents.getAgentById, {
    userId,
    agentId: agentId as Id<'agents'>,
  });
  const learningProgress = useQuery(api.agents.getAgentLearningProgress, {
    userId,
    agentId: agentId as Id<'agents'>,
    days: timeRange,
  });
  const learningEvents = useQuery(api.agents.getAgentLearningEvents, {
    userId,
    agentId: agentId as Id<'agents'>,
    limit: 20,
  });
  const stats = useQuery(api.agents.getAgentKnowledgeStats, {
    userId,
    agentId: agentId as Id<'agents'>,
  });

  const getEventTypeIcon = (eventType: string) => {
    switch (eventType) {
      case 'knowledge_gained':
        return Brain;
      case 'memory_created':
        return Lightbulb;
      case 'skill_improved':
        return Target;
      case 'preference_learned':
        return Award;
      case 'mistake_corrected':
        return Zap;
      default:
        return Activity;
    }
  };

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case 'knowledge_gained':
        return 'text-blue-400 border-blue-500/50';
      case 'memory_created':
        return 'text-green-400 border-green-500/50';
      case 'skill_improved':
        return 'text-purple-400 border-purple-500/50';
      case 'preference_learned':
        return 'text-pink-400 border-pink-500/50';
      case 'mistake_corrected':
        return 'text-orange-400 border-orange-500/50';
      default:
        return 'text-gray-400 border-gray-500/50';
    }
  };

  const getImpactColor = (impact: number) => {
    if (impact >= 8) return 'text-green-400';
    if (impact >= 6) return 'text-yellow-400';
    if (impact >= 4) return 'text-orange-400';
    return 'text-red-400';
  };

  if (!(agent && learningProgress && learningEvents && stats)) {
    return (
      <GlassCard className={cn('p-6', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-1/3 rounded bg-white/10" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div className="h-20 rounded bg-white/10" key={i} />
            ))}
          </div>
          <div className="h-40 rounded bg-white/10" />
        </div>
      </GlassCard>
    );
  }

  // Calculate trends
  const recentProgress = learningProgress.progressData.slice(-7); // Last 7 days
  const totalRecentEvents = recentProgress.reduce(
    (sum, day) => sum + day.events,
    0
  );
  const avgDailyImpact =
    learningProgress.totalImpact / learningProgress.period.days;
  const learningVelocity = totalRecentEvents / 7; // Events per day in last week

  // Get top event types
  const eventTypeCounts = learningEvents.reduce(
    (acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-periwinkle" />
          <div>
            <h3 className="font-semibold text-lg">Learning Analytics</h3>
            <p className="text-muted-foreground text-sm">
              {agent.name} • {timeRange} day analysis
            </p>
          </div>
        </div>

        <div className="flex gap-1">
          {[7, 30, 90].map((days) => (
            <GlassButton
              key={days}
              onClick={() => setTimeRange(days as 7 | 30 | 90)}
              size="sm"
              variant={timeRange === days ? 'default' : 'ghost'}
            >
              {days}d
            </GlassButton>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-400" />
            <span className="text-muted-foreground text-sm">Total Events</span>
          </div>
          <div className="font-bold text-2xl">
            {learningProgress.totalEvents}
          </div>
          <div className="mt-1 text-muted-foreground text-xs">
            {learningProgress.avgDailyEvents.toFixed(1)} per day avg
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-400" />
            <span className="text-muted-foreground text-sm">
              Learning Impact
            </span>
          </div>
          <div className="font-bold text-2xl">
            {learningProgress.totalImpact}
          </div>
          <div className="mt-1 text-muted-foreground text-xs">
            {avgDailyImpact.toFixed(1)} daily impact
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-400" />
            <span className="text-muted-foreground text-sm">
              Learning Velocity
            </span>
          </div>
          <div className="font-bold text-2xl">
            {learningVelocity.toFixed(1)}
          </div>
          <div className="mt-1 text-muted-foreground text-xs">
            events per day (7d avg)
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Award className="h-4 w-4 text-purple-400" />
            <span className="text-muted-foreground text-sm">
              Knowledge Score
            </span>
          </div>
          <div className="font-bold text-2xl text-purple-400">
            {(stats.avgConfidence * 100).toFixed(0)}%
          </div>
          <div className="mt-1 text-muted-foreground text-xs">
            avg confidence level
          </div>
        </GlassCard>
      </div>

      {/* Learning Progress Chart */}
      <GlassCard className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-periwinkle" />
          <h4 className="font-semibold">Daily Learning Progress</h4>
        </div>

        <div className="space-y-3">
          {learningProgress.progressData.slice(-14).map((day, index) => (
            <div className="space-y-2" key={day.date}>
              <div className="flex items-center justify-between text-sm">
                <span>
                  {new Date(day.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {day.events} events
                  </span>
                  <span
                    className={cn('font-medium', getImpactColor(day.avgImpact))}
                  >
                    {day.avgImpact.toFixed(1)} impact
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="flex h-2 gap-1">
                {Object.entries(day.eventTypes).map(([type, count]) => {
                  const percentage = (count / day.events) * 100;
                  const color = getEventTypeColor(type)
                    .split(' ')[0]
                    .replace('text-', 'bg-');

                  return (
                    <div
                      className={cn('h-full rounded-sm', color)}
                      key={type}
                      style={{ width: `${percentage}%` }}
                      title={`${type}: ${count} events`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Event Type Distribution */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <GlassCard className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-periwinkle" />
            <h4 className="font-semibold">Learning Event Types</h4>
          </div>

          <div className="space-y-3">
            {Object.entries(eventTypeCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => {
                const Icon = getEventTypeIcon(type);
                const color = getEventTypeColor(type);
                const percentage = (count / learningEvents.length) * 100;

                return (
                  <div className="space-y-2" key={type}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={cn('h-4 w-4', color.split(' ')[0])} />
                        <span className="text-sm capitalize">
                          {type.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">
                          {count}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="h-2 w-full rounded-full bg-white/10">
                      <div
                        className={cn(
                          'h-2 rounded-full transition-all duration-300',
                          color.split(' ')[0].replace('text-', 'bg-')
                        )}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </GlassCard>

        {/* Recent Learning Events */}
        <GlassCard className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-periwinkle" />
            <h4 className="font-semibold">Recent Learning Events</h4>
          </div>

          <div className="max-h-80 space-y-3 overflow-y-auto">
            {learningEvents.slice(0, 10).map((event) => {
              const Icon = getEventTypeIcon(event.eventType);
              const color = getEventTypeColor(event.eventType);
              const impactColor = getImpactColor(event.impact);

              return (
                <div
                  className="flex gap-3 rounded-lg bg-white/5 p-3"
                  key={event._id}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border',
                      color
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge
                        className={cn('text-xs', color.split(' bg-')[0])}
                        variant="outline"
                      >
                        {event.eventType.replace('_', ' ')}
                      </Badge>
                      <span className={cn('font-medium text-xs', impactColor)}>
                        {event.impact}/10 impact
                      </span>
                    </div>

                    <p className="mb-1 line-clamp-2 text-sm">
                      {event.description}
                    </p>

                    <div className="text-muted-foreground text-xs">
                      {new Date(event.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {learningEvents.length > 10 && (
            <div className="mt-4 text-center">
              <GlassButton size="sm" variant="ghost">
                View All Events
              </GlassButton>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Insights and Recommendations */}
      <GlassCard className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-400" />
          <h4 className="font-semibold">Learning Insights</h4>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <h5 className="font-medium text-muted-foreground text-sm">
              Strengths
            </h5>

            {stats.avgConfidence > 0.8 && (
              <div className="flex items-start gap-2 text-sm">
                <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-green-400" />
                <span>
                  High knowledge confidence (
                  {(stats.avgConfidence * 100).toFixed(1)}%)
                </span>
              </div>
            )}

            {learningVelocity > 1 && (
              <div className="flex items-start gap-2 text-sm">
                <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-green-400" />
                <span>
                  Active learning pace ({learningVelocity.toFixed(1)}{' '}
                  events/day)
                </span>
              </div>
            )}

            {stats.totalKnowledge > 50 && (
              <div className="flex items-start gap-2 text-sm">
                <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-green-400" />
                <span>Rich knowledge base ({stats.totalKnowledge} items)</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h5 className="font-medium text-muted-foreground text-sm">
              Opportunities
            </h5>

            {stats.avgConfidence < 0.6 && (
              <div className="flex items-start gap-2 text-sm">
                <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-orange-400" />
                <span>Knowledge confidence could be improved</span>
              </div>
            )}

            {learningVelocity < 0.5 && (
              <div className="flex items-start gap-2 text-sm">
                <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-orange-400" />
                <span>Learning pace could be increased</span>
              </div>
            )}

            {stats.recentMemories < 5 && (
              <div className="flex items-start gap-2 text-sm">
                <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-orange-400" />
                <span>More recent interactions would help</span>
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
