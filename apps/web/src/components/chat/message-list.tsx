'use client';

import type { UIMessage } from '@ai-sdk/react';
import {
  Bot,
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Square,
  User,
} from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArtifactPreview } from '@/components/artifacts/artifact-preview';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { cn } from '@/lib/utils';
import type { ExtendedUIMessage } from '@/types/ui-message-extended';
import { hasAttachments } from '@/types/ui-message-extended';
import { EditableMessage } from './editable-message';
import { MessageAttachments } from './message-attachments';

interface MessageListProps {
  messages: (UIMessage | ExtendedUIMessage)[];
  isLoading: boolean;
  onRegenerate: () => void;
  onStop: () => void;
  enableBranching?: boolean;
}

function MessageListComponent({
  messages,
  isLoading,
  onRegenerate,
  onStop,
  enableBranching = false,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const copyToClipboard = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const formatContent = (content: string) => {
    return <MarkdownRenderer content={content} />;
  };

  return (
    <>
      <div
        aria-label="Chat messages"
        aria-live="polite"
        className="scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent flex-1 space-y-4 overflow-y-auto pb-4"
        ref={scrollRef}
        role="log"
      >
        {messages.length === 0 && !isLoading && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Bot className="mb-4 h-16 w-16 text-periwinkle/50" />
            <h3 className="mb-2 font-semibold text-lg">Start a conversation</h3>
            <p className="max-w-md text-muted-foreground">
              Ask me anything! I can help with technical questions, creative
              ideas, or general assistance.
            </p>
          </div>
        )}

        {messages.map((message, index) => {
          const isUser = message.role === 'user';
          const isLast = index === messages.length - 1;

          return (
            <GlassCard
              className={cn(
                'animate-fade-in p-4',
                isUser ? 'ml-auto max-w-[80%]' : 'mr-auto max-w-[80%]'
              )}
              key={message.id}
            >
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback
                    className={cn(
                      'font-medium text-xs',
                      isUser
                        ? 'bg-periwinkle/20 text-periwinkle'
                        : 'bg-light-green/20 text-light-green'
                    )}
                  >
                    {isUser ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {isUser ? 'You' : 'AI Assistant'}
                    </span>
                  </div>

                  {enableBranching ? (
                    <EditableMessage
                      canEdit={isUser}
                      canRegenerate={!isUser && isLast}
                      message={message}
                      nodeId={message.id}
                      onCopy={(content) => copyToClipboard(content, message.id)}
                    />
                  ) : (
                    <div className="text-sm leading-relaxed">
                      {message.parts.map((part, i) => {
                        if (part.type === 'text') {
                          return <div key={i}>{formatContent(part.text)}</div>;
                        }
                        // Handle data parts (artifacts)
                        if (
                          part.type.startsWith('data-') &&
                          (part as any).value?.artifact
                        ) {
                          return (
                            <div className="mt-4" key={i}>
                              <ArtifactPreview
                                artifact={(part as any).value.artifact}
                              />
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}

                  {/* Display attachments for user messages */}
                  {isUser && hasAttachments(message) && message.attachments && (
                    <MessageAttachments attachments={message.attachments} />
                  )}

                  {/* Legacy action buttons when branching is disabled */}
                  {!(enableBranching || isUser) && (
                    <div className="mt-2 flex gap-2">
                      <GlassButton
                        className="h-7 w-7"
                        onClick={() => {
                          const textContent = message.parts
                            .filter((part) => part.type === 'text')
                            .map((part) => part.text)
                            .join('\n');
                          copyToClipboard(textContent, message.id);
                        }}
                        size="icon"
                        variant="ghost"
                      >
                        {copiedId === message.id ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </GlassButton>
                      {isLast && (
                        <GlassButton
                          className="h-7 w-7"
                          disabled={isLoading}
                          onClick={onRegenerate}
                          size="icon"
                          variant="ghost"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </GlassButton>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          );
        })}

        {isLoading && (
          <GlassCard
            aria-label="AI Assistant is thinking"
            aria-live="polite"
            className="mr-auto max-w-[80%] animate-pulse p-4"
            role="status"
          >
            <div className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-light-green/20 text-light-green">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-medium text-sm">AI Assistant</span>
                  <Loader2 className="h-3 w-3 animate-spin" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-light-green/50" />
                  <div className="animation-delay-200 h-2 w-2 animate-bounce rounded-full bg-light-green/50" />
                  <div className="animation-delay-400 h-2 w-2 animate-bounce rounded-full bg-light-green/50" />
                </div>
                <GlassButton
                  aria-label="Stop AI response generation"
                  className="mt-2"
                  onClick={onStop}
                  size="sm"
                  variant="ghost"
                >
                  <Square className="mr-1 h-3 w-3" />
                  Stop
                </GlassButton>
              </div>
            </div>
          </GlassCard>
        )}
      </div>

      {/* Screen reader announcements for new messages */}
      <div aria-atomic="true" aria-live="assertive" className="sr-only">
        {messages.length > 0 && (
          <div>
            New message from{' '}
            {messages[messages.length - 1].role === 'user'
              ? 'you'
              : 'assistant'}
            :{(() => {
              const lastMessage = messages[messages.length - 1];
              if ('parts' in lastMessage && lastMessage.parts) {
                return (
                  lastMessage.parts
                    .filter((part: any) => part.type === 'text')
                    .map((part: any) => part.text)
                    .join('') || 'Message content'
                );
              }
              return 'Message content';
            })()}
          </div>
        )}
      </div>
    </>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const MessageList = memo(
  MessageListComponent,
  (prevProps, nextProps) => {
    // Custom comparison function for better performance
    return (
      prevProps.messages.length === nextProps.messages.length &&
      prevProps.isLoading === nextProps.isLoading &&
      prevProps.messages.every(
        (msg, idx) => msg.id === nextProps.messages[idx]?.id
      )
    );
  }
);
