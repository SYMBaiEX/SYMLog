'use client';

import { useChat } from '@ai-sdk/react';
import {
  AlertTriangle,
  Brain,
  DollarSign,
  GitBranch,
  Menu,
  Network,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChatSettingsModal, TreeVisualization } from '@/components/dynamic';
import { Badge } from '@/components/ui/badge';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';
import { ConversationTreeProvider } from '@/contexts/conversation-tree-context';
import { MODEL_CONFIGS } from '@/lib/ai/intelligence';
import { cn } from '@/lib/utils';
import type {
  FileAttachment,
  MessageWithAttachments,
} from '@/types/attachments';
import type { ExtendedUIMessage } from '@/types/ui-message-extended';
import { BranchNavigator } from './branch-navigator';
import { ConversationSidebar } from './conversation-sidebar';
import { EnhancedMessageInput } from './enhanced-message-input';
import { MessageList } from './message-list';

interface ChatContainerProps {
  sessionToken: string;
  userId: string;
  userEmail?: string;
}

export function ChatContainer({
  sessionToken,
  userId,
  userEmail,
}: ChatContainerProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4.1-nano'); // Default to nano model
  const [systemPromptType, setSystemPromptType] = useState<
    'default' | 'technical' | 'creative'
  >('default');
  const [enableBranching, setEnableBranching] = useState<boolean>(false);
  const [showTreeVisualization, setShowTreeVisualization] =
    useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [chatSettings, setChatSettings] = useState({
    defaultModel: selectedModel,
    temperature: 0.7,
    maxTokens: 4096,
    systemPromptType,
    enableBranching,
    enableMarkdownPreview: true,
    syntaxHighlighting: true,
    codeExecutionEnabled: true,
    autoGenerateArtifacts: true,
  });
  // Store pending attachments for messages being sent
  const [pendingAttachments, setPendingAttachments] = useState<
    FileAttachment[]
  >([]);
  const [lastUserMessageTime, setLastUserMessageTime] = useState<number>(0);
  const [conversationId, setConversationId] = useState<string>(
    `chat-${userId}-${Date.now()}`
  );

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
      toast.error(error.message || 'Failed to send message');
    },
    onFinish: ({ message }) => {
      // Note: Conversation history saving will be implemented with Convex integration
    },
    onData: ({ data }) => {
      // Data parts (artifacts) are handled in the message rendering
    },
  });

  const isLoading = status === 'streaming';

  // Create extended messages with attachments
  const extendedMessages: ExtendedUIMessage[] = messages.map(
    (message, index) => {
      // For the most recent user message, attach pending attachments
      if (
        message.role === 'user' &&
        index === messages.length - 2 &&
        pendingAttachments.length > 0
      ) {
        return {
          ...message,
          attachments: pendingAttachments,
        };
      }
      return message;
    }
  );

  const handleSettingsChange = (newSettings: any) => {
    setChatSettings((prev) => ({ ...prev, ...newSettings }));

    // Apply settings to UI state
    if (newSettings.defaultModel !== undefined) {
      setSelectedModel(newSettings.defaultModel);
    }
    if (newSettings.systemPromptType !== undefined) {
      setSystemPromptType(newSettings.systemPromptType);
    }
    if (newSettings.enableBranching !== undefined) {
      setEnableBranching(newSettings.enableBranching);
    }
  };

  // Mobile responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <ConversationTreeProvider conversationId={conversationId}>
      <div className="relative flex h-[calc(100vh-4rem)]">
        {/* Mobile menu button */}
        <GlassButton
          aria-expanded={sidebarOpen}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          className="absolute top-4 left-4 z-50 md:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          size="icon"
          variant="ghost"
        >
          {sidebarOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </GlassButton>

        {/* Sidebar */}
        <div
          className={cn(
            'absolute z-40 h-full w-80 transition-transform duration-300 md:relative',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          )}
        >
          <div className="flex h-full flex-col">
            {/* Conversation Sidebar */}
            <div className="flex-1">
              <ConversationSidebar
                currentUserId={userId}
                onNewConversation={() => {
                  const newId = `chat-${userId}-${Date.now()}`;
                  setConversationId(newId);
                  setMessages([]);
                }}
                onSelectConversation={(id) => {
                  setConversationId(id);
                  setMessages([]);
                }}
              />
            </div>

            {/* Branch Navigator */}
            {enableBranching && (
              <div className="border-white/10 border-t p-4">
                <BranchNavigator compact />
              </div>
            )}
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex flex-1 flex-col">
          {/* Chat header */}
          <GlassCard className="m-4 flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Brain className="h-6 w-6 text-periwinkle" />
              <div>
                <h2 className="font-semibold text-lg">AI Assistant</h2>
                <p className="text-muted-foreground text-sm">
                  {userEmail || `User ${userId.slice(0, 8)}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge className="gap-1" variant="outline">
                <Sparkles className="h-3 w-3" />
                {systemPromptType}
              </Badge>

              {/* Model info badge */}
              {selectedModel && MODEL_CONFIGS[selectedModel] && (
                <Badge
                  className="gap-1"
                  variant={
                    MODEL_CONFIGS[selectedModel].requiresExplicitSelection
                      ? 'destructive'
                      : 'secondary'
                  }
                >
                  {MODEL_CONFIGS[selectedModel].requiresExplicitSelection && (
                    <AlertTriangle className="h-3 w-3" />
                  )}
                  {MODEL_CONFIGS[selectedModel].displayName
                    .replace(/^gpt-/, 'GPT-')
                    .replace(/^o(\d)/, 'o$1')}
                  {MODEL_CONFIGS[selectedModel].requiresExplicitSelection && (
                    <span className="text-xs">
                      ~$
                      {(
                        MODEL_CONFIGS[selectedModel].pricing.input +
                        MODEL_CONFIGS[selectedModel].pricing.output
                      ).toFixed(1)}
                      /1M
                    </span>
                  )}
                </Badge>
              )}

              {/* Branching toggle */}
              <GlassButton
                aria-label={
                  enableBranching
                    ? 'Disable conversation branching'
                    : 'Enable conversation branching'
                }
                aria-pressed={enableBranching}
                className="gap-1"
                onClick={() => setEnableBranching(!enableBranching)}
                size="sm"
                title={
                  enableBranching
                    ? 'Disable conversation branching'
                    : 'Enable conversation branching'
                }
                variant={enableBranching ? 'default' : 'ghost'}
              >
                <GitBranch className="h-3 w-3" />
                {enableBranching ? 'Branching' : 'Linear'}
              </GlassButton>

              {/* Tree visualization toggle */}
              {enableBranching && (
                <GlassButton
                  aria-label={
                    showTreeVisualization
                      ? 'Hide tree visualization'
                      : 'Show tree visualization'
                  }
                  aria-pressed={showTreeVisualization}
                  className="gap-1"
                  onClick={() =>
                    setShowTreeVisualization(!showTreeVisualization)
                  }
                  size="sm"
                  title={
                    showTreeVisualization
                      ? 'Hide tree visualization'
                      : 'Show tree visualization'
                  }
                  variant={showTreeVisualization ? 'default' : 'ghost'}
                >
                  <Network className="h-3 w-3" />
                  Tree
                </GlassButton>
              )}

              <GlassButton
                aria-label="Open chat settings"
                onClick={() => {
                  setShowSettings(true);
                }}
                size="icon"
                title="Chat Settings"
                variant="ghost"
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
              enableBranching={enableBranching}
              isLoading={isLoading}
              messages={extendedMessages}
              onRegenerate={() =>
                regenerate({
                  headers: {
                    Authorization: `Bearer ${sessionToken}`,
                  },
                  body: {
                    model: selectedModel,
                    systemPromptType,
                  },
                })
              }
              onStop={() => stop()}
            />
          </div>

          {/* Error display */}
          {error && (
            <div className="px-4 py-2">
              <GlassCard className="border-red-500/20 bg-red-500/5 p-3">
                <p className="text-red-400 text-sm">
                  {error.message || 'An error occurred. Please try again.'}
                </p>
              </GlassCard>
            </div>
          )}

          {/* Input area */}
          <div className="p-4">
            <EnhancedMessageInput
              currentModel={selectedModel}
              currentPromptType={systemPromptType}
              isLoading={isLoading}
              onModelChange={setSelectedModel}
              onPromptTypeChange={setSystemPromptType}
              onSendMessage={(message: MessageWithAttachments) => {
                // Store attachments for display with the user message
                if (message.attachments && message.attachments.length > 0) {
                  setPendingAttachments(message.attachments);
                  setLastUserMessageTime(Date.now());
                } else {
                  setPendingAttachments([]);
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
                );
              }}
            />
          </div>
        </div>

        {/* Chat Settings Modal */}
        <ChatSettingsModal
          currentSettings={chatSettings}
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onSettingsChange={handleSettingsChange}
        />
      </div>
    </ConversationTreeProvider>
  );
}
