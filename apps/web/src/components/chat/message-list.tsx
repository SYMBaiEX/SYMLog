"use client"

import type { UIMessage } from "@ai-sdk/react"
import { useRef, useEffect } from "react"
import { GlassCard } from "@/components/ui/glass-card"
import { GlassButton } from "@/components/ui/glass-button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { 
  User, 
  Bot, 
  Copy, 
  Check, 
  RefreshCw, 
  Square,
  Loader2 
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { toast } from "sonner"
import { ArtifactPreview } from "@/components/artifacts/artifact-preview"
import { MessageAttachments } from "./message-attachments"
import type { ExtendedUIMessage } from "@/types/ui-message-extended"
import { hasAttachments } from "@/types/ui-message-extended"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { EditableMessage } from "./editable-message"

interface MessageListProps {
  messages: (UIMessage | ExtendedUIMessage)[]
  isLoading: boolean
  onRegenerate: () => void
  onStop: () => void
  enableBranching?: boolean
}

export function MessageList({ 
  messages, 
  isLoading, 
  onRegenerate, 
  onStop,
  enableBranching = false
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const copyToClipboard = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(messageId)
      toast.success("Copied to clipboard")
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      toast.error("Failed to copy")
    }
  }

  const formatContent = (content: string) => {
    return <MarkdownRenderer content={content} />
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto space-y-4 pb-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
    >
      {messages.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <Bot className="h-16 w-16 text-periwinkle/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
          <p className="text-muted-foreground max-w-md">
            Ask me anything! I can help with technical questions, creative ideas, 
            or general assistance.
          </p>
        </div>
      )}

      {messages.map((message, index) => {
        const isUser = message.role === 'user'
        const isLast = index === messages.length - 1
        
        return (
          <GlassCard
            key={message.id}
            className={cn(
              "p-4 animate-fade-in",
              isUser ? "ml-auto max-w-[80%]" : "mr-auto max-w-[80%]"
            )}
          >
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className={cn(
                  "text-xs font-medium",
                  isUser 
                    ? "bg-periwinkle/20 text-periwinkle" 
                    : "bg-light-green/20 text-light-green"
                )}>
                  {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {isUser ? "You" : "AI Assistant"}
                  </span>
                </div>
                
                {enableBranching ? (
                  <EditableMessage
                    nodeId={message.id}
                    message={message}
                    canEdit={isUser}
                    canRegenerate={!isUser && isLast}
                    onCopy={(content) => copyToClipboard(content, message.id)}
                  />
                ) : (
                  <div className="text-sm leading-relaxed">
                    {message.parts.map((part, i) => {
                      if (part.type === 'text') {
                        return (
                          <div key={i}>
                            {formatContent(part.text)}
                          </div>
                        )
                      }
                      // Handle data parts (artifacts)
                      if (part.type.startsWith('data-') && (part as any).value?.artifact) {
                        return (
                          <div key={i} className="mt-4">
                            <ArtifactPreview artifact={(part as any).value.artifact} />
                          </div>
                        )
                      }
                      return null
                    })}
                  </div>
                )}

                {/* Display attachments for user messages */}
                {isUser && hasAttachments(message) && message.attachments && (
                  <MessageAttachments attachments={message.attachments} />
                )}
                
                {/* Legacy action buttons when branching is disabled */}
                {!enableBranching && !isUser && (
                  <div className="flex gap-2 mt-2">
                    <GlassButton
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        const textContent = message.parts
                          .filter(part => part.type === 'text')
                          .map(part => part.text)
                          .join('\n')
                        copyToClipboard(textContent, message.id)
                      }}
                    >
                      {copiedId === message.id ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </GlassButton>
                    {isLast && (
                      <GlassButton
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={onRegenerate}
                        disabled={isLoading}
                      >
                        <RefreshCw className="h-3 w-3" />
                      </GlassButton>
                    )}
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        )
      })}
      
      {isLoading && (
        <GlassCard className="p-4 mr-auto max-w-[80%] animate-pulse">
          <div className="flex gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-light-green/20 text-light-green">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">AI Assistant</span>
                <Loader2 className="h-3 w-3 animate-spin" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-light-green/50 rounded-full animate-bounce" />
                <div className="h-2 w-2 bg-light-green/50 rounded-full animate-bounce animation-delay-200" />
                <div className="h-2 w-2 bg-light-green/50 rounded-full animate-bounce animation-delay-400" />
              </div>
              <GlassButton
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={onStop}
              >
                <Square className="h-3 w-3 mr-1" />
                Stop
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  )
}