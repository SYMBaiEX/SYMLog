"use client"

import { useState, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { MessageList } from "./message-list"
import { EnhancedMessageInput } from "./enhanced-message-input"
import type { MessageWithAttachments, FileAttachment } from "@/types/attachments"
import type { ExtendedUIMessage } from "@/types/ui-message-extended"
import { ConversationTreeProvider } from "@/contexts/conversation-tree-context"
import { BranchNavigator } from "./branch-navigator"
import { ConversationSidebar } from "./conversation-sidebar"
import { TreeVisualization } from "./tree-visualization"
import { ChatSettingsModal } from "./chat-settings-modal"
import { GlassCard } from "@/components/ui/glass-card"
import { GlassButton } from "@/components/ui/glass-button"
import { Badge } from "@/components/ui/badge"
import { Brain, Settings, Sparkles, Menu, X, GitBranch, Network } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface ChatContainerProps {
  sessionToken: string
  userId: string
  userEmail?: string
}

export function ChatContainer({ sessionToken, userId, userEmail }: ChatContainerProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>()
  const [systemPromptType, setSystemPromptType] = useState<'default' | 'technical' | 'creative'>('default')
  const [enableBranching, setEnableBranching] = useState<boolean>(false)
  const [showTreeVisualization, setShowTreeVisualization] = useState<boolean>(false)
  const [showSettings, setShowSettings] = useState<boolean>(false)
  const [chatSettings, setChatSettings] = useState({
    defaultModel: selectedModel,
    temperature: 0.7,
    maxTokens: 4096,
    systemPromptType: systemPromptType,
    enableBranching: enableBranching,
    enableMarkdownPreview: true,
    syntaxHighlighting: true,
    codeExecutionEnabled: true,
    autoGenerateArtifacts: true
  })
  // Store pending attachments for messages being sent
  const [pendingAttachments, setPendingAttachments] = useState<FileAttachment[]>([])
  const [lastUserMessageTime, setLastUserMessageTime] = useState<number>(0)
  const [conversationId, setConversationId] = useState<string>(`chat-${userId}-${Date.now()}`)

  const {
    messages,
    error,
    sendMessage,
    regenerate,
    stop,
    setMessages,
    status,
  } = useChat({
    // Use the default transport with /api/chat endpoint
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send message')
    },
    onFinish: ({ message }) => {
      // TODO: Save to conversation history with Convex
    },
    onData: ({ data }) => {
      // Data parts (artifacts) are handled in the message rendering
    },
  })

  const isLoading = status === 'streaming'

  // Create extended messages with attachments
  const extendedMessages: (ExtendedUIMessage)[] = messages.map((message, index) => {
    // For the most recent user message, attach pending attachments
    if (message.role === 'user' && index === messages.length - 2 && pendingAttachments.length > 0) {
      return {
        ...message,
        attachments: pendingAttachments
      }
    }
    return message
  })

  const handleSettingsChange = (newSettings: any) => {
    setChatSettings(prev => ({ ...prev, ...newSettings }))
    
    // Apply settings to UI state
    if (newSettings.defaultModel !== undefined) {
      setSelectedModel(newSettings.defaultModel)
    }
    if (newSettings.systemPromptType !== undefined) {
      setSystemPromptType(newSettings.systemPromptType)
    }
    if (newSettings.enableBranching !== undefined) {
      setEnableBranching(newSettings.enableBranching)
    }
  }

  // Mobile responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setSidebarOpen(true)
      } else {
        setSidebarOpen(false)
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <ConversationTreeProvider conversationId={conversationId}>
      <div className="flex h-[calc(100vh-4rem)] relative">
        {/* Mobile menu button */}
        <GlassButton
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 z-50 md:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </GlassButton>

        {/* Sidebar */}
        <div
          className={cn(
            "absolute md:relative w-80 h-full transition-transform duration-300 z-40",
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          <div className="h-full flex flex-col">
            {/* Conversation Sidebar */}
            <div className="flex-1">
              <ConversationSidebar
                currentUserId={userId}
                onSelectConversation={(id) => {
                  setConversationId(id)
                  setMessages([])
                }}
                onNewConversation={() => {
                  const newId = `chat-${userId}-${Date.now()}`
                  setConversationId(newId)
                  setMessages([])
                }}
              />
            </div>
            
            {/* Branch Navigator */}
            {enableBranching && (
              <div className="p-4 border-t border-white/10">
                <BranchNavigator compact />
              </div>
            )}
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col">
          {/* Chat header */}
          <GlassCard className="m-4 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="h-6 w-6 text-periwinkle" />
              <div>
                <h2 className="text-lg font-semibold">AI Assistant</h2>
                <p className="text-sm text-muted-foreground">
                  {userEmail || `User ${userId.slice(0, 8)}`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Sparkles className="h-3 w-3" />
                {systemPromptType}
              </Badge>
              
              {/* Branching toggle */}
              <GlassButton
                variant={enableBranching ? "default" : "ghost"}
                size="sm"
                onClick={() => setEnableBranching(!enableBranching)}
                className="gap-1"
                title={enableBranching ? "Disable conversation branching" : "Enable conversation branching"}
              >
                <GitBranch className="h-3 w-3" />
                {enableBranching ? "Branching" : "Linear"}
              </GlassButton>
              
              {/* Tree visualization toggle */}
              {enableBranching && (
                <GlassButton
                  variant={showTreeVisualization ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setShowTreeVisualization(!showTreeVisualization)}
                  className="gap-1"
                  title={showTreeVisualization ? "Hide tree visualization" : "Show tree visualization"}
                >
                  <Network className="h-3 w-3" />
                  Tree
                </GlassButton>
              )}
              
              <GlassButton
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowSettings(true)
                }}
                title="Chat Settings"
              >
                <Settings className="h-4 w-4" />
              </GlassButton>
            </div>
          </GlassCard>

          {/* Tree Visualization */}
          {enableBranching && showTreeVisualization && (
            <div className="px-4 py-2">
              <TreeVisualization />
            </div>
          )}

          {/* Branch Navigator (expanded view) */}
          {enableBranching && !showTreeVisualization && (
            <div className="px-4">
              <BranchNavigator />
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-hidden px-4">
            <MessageList
              messages={extendedMessages}
              isLoading={isLoading}
              enableBranching={enableBranching}
              onRegenerate={() => regenerate({
                headers: {
                  Authorization: `Bearer ${sessionToken}`,
                },
                body: {
                  model: selectedModel,
                  systemPromptType,
                },
              })}
              onStop={() => stop()}
            />
          </div>

          {/* Error display */}
          {error && (
            <div className="px-4 py-2">
              <GlassCard className="p-3 border-red-500/20 bg-red-500/5">
                <p className="text-sm text-red-400">
                  {error.message || 'An error occurred. Please try again.'}
                </p>
              </GlassCard>
            </div>
          )}

          {/* Input area */}
          <div className="p-4">
            <EnhancedMessageInput
              isLoading={isLoading}
              onSendMessage={(message: MessageWithAttachments) => {
                // Store attachments for display with the user message
                if (message.attachments && message.attachments.length > 0) {
                  setPendingAttachments(message.attachments)
                  setLastUserMessageTime(Date.now())
                } else {
                  setPendingAttachments([])
                }

                sendMessage(
                  { text: message.text },
                  {
                    headers: {
                      Authorization: `Bearer ${sessionToken}`,
                    },
                    body: {
                      model: selectedModel,
                      systemPromptType,
                      attachments: message.attachments,
                    },
                  }
                )
              }}
              onModelChange={setSelectedModel}
              onPromptTypeChange={setSystemPromptType}
              currentModel={selectedModel}
              currentPromptType={systemPromptType}
            />
          </div>
        </div>
        
        {/* Chat Settings Modal */}
        <ChatSettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          currentSettings={chatSettings}
          onSettingsChange={handleSettingsChange}
        />
      </div>
    </ConversationTreeProvider>
  )
}