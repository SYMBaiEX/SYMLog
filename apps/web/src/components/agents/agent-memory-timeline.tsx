'use client';

import { useQuery } from 'convex/react';
import {
  Brain,
  Calendar,
  Clock,
  Filter,
  Heart,
  Lightbulb,
  MessageSquare,
  Settings,
  Star,
  Tag,
  TrendingUp,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';

interface AgentMemoryTimelineProps {
  userId: string;
  agentId: string;
  className?: string;
}

export function AgentMemoryTimeline({
  userId,
  agentId,
  className,
}: AgentMemoryTimelineProps) {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'all'>(
    'week'
  );

  // Calculate time range
  const getTimeRange = () => {
    const now = Date.now();
    switch (timeRange) {
      case 'day':
        return { startTime: now - 24 * 60 * 60 * 1000, endTime: now };
      case 'week':
        return { startTime: now - 7 * 24 * 60 * 60 * 1000, endTime: now };
      case 'month':
        return { startTime: now - 30 * 24 * 60 * 60 * 1000, endTime: now };
      default:
        return {};
    }
  };

  // Fetch memory data
  const agent = useQuery(api.agents.getAgentById, {
    userId,
    agentId: agentId as Id<'agents'>,
  });
  const memories = useQuery(api.agents.getAgentMemoryTimeline, {
    userId,
    agentId: agentId as Id<'agents'>,
    ...getTimeRange(),
  });
  const stats = useQuery(api.agents.getAgentKnowledgeStats, {
    userId,
    agentId: agentId as Id<'agents'>,
  });

  // Filter memories by type
  const filteredMemories = useMemo(() => {
    if (!memories) return [];

    return memories.filter(
      (memory) => selectedType === 'all' || memory.type === selectedType
    );
  }, [memories, selectedType]);

  // Group memories by day for timeline display
  const groupedMemories = useMemo(() => {
    if (!filteredMemories) return {};

    return filteredMemories.reduce(
      (acc, memory) => {
        const date = new Date(memory.timestamp).toDateString();
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(memory);
        return acc;
      },
      {} as Record<string, typeof filteredMemories>
    );
  }, [filteredMemories]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'conversation':
        return MessageSquare;
      case 'learning':
        return Brain;
      case 'reflection':
        return Lightbulb;
      case 'context':
        return Settings;
      case 'preference':
        return Heart;
      default:
        return MessageSquare;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'conversation':
        return 'text-blue-400 border-blue-500/50 bg-blue-500/10';
      case 'learning':
        return 'text-green-400 border-green-500/50 bg-green-500/10';
      case 'reflection':
        return 'text-purple-400 border-purple-500/50 bg-purple-500/10';
      case 'context':
        return 'text-orange-400 border-orange-500/50 bg-orange-500/10';
      case 'preference':
        return 'text-pink-400 border-pink-500/50 bg-pink-500/10';
      default:
        return 'text-gray-400 border-gray-500/50 bg-gray-500/10';
    }
  };

  const getImportanceIcon = (importance?: number) => {
    if (!importance) return null;
    if (importance >= 8)
      return <Star className="h-3 w-3 fill-current text-yellow-400" />;
    if (importance >= 6) return <Star className="h-3 w-3 text-yellow-400" />;
    return null;
  };

  if (!(agent && memories && stats)) {
    return (
      <GlassCard className={cn('p-6', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-1/3 rounded bg-white/10" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div className="flex gap-3" key={i}>
                <div className="h-8 w-8 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-white/10" />
                  <div className="h-3 w-1/2 rounded bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    );
  }

  const memoryTypes = [
    { key: 'all', label: 'All Memories', count: stats.totalMemories },
    ...Object.entries(stats.memoriesByType).map(([key, count]) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      count,
    })),
  ];

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 text-periwinkle" />
          <div>
            <h3 className="font-semibold text-lg">Memory Timeline</h3>
            <p className="text-muted-foreground text-sm">
              {agent.name} • {filteredMemories.length} memories in{' '}
              {timeRange === 'all' ? 'total' : `last ${timeRange}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="gap-1" variant="secondary">
            <TrendingUp className="h-3 w-3" />
            {stats.recentMemories} this week
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <GlassCard className="p-4">
        <div className="space-y-4">
          {/* Time range filter */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground text-sm">Time range:</span>
            <div className="flex gap-1">
              {[
                { key: 'day', label: 'Today' },
                { key: 'week', label: 'This Week' },
                { key: 'month', label: 'This Month' },
                { key: 'all', label: 'All Time' },
              ].map((option) => (
                <GlassButton
                  key={option.key}
                  onClick={() => setTimeRange(option.key as any)}
                  size="sm"
                  variant={timeRange === option.key ? 'default' : 'ghost'}
                >
                  {option.label}
                </GlassButton>
              ))}
            </div>
          </div>

          {/* Memory type filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground text-sm">Memory type:</span>
            <div className="flex flex-wrap gap-1">
              {memoryTypes.map((type) => {
                const Icon = getTypeIcon(type.key);
                return (
                  <GlassButton
                    className="gap-2"
                    key={type.key}
                    onClick={() => setSelectedType(type.key)}
                    size="sm"
                    variant={selectedType === type.key ? 'default' : 'ghost'}
                  >
                    <Icon className="h-3 w-3" />
                    {type.label}
                    <Badge className="text-xs" variant="secondary">
                      {type.count || 0}
                    </Badge>
                  </GlassButton>
                );
              })}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Memory Timeline */}
      <div className="space-y-6">
        {Object.keys(groupedMemories).length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Clock className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h4 className="mb-2 font-semibold">No Memories Found</h4>
            <p className="text-muted-foreground text-sm">
              No memories found for the selected time range and filters.
            </p>
          </GlassCard>
        ) : (
          Object.entries(groupedMemories)
            .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
            .map(([date, dayMemories]) => (
              <div className="space-y-3" key={date}>
                {/* Date header */}
                <div className="flex items-center gap-3">
                  <h4 className="font-medium text-sm">
                    {new Date(date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </h4>
                  <div className="h-px flex-1 bg-white/10" />
                  <Badge className="text-xs" variant="secondary">
                    {dayMemories.length} memories
                  </Badge>
                </div>

                {/* Memory items for this day */}
                <div className="ml-4 space-y-2">
                  {dayMemories
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .map((memory) => {
                      const Icon = getTypeIcon(memory.type);
                      const typeColor = getTypeColor(memory.type);
                      const importance = memory.metadata?.importance;

                      return (
                        <div className="flex gap-3" key={memory._id}>
                          {/* Timeline indicator */}
                          <div className="flex flex-col items-center">
                            <div
                              className={cn(
                                'flex h-8 w-8 items-center justify-center rounded-full border',
                                typeColor
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="mt-2 h-4 w-px bg-white/10" />
                          </div>

                          {/* Memory content */}
                          <GlassCard className="flex-1 p-3 transition-colors hover:bg-white/5">
                            <div className="mb-2 flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <Badge
                                  className={cn(
                                    'text-xs',
                                    typeColor.split(' bg-')[0]
                                  )}
                                  variant="outline"
                                >
                                  {memory.type}
                                </Badge>
                                {getImportanceIcon(importance)}
                                {importance && (
                                  <span className="text-muted-foreground text-xs">
                                    Importance: {importance}/10
                                  </span>
                                )}
                              </div>

                              <div className="text-muted-foreground text-xs">
                                {new Date(memory.timestamp).toLocaleTimeString(
                                  'en-US',
                                  {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }
                                )}
                              </div>
                            </div>

                            <p className="mb-2 line-clamp-3 text-sm">
                              {memory.content}
                            </p>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {memory.metadata?.tags && (
                                  <div className="flex gap-1">
                                    {memory.metadata.tags
                                      .slice(0, 2)
                                      .map((tag, index) => (
                                        <Badge
                                          className="gap-1 text-xs"
                                          key={index}
                                          variant="secondary"
                                        >
                                          <Tag className="h-2 w-2" />
                                          {tag}
                                        </Badge>
                                      ))}
                                    {memory.metadata.tags.length > 2 && (
                                      <Badge
                                        className="text-xs"
                                        variant="secondary"
                                      >
                                        +{memory.metadata.tags.length - 2}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>

                              {memory.metadata?.source && (
                                <div className="text-muted-foreground text-xs">
                                  Source: {memory.metadata.source}
                                </div>
                              )}
                            </div>

                            {memory.expiresAt && (
                              <div className="mt-2 text-orange-400 text-xs">
                                Expires:{' '}
                                {new Date(
                                  memory.expiresAt
                                ).toLocaleDateString()}
                              </div>
                            )}
                          </GlassCard>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))
        )}
      </div>

      {/* Load more indicator */}
      {filteredMemories.length >= 50 && (
        <div className="text-center">
          <GlassButton variant="outline">Load Earlier Memories</GlassButton>
        </div>
      )}
    </div>
  );
}
