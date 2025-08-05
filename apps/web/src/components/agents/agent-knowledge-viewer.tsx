'use client';

import { useQuery } from 'convex/react';
import {
  BookOpen,
  Brain,
  Clock,
  Filter,
  Lightbulb,
  Search,
  Settings,
  Star,
  Tag,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';

interface AgentKnowledgeViewerProps {
  userId: string;
  agentId: Id<'agents'> | string;
  className?: string;
}

export function AgentKnowledgeViewer({
  userId,
  agentId,
  className,
}: AgentKnowledgeViewerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'confidence' | 'usage'>(
    'recent'
  );

  // Fetch agent data
  const agent = useQuery(api.agents.getAgentById, {
    userId,
    agentId: agentId as Id<'agents'>,
  });
  const knowledge = useQuery(api.agents.getAgentKnowledge, {
    userId,
    agentId: agentId as Id<'agents'>,
    category:
      selectedCategory === 'all' ? undefined : (selectedCategory as any),
    limit: 100,
  });
  const stats = useQuery(api.agents.getAgentKnowledgeStats, {
    userId,
    agentId: agentId as Id<'agents'>,
  });

  // Filter and sort knowledge
  const filteredKnowledge = useMemo(() => {
    if (!knowledge) return [];

    const filtered = knowledge.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.metadata?.tags &&
          item.metadata.tags.some((tag) =>
            tag.toLowerCase().includes(searchQuery.toLowerCase())
          ));

      return matchesSearch;
    });

    // Sort knowledge items
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'confidence':
          return b.confidence - a.confidence;
        case 'usage':
          return (b.metadata?.usageCount || 0) - (a.metadata?.usageCount || 0);
        case 'recent':
        default:
          return b.updatedAt - a.updatedAt;
      }
    });

    return filtered;
  }, [knowledge, searchQuery, sortBy]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'facts':
        return BookOpen;
      case 'skills':
        return Target;
      case 'preferences':
        return Star;
      case 'relationships':
        return Users;
      case 'procedures':
        return Settings;
      case 'concepts':
        return Lightbulb;
      default:
        return Brain;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'facts':
        return 'text-blue-400 border-blue-500/50';
      case 'skills':
        return 'text-green-400 border-green-500/50';
      case 'preferences':
        return 'text-purple-400 border-purple-500/50';
      case 'relationships':
        return 'text-pink-400 border-pink-500/50';
      case 'procedures':
        return 'text-orange-400 border-orange-500/50';
      case 'concepts':
        return 'text-cyan-400 border-cyan-500/50';
      default:
        return 'text-gray-400 border-gray-500/50';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (!(agent && knowledge && stats)) {
    return (
      <GlassCard className={cn('p-6', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-1/3 rounded bg-white/10" />
          <div className="space-y-2">
            <div className="h-4 rounded bg-white/10" />
            <div className="h-4 w-3/4 rounded bg-white/10" />
          </div>
        </div>
      </GlassCard>
    );
  }

  const categories = [
    { key: 'all', label: 'All Knowledge', count: stats.totalKnowledge },
    ...Object.entries(stats.knowledgeByCategory).map(([key, count]) => ({
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
          <Brain className="h-6 w-6 text-periwinkle" />
          <div>
            <h3 className="font-semibold text-lg">Agent Knowledge</h3>
            <p className="text-muted-foreground text-sm">
              {agent.name} • {stats.totalKnowledge} items •{' '}
              {(stats.avgConfidence * 100).toFixed(1)}% avg confidence
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="gap-1" variant="secondary">
            <TrendingUp className="h-3 w-3" />
            {stats.recentMemories} recent updates
          </Badge>
        </div>
      </div>

      {/* Knowledge Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-400" />
            <span className="text-muted-foreground text-sm">
              Total Knowledge
            </span>
          </div>
          <div className="font-bold text-2xl">{stats.totalKnowledge}</div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Target className="h-4 w-4 text-green-400" />
            <span className="text-muted-foreground text-sm">
              Avg Confidence
            </span>
          </div>
          <div className="font-bold text-2xl text-green-400">
            {(stats.avgConfidence * 100).toFixed(1)}%
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-400" />
            <span className="text-muted-foreground text-sm">
              Total Memories
            </span>
          </div>
          <div className="font-bold text-2xl">{stats.totalMemories}</div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-400" />
            <span className="text-muted-foreground text-sm">Last Updated</span>
          </div>
          <div className="text-sm">
            {stats.lastUpdated
              ? new Date(stats.lastUpdated).toLocaleDateString()
              : 'Never'}
          </div>
        </GlassCard>
      </div>

      {/* Filters and Search */}
      <GlassCard className="p-4">
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-muted-foreground" />
            <input
              className="w-full rounded-lg border border-white/10 bg-transparent py-2 pr-4 pl-10 focus:border-periwinkle/50 focus:outline-none"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search knowledge and memories..."
              type="text"
              value={searchQuery}
            />
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const Icon = getCategoryIcon(category.key);
              return (
                <GlassButton
                  className="gap-2"
                  key={category.key}
                  onClick={() => setSelectedCategory(category.key)}
                  size="sm"
                  variant={
                    selectedCategory === category.key ? 'default' : 'ghost'
                  }
                >
                  <Icon className="h-3 w-3" />
                  {category.label}
                  <Badge className="text-xs" variant="secondary">
                    {category.count || 0}
                  </Badge>
                </GlassButton>
              );
            })}
          </div>

          {/* Sort options */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground text-sm">Sort by:</span>
            <div className="flex gap-1">
              {[
                { key: 'recent', label: 'Most Recent' },
                { key: 'confidence', label: 'Highest Confidence' },
                { key: 'usage', label: 'Most Used' },
              ].map((option) => (
                <GlassButton
                  key={option.key}
                  onClick={() => setSortBy(option.key as any)}
                  size="sm"
                  variant={sortBy === option.key ? 'default' : 'ghost'}
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
            <Brain className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h4 className="mb-2 font-semibold">No Knowledge Found</h4>
            <p className="text-muted-foreground text-sm">
              {searchQuery
                ? 'Try adjusting your search terms.'
                : "This agent hasn't learned anything yet."}
            </p>
          </GlassCard>
        ) : (
          filteredKnowledge.map((item) => {
            const Icon = getCategoryIcon(item.category);
            const categoryColor = getCategoryColor(item.category);
            const confidenceColor = getConfidenceColor(item.confidence);

            return (
              <GlassCard
                className="p-4 transition-colors hover:bg-white/5"
                key={item._id}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={cn('h-4 w-4', categoryColor.split(' ')[0])}
                    />
                    <h4 className="font-medium">{item.title}</h4>
                    <Badge
                      className={cn('text-xs', categoryColor)}
                      variant="outline"
                    >
                      {item.category}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <span className={cn('font-medium', confidenceColor)}>
                      {(item.confidence * 100).toFixed(0)}% confidence
                    </span>
                    {item.metadata?.usageCount && (
                      <span>• {item.metadata.usageCount} uses</span>
                    )}
                  </div>
                </div>

                <p className="mb-3 line-clamp-2 text-muted-foreground text-sm">
                  {item.content}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {item.metadata?.tags && (
                      <div className="flex gap-1">
                        {item.metadata.tags.slice(0, 3).map((tag, index) => (
                          <Badge
                            className="gap-1 text-xs"
                            key={index}
                            variant="secondary"
                          >
                            <Tag className="h-2 w-2" />
                            {tag}
                          </Badge>
                        ))}
                        {item.metadata.tags.length > 3 && (
                          <Badge className="text-xs" variant="secondary">
                            +{item.metadata.tags.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-muted-foreground text-xs">
                    Updated {new Date(item.updatedAt).toLocaleDateString()}
                    {item.metadata?.source && (
                      <span> • from {item.metadata.source}</span>
                    )}
                  </div>
                </div>
              </GlassCard>
            );
          })
        )}
      </div>

      {/* Load more if needed */}
      {filteredKnowledge.length === 100 && (
        <div className="text-center">
          <GlassButton variant="outline">Load More Knowledge</GlassButton>
        </div>
      )}
    </div>
  );
}
