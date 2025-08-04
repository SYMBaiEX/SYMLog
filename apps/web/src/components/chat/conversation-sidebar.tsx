"use client"

import { useState, useEffect } from "react"
import { GlassCard } from "@/components/ui/glass-card"
import { GlassButton } from "@/components/ui/glass-button"
import { 
  Plus, 
  MessageSquare, 
  Search, 
  Calendar,
  Trash2,
  MoreVertical
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Conversation {
  id: string
  title: string
  lastMessage: string
  timestamp: Date
  messageCount: number
}

interface ConversationSidebarProps {
  currentUserId: string
  onSelectConversation: (id: string) => void
  onNewConversation: () => void
}

export function ConversationSidebar({
  currentUserId,
  onSelectConversation,
  onNewConversation,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Mock data - replace with Convex queries
  useEffect(() => {
    setConversations([
      {
        id: "1",
        title: "Web3 Integration Help",
        lastMessage: "How can I integrate Phantom wallet...",
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
        messageCount: 12,
      },
      {
        id: "2",
        title: "Smart Contract Review",
        lastMessage: "Can you review this Solana program...",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        messageCount: 8,
      },
      {
        id: "3",
        title: "UI Design Suggestions",
        lastMessage: "I need help with glassmorphism...",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        messageCount: 15,
      },
    ])
  }, [])

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatTimestamp = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  return (
    <GlassCard className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Conversations</h3>
        <GlassButton
          size="sm"
          onClick={onNewConversation}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </GlassButton>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white/5 rounded-lg border border-white/10 
                   placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 
                   focus:ring-periwinkle/50 transition-all"
        />
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-white/10">
        {filteredConversations.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "No conversations found" : "No conversations yet"}
            </p>
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={onNewConversation}
              className="mt-2"
            >
              Start a new chat
            </GlassButton>
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                "p-3 rounded-lg cursor-pointer transition-all duration-200",
                "hover:bg-white/5 group",
                selectedId === conv.id && "bg-periwinkle/10 border border-periwinkle/30"
              )}
              onClick={() => {
                setSelectedId(conv.id)
                onSelectConversation(conv.id)
              }}
            >
              <div className="flex items-start justify-between mb-1">
                <h4 className="font-medium text-sm line-clamp-1 flex-1">
                  {conv.title}
                </h4>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <GlassButton
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-3 w-3" />
                    </GlassButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        // Implement rename
                      }}
                    >
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-400"
                      onClick={(e) => {
                        e.stopPropagation()
                        // Implement delete
                        setConversations(conversations.filter(c => c.id !== conv.id))
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                {conv.lastMessage}
              </p>
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {conv.messageCount} messages
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatTimestamp(conv.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* User stats */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="text-xs text-muted-foreground space-y-1">
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
  )
}