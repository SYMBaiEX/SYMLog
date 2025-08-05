'use client';

import { useQuery } from 'convex/react';
import {
  Activity,
  BarChart3,
  Brain,
  ChevronDown,
  Clock,
  MessageSquare,
  Settings,
  Sparkles,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { AgentKnowledgeViewer } from './agent-knowledge-viewer';
import { AgentLearningAnalytics } from './agent-learning-analytics';
import { AgentMemoryTimeline } from './agent-memory-timeline';

interface AgentDashboardProps {
  userId: string;
  className?: string;
}

type DashboardView =
  | 'overview'
  | 'knowledge'
  | 'memories'
  | 'analytics'
  | 'conversations';

export function AgentDashboard({ userId, className }: AgentDashboardProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<Id<'agents'> | ''>('');
  const [currentView, setCurrentView] = useState<DashboardView>('overview');

  // Fetch user's agents
  const agents = useQuery(api.agents.getActiveAgents, { userId });
  const selectedAgent = useQuery(
    api.agents.getAgentById,
    selectedAgentId ? { userId, agentId: selectedAgentId } : 'skip'
  );
  const stats = useQuery(
    api.agents.getAgentKnowledgeStats,
    selectedAgentId ? { userId, agentId: selectedAgentId } : 'skip'
  );

  const viewOptions = [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'knowledge', label: 'Knowledge', icon: Brain },
    { key: 'memories', label: 'Memory Timeline', icon: Clock },
    { key: 'analytics', label: 'Learning Analytics', icon: BarChart3 },
    { key: 'conversations', label: 'Conversations', icon: MessageSquare },
  ];

  if (!agents) {
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

  // Auto-select first agent if none selected
  if (agents.length > 0 && !selectedAgentId) {
    setSelectedAgentId(agents[0]._id as Id<'agents'>);
  }

  if (agents.length === 0) {
    return (
      <GlassCard className={cn('p-8 text-center', className)}>
        <Brain className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 font-semibold text-lg">No Agents Found</h3>
        <p className="mb-4 text-muted-foreground text-sm">
          You haven&apos;t created any AI agents yet. Create your first agent to
          start building knowledge and memories.
        </p>
        <GlassButton className="gap-2">
          <Sparkles className="h-4 w-4" />
          Create Your First Agent
        </GlassButton>
      </GlassCard>
    );
  }

  const renderOverview = () => {
    if (!(selectedAgent && stats)) return null;

    return (
      <div className="space-y-6">
        {/* Agent Overview */}
        <GlassCard className="p-6">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-periwinkle/20 to-purple-500/20">
                <Brain className="h-6 w-6 text-periwinkle" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{selectedAgent.name}</h3>
                <p className="text-muted-foreground text-sm">
                  {selectedAgent.description || 'No description provided'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge className="gap-1" variant="secondary">
                <Sparkles className="h-3 w-3" />
                {selectedAgent.model}
              </Badge>
              <Badge variant={selectedAgent.isActive ? 'default' : 'secondary'}>
                {selectedAgent.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="font-bold text-2xl text-blue-400">
                {stats.totalKnowledge}
              </div>
              <div className="text-muted-foreground text-xs">
                Knowledge Items
              </div>
            </div>
            <div className="text-center">
              <div className="font-bold text-2xl text-green-400">
                {stats.totalMemories}
              </div>
              <div className="text-muted-foreground text-xs">
                Total Memories
              </div>
            </div>
            <div className="text-center">
              <div className="font-bold text-2xl text-purple-400">
                {(stats.avgConfidence * 100).toFixed(1)}%
              </div>
              <div className="text-muted-foreground text-xs">
                Avg Confidence
              </div>
            </div>
            <div className="text-center">
              <div className="font-bold text-2xl text-orange-400">
                {stats.recentMemories}
              </div>
              <div className="text-muted-foreground text-xs">
                Recent Updates
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Knowledge Categories */}
        <GlassCard className="p-6">
          <h4 className="mb-4 flex items-center gap-2 font-semibold">
            <Brain className="h-5 w-5 text-periwinkle" />
            Knowledge Distribution
          </h4>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {Object.entries(stats.knowledgeByCategory).map(
              ([category, count]) => (
                <div
                  className="rounded-lg bg-white/5 p-3 text-center"
                  key={category}
                >
                  <div className="font-bold text-lg">{count}</div>
                  <div className="text-muted-foreground text-xs capitalize">
                    {category}
                  </div>
                </div>
              )
            )}
          </div>
        </GlassCard>

        {/* Memory Types */}
        <GlassCard className="p-6">
          <h4 className="mb-4 flex items-center gap-2 font-semibold">
            <Clock className="h-5 w-5 text-periwinkle" />
            Memory Types
          </h4>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {Object.entries(stats.memoriesByType).map(([type, count]) => (
              <div className="rounded-lg bg-white/5 p-3 text-center" key={type}>
                <div className="font-bold text-lg">{count}</div>
                <div className="text-muted-foreground text-xs capitalize">
                  {type.replace('_', ' ')}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {viewOptions.slice(1).map((option) => {
            const Icon = option.icon;
            return (
              <GlassButton
                aria-current={currentView === option.key ? 'page' : undefined}
                aria-label={`View ${option.label}`}
                className="h-auto flex-col gap-2 p-4"
                key={option.key}
                onClick={() => setCurrentView(option.key as DashboardView)}
                variant="outline"
              >
                <Icon className="h-6 w-6" />
                <span className="text-sm">{option.label}</span>
              </GlassButton>
            );
          })}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (!selectedAgentId) return null;

    switch (currentView) {
      case 'overview':
        return renderOverview();
      case 'knowledge':
        return (
          <AgentKnowledgeViewer agentId={selectedAgentId} userId={userId} />
        );
      case 'memories':
        return (
          <AgentMemoryTimeline agentId={selectedAgentId} userId={userId} />
        );
      case 'analytics':
        return (
          <AgentLearningAnalytics agentId={selectedAgentId} userId={userId} />
        );
      case 'conversations':
        return (
          <GlassCard className="p-8 text-center">
            <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h4 className="mb-2 font-semibold">Conversations Coming Soon</h4>
            <p className="text-muted-foreground text-sm">
              Conversation history and analysis will be available in a future
              update.
            </p>
          </GlassCard>
        );
      default:
        return renderOverview();
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with Agent Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <User className="h-6 w-6 text-periwinkle" />
          <div>
            <h2 className="font-semibold text-xl">Agent Dashboard</h2>
            <p className="text-muted-foreground text-sm">
              View your AI agents&apos; knowledge, memories, and learning
              progress
            </p>
          </div>
        </div>

        {/* Agent Selector */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Agent:</span>
          <div className="relative">
            <select
              className="appearance-none rounded-lg border border-white/20 bg-white/10 px-3 py-2 pr-8 text-sm focus:border-periwinkle/50 focus:outline-none"
              onChange={(e) =>
                setSelectedAgentId(e.target.value as Id<'agents'>)
              }
              value={selectedAgentId}
            >
              {agents.map((agent) => (
                <option
                  className="bg-gray-800"
                  key={agent._id}
                  value={agent._id}
                >
                  {agent.name}
                </option>
              ))}
            </select>
            <ChevronDown className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-2 h-4 w-4 transform text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {viewOptions.map((option) => {
          const Icon = option.icon;
          return (
            <GlassButton
              aria-current={currentView === option.key ? 'page' : undefined}
              aria-label={`View ${option.label}`}
              className="gap-2 whitespace-nowrap"
              key={option.key}
              onClick={() => setCurrentView(option.key as DashboardView)}
              variant={currentView === option.key ? 'default' : 'ghost'}
            >
              <Icon className="h-4 w-4" />
              {option.label}
            </GlassButton>
          );
        })}
      </div>

      {/* Main Content */}
      {renderContent()}
    </div>
  );
}
