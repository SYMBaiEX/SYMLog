'use client';

import {
  Calendar,
  Loader2,
  MessageSquare,
  MoreVertical,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';
import { useConversationListCache } from '@/hooks/use-api-cache';
import { cn } from '@/lib/utils';
import { CacheService } from '@/services/cache.service';

interface Conversation {
  id: string;
  title: string;
  lastMessage?: string;
  updatedAt: string;
}

interface ConversationSidebarProps {
  currentUserId: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

export function ConversationSidebar({
  currentUserId,
  onSelectConversation,
  onNewConversation,
}: ConversationSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Use SWR to cache conversation list
  const {
    data: conversations = [],
    error,
    isLoading,
    mutate,
  } = useConversationListCache(currentUserId);

  // Mock data fallback - in real app this would come from the API
  useEffect(() => {
    if (!(conversations.length || isLoading || error)) {
      // Simulate API call with cached data
      const mockData = [
        {
          id: '1',
          title: 'Web3 Integration Help',
          lastMessage: 'How can I integrate Phantom wallet...',
          updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
        },
        {
          id: '2',
          title: 'Smart Contract Review',
          lastMessage: 'Can you review this Solana program...',
          updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        },
        {
          id: '3',
          title: 'UI Design Suggestions',
          lastMessage: 'I need help with glassmorphism...',
          updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
        },
      ];
      // Update cache with mock data
      CacheService.updateUserCache(`${currentUserId}/conversations`, mockData);
    }
  }, [conversations.length, isLoading, error, currentUserId]);

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.lastMessage &&
        conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const handleDeleteConversation = (id: string) => {
    // Update cache to remove conversation
    const updatedConversations = conversations.filter((conv) => conv.id !== id);
    CacheService.updateUserCache(
      `${currentUserId}/conversations`,
      updatedConversations
    );
    mutate();
  };

  return (
    <GlassCard className="flex h-full flex-col p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-lg">Conversations</h3>
        <GlassButton className="gap-2" onClick={onNewConversation} size="sm">
          <Plus className="h-4 w-4" />
          New Chat
        </GlassButton>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
        <input
          className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pr-4 pl-10 transition-all placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-periwinkle/50"
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search conversations..."
          type="text"
          value={searchQuery}
        />
      </div>

      {/* Conversations list */}
      <div className="scrollbar-thin scrollbar-thumb-white/10 flex-1 space-y-2 overflow-y-auto">
        {isLoading ? (
          <div className="py-8 text-center">
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-periwinkle" />
            <p className="text-muted-foreground text-sm">
              Loading conversations...
            </p>
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <MessageSquare className="mx-auto mb-3 h-12 w-12 text-red-400/30" />
            <p className="text-red-400 text-sm">Failed to load conversations</p>
            <GlassButton
              className="mt-2"
              onClick={() => mutate()}
              size="sm"
              variant="ghost"
            >
              Retry
            </GlassButton>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="py-8 text-center">
            <MessageSquare className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </p>
            <GlassButton
              className="mt-2"
              onClick={onNewConversation}
              size="sm"
              variant="ghost"
            >
              Start a new chat
            </GlassButton>
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <div
              className={cn(
                'cursor-pointer rounded-lg p-3 transition-all duration-200',
                'group hover:bg-white/5',
                selectedId === conv.id &&
                  'border border-periwinkle/30 bg-periwinkle/10'
              )}
              key={conv.id}
              onClick={() => {
                setSelectedId(conv.id);
                onSelectConversation(conv.id);
              }}
            >
              <div className="mb-1 flex items-start justify-between">
                <h4 className="line-clamp-1 flex-1 font-medium text-sm">
                  {conv.title}
                </h4>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <GlassButton
                      className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                      size="icon"
                      variant="ghost"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </GlassButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        // Implement rename
                      }}
                    >
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(conv.id);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {conv.lastMessage && (
                <p className="mb-2 line-clamp-1 text-muted-foreground text-xs">
                  {conv.lastMessage}
                </p>
              )}

              <div className="flex items-center justify-end text-muted-foreground text-xs">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatTimestamp(conv.updatedAt)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* User stats */}
      <div className="mt-4 border-white/10 border-t pt-4">
        <div className="space-y-1 text-muted-foreground text-xs">
          <div className="flex justify-between">
            <span>Total conversations</span>
            <span>{conversations.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Messages today</span>
            <span>24</span>
          </div>
          <div className="flex justify-between">
            <span>Tokens used</span>
            <span>12.5k</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
