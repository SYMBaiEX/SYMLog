'use client';

import type { ChatRequestOptions, UIMessage } from 'ai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useChatEnhanced } from './use-chat-enhanced';

// Use UIMessage for compatibility with use-chat-enhanced
type EnhancedUIMessage = UIMessage & {
  content?: string; // For backward compatibility
};

type Message = EnhancedUIMessage;

export interface AssistantThread {
  id: string;
  messages: Message[];
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface AssistantTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
    execute: (parameters: any) => Promise<any> | any;
  };
}

export interface UseAssistantOptions {
  assistantId: string;
  api?: string;
  threadId?: string;
  instructions?: string;
  tools?: AssistantTool[];
  headers?: Record<string, string> | Headers;
  body?: any;
  onResponse?: (response: Response) => void | Promise<void>;
  onFinish?: (message: Message) => void;
  onError?: (error: Error) => void;
  onToolCall?: (toolCall: any) => void | unknown | Promise<unknown>;
  maxRetries?: number;
  timeout?: number;
  autoCreateThread?: boolean;
  persistent?: boolean;
}

export interface UseAssistantReturn {
  // Core state
  messages: Message[];
  isLoading: boolean;
  error: Error | undefined;
  status: 'idle' | 'loading' | 'awaiting_message' | 'error';

  // Thread management
  threadId: string | null;
  thread: AssistantThread | null;

  // Actions
  submitMessage: (
    content: string,
    options?: ChatRequestOptions
  ) => Promise<void>;
  appendMessage: (message: Message) => Promise<void>;
  regenerateLastMessage: () => Promise<void>;
  stop: () => void;
  clearMessages: () => void;

  // Thread operations
  createThread: (metadata?: Record<string, any>) => Promise<string>;
  loadThread: (threadId: string) => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;
  updateThreadMetadata: (metadata: Record<string, any>) => Promise<void>;

  // Tool management
  tools: AssistantTool[];
  addTool: (tool: AssistantTool) => void;
  removeTool: (toolName: string) => void;

  // File operations (for future OpenAI Assistants API compatibility)
  uploadFile: (file: File) => Promise<string>;
  deleteFile: (fileId: string) => Promise<void>;

  // Advanced features
  exportThread: (format: 'json' | 'markdown' | 'txt') => string;
  searchMessages: (query: string) => Message[];
  retry: () => void;

  // State
  metrics: {
    messageCount: number;
    threadAge: number;
    lastActivity: number;
  };
}

/**
 * Modern useAssistant hook using useChat pattern
 *
 * This hook provides a modern alternative to the deprecated useAssistant
 * from AI SDK 5.0, implementing OpenAI Assistants API compatibility
 * while using the new transport-based architecture.
 *
 * Features:
 * - Thread management and persistence
 * - Tool/function calling support
 * - File upload handling
 * - Message search and filtering
 * - Export capabilities
 * - Performance monitoring
 */
export function useAssistant(options: UseAssistantOptions): UseAssistantReturn {
  const {
    assistantId,
    api = '/api/assistant',
    threadId: initialThreadId,
    instructions,
    tools: initialTools = [],
    autoCreateThread = true,
    persistent = true,
    maxRetries = 3,
    timeout = 60_000, // Longer timeout for assistant responses
    onToolCall,
    onError,
    onFinish,
    onResponse,
    ...chatOptions
  } = options;

  // State management
  const [threadId, setThreadId] = useState<string | null>(
    initialThreadId ?? null
  );
  const [thread, setThread] = useState<AssistantThread | null>(null);
  const [tools, setTools] = useState<AssistantTool[]>(initialTools);
  const [metrics, setMetrics] = useState({
    messageCount: 0,
    threadAge: 0,
    lastActivity: Date.now(),
  });

  // Refs for persistence
  const threadsRef = useRef<Map<string, AssistantThread>>(new Map());
  const lastToolCallsRef = useRef<Map<string, any>>(new Map());

  // Enhanced chat hook with assistant-specific configuration
  const chat = useChatEnhanced({
    ...chatOptions,
    api,
    id: threadId ?? undefined,
    maxSteps: 5, // Allow multi-step tool executions
    headers: {
      'Assistant-ID': assistantId,
      'Thread-ID': threadId ?? '',
      ...chatOptions.headers,
    },
    body: {
      assistantId,
      threadId,
      instructions,
      tools: tools.map((tool) => ({
        type: tool.type,
        function: {
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        },
      })),
      ...chatOptions.body,
    },
    onToolCall: async (toolCall) => {
      const tool = tools.find((t) => t.function.name === toolCall.toolName);

      if (tool) {
        try {
          // Store tool call for potential retry
          lastToolCallsRef.current.set(toolCall.toolCallId, toolCall);

          // Execute the tool
          const result = await tool.function.execute(toolCall.args);

          // Update last activity
          setMetrics((prev) => ({ ...prev, lastActivity: Date.now() }));

          onToolCall?.(toolCall);
          return result;
        } catch (error) {
          console.error(
            `Tool execution failed for ${tool.function.name}:`,
            error
          );
          toast.error(
            `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          throw error;
        }
      } else {
        console.warn(`Tool ${toolCall.toolName} not found`);
        return null;
      }
    },
    onFinish: (message, options) => {
      // Update metrics
      setMetrics((prev) => ({
        messageCount: prev.messageCount + 1,
        threadAge: threadId
          ? Date.now() - (thread?.createdAt ?? Date.now())
          : 0,
        lastActivity: Date.now(),
      }));

      // Update thread if persistent
      if (persistent && threadId && thread) {
        const updatedThread = {
          ...thread,
          messages: chat.messages,
          updatedAt: Date.now(),
        };
        setThread(updatedThread);
        threadsRef.current.set(threadId, updatedThread);

        // Save to localStorage
        localStorage.setItem(
          `assistant-thread-${threadId}`,
          JSON.stringify(updatedThread)
        );
      }

      onFinish?.(message);
    },
    onError: (error) => {
      console.error('Assistant error:', error);
      onError?.(error);
    },
    onResponse,
    maxRetries,
    timeout,
  });

  // Create a new thread
  const createThread = useCallback(
    async (metadata?: Record<string, any>): Promise<string> => {
      const newThreadId = `thread-${assistantId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newThread: AssistantThread = {
        id: newThreadId,
        messages: [],
        metadata,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setThreadId(newThreadId);
      setThread(newThread);
      threadsRef.current.set(newThreadId, newThread);

      // Save to localStorage if persistent
      if (persistent) {
        localStorage.setItem(
          `assistant-thread-${newThreadId}`,
          JSON.stringify(newThread)
        );
      }

      // Clear chat messages
      chat.setMessages([]);

      toast.success('New thread created');
      return newThreadId;
    },
    [assistantId, persistent, chat]
  );

  // Load an existing thread
  const loadThread = useCallback(
    async (targetThreadId: string): Promise<void> => {
      try {
        // Try to load from memory first
        let targetThread = threadsRef.current.get(targetThreadId);

        // If not in memory, try localStorage
        if (!targetThread && persistent) {
          const saved = localStorage.getItem(
            `assistant-thread-${targetThreadId}`
          );
          if (saved) {
            targetThread = JSON.parse(saved);
            if (targetThread) {
              threadsRef.current.set(targetThreadId, targetThread);
            }
          }
        }

        if (targetThread) {
          setThreadId(targetThreadId);
          setThread(targetThread);
          chat.setMessages(targetThread.messages);

          // Update metrics
          setMetrics({
            messageCount: targetThread.messages.length,
            threadAge: Date.now() - targetThread.createdAt,
            lastActivity: targetThread.updatedAt,
          });

          toast.success('Thread loaded');
        } else {
          throw new Error('Thread not found');
        }
      } catch (error) {
        console.error('Load thread error:', error);
        toast.error('Failed to load thread');
      }
    },
    [persistent, chat]
  );

  // Delete a thread
  const deleteThread = useCallback(
    async (targetThreadId: string): Promise<void> => {
      try {
        threadsRef.current.delete(targetThreadId);

        if (persistent) {
          localStorage.removeItem(`assistant-thread-${targetThreadId}`);
        }

        // If deleting current thread, create a new one
        if (targetThreadId === threadId) {
          if (autoCreateThread) {
            await createThread();
          } else {
            setThreadId(null);
            setThread(null);
            chat.setMessages([]);
          }
        }

        toast.success('Thread deleted');
      } catch (error) {
        console.error('Delete thread error:', error);
        toast.error('Failed to delete thread');
      }
    },
    [threadId, persistent, autoCreateThread, createThread, chat]
  );

  // Update thread metadata
  const updateThreadMetadata = useCallback(
    async (metadata: Record<string, any>): Promise<void> => {
      if (!(threadId && thread)) return;

      const updatedThread = {
        ...thread,
        metadata: { ...thread.metadata, ...metadata },
        updatedAt: Date.now(),
      };

      setThread(updatedThread);
      threadsRef.current.set(threadId, updatedThread);

      if (persistent) {
        localStorage.setItem(
          `assistant-thread-${threadId}`,
          JSON.stringify(updatedThread)
        );
      }
    },
    [threadId, thread, persistent]
  );

  // Submit a message to the assistant
  const submitMessage = useCallback(
    async (content: string, options?: ChatRequestOptions): Promise<void> => {
      // Create thread if none exists
      if (!threadId && autoCreateThread) {
        await createThread();
      }

      if (!threadId) {
        throw new Error('No thread available and autoCreateThread is disabled');
      }

      // Add user message and get assistant response
      await chat.append(content, {
        ...options,
        headers: {
          'Assistant-ID': assistantId,
          'Thread-ID': threadId,
          ...options?.headers,
        },
      });
    },
    [threadId, autoCreateThread, createThread, chat, assistantId]
  );

  // Append a message without triggering assistant response
  const appendMessage = useCallback(
    async (message: Message): Promise<void> => {
      chat.setMessages((prev) => [...prev, message]);

      // Update thread if persistent
      if (persistent && threadId && thread) {
        const updatedThread = {
          ...thread,
          messages: [...thread.messages, message],
          updatedAt: Date.now(),
        };
        setThread(updatedThread);
        threadsRef.current.set(threadId, updatedThread);
        localStorage.setItem(
          `assistant-thread-${threadId}`,
          JSON.stringify(updatedThread)
        );
      }
    },
    [chat, persistent, threadId, thread]
  );

  // Tool management
  const addTool = useCallback((tool: AssistantTool): void => {
    setTools((prev) => {
      const exists = prev.find((t) => t.function.name === tool.function.name);
      if (exists) {
        return prev.map((t) =>
          t.function.name === tool.function.name ? tool : t
        );
      }
      return [...prev, tool];
    });
  }, []);

  const removeTool = useCallback((toolName: string): void => {
    setTools((prev) => prev.filter((t) => t.function.name !== toolName));
  }, []);

  // File operations (placeholder for future OpenAI Assistants API)
  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      // This would integrate with OpenAI's file upload API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('purpose', 'assistants');

      try {
        const response = await fetch('/api/assistant/upload', {
          method: 'POST',
          body: formData,
          headers: {
            'Assistant-ID': assistantId,
            ...options.headers,
          },
        });

        if (!response.ok) {
          throw new Error('File upload failed');
        }

        const result = await response.json();
        toast.success('File uploaded successfully');
        return result.file_id;
      } catch (error) {
        console.error('File upload error:', error);
        toast.error('Failed to upload file');
        throw error;
      }
    },
    [assistantId, options.headers]
  );

  const deleteFile = useCallback(
    async (fileId: string): Promise<void> => {
      try {
        const response = await fetch(`/api/assistant/files/${fileId}`, {
          method: 'DELETE',
          headers: {
            'Assistant-ID': assistantId,
            ...options.headers,
          },
        });

        if (!response.ok) {
          throw new Error('File deletion failed');
        }

        toast.success('File deleted successfully');
      } catch (error) {
        console.error('File deletion error:', error);
        toast.error('Failed to delete file');
        throw error;
      }
    },
    [assistantId, options.headers]
  );

  // Export thread
  const exportThread = useCallback(
    (format: 'json' | 'markdown' | 'txt'): string => {
      if (!thread) return '';

      switch (format) {
        case 'json':
          return JSON.stringify(thread, null, 2);

        case 'markdown':
          return [
            `# Assistant Thread: ${thread.id}`,
            `Created: ${new Date(thread.createdAt).toLocaleString()}`,
            `Updated: ${new Date(thread.updatedAt).toLocaleString()}`,
            '',
            ...thread.messages.map((msg) => {
              const content =
                msg.content ??
                msg.parts
                  ?.filter((p: any) => p.type === 'text')
                  .map((p: any) => p.text)
                  .join('') ??
                '';
              return `## ${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}\n\n${content}\n`;
            }),
          ].join('\n');

        case 'txt':
          return [
            `Assistant Thread: ${thread.id}`,
            `Created: ${new Date(thread.createdAt).toLocaleString()}`,
            `Updated: ${new Date(thread.updatedAt).toLocaleString()}`,
            '',
            ...thread.messages.map((msg) => {
              const content =
                msg.content ??
                msg.parts
                  ?.filter((p: any) => p.type === 'text')
                  .map((p: any) => p.text)
                  .join('') ??
                '';
              return `${msg.role.toUpperCase()}: ${content}`;
            }),
          ].join('\n\n');

        default:
          return '';
      }
    },
    [thread]
  );

  // Search messages
  const searchMessages = useCallback(
    (query: string): Message[] => {
      const searchTerm = query.toLowerCase();
      return chat.messages.filter((msg) => {
        // Handle UIMessage content structure
        let content = '';
        if (msg.content) {
          content = msg.content;
        } else if (msg.parts) {
          content = msg.parts
            .filter((part: any) => part.type === 'text')
            .map((part: any) => part.text)
            .join(' ');
        }
        return (
          content.toLowerCase().includes(searchTerm) ||
          msg.role.toLowerCase().includes(searchTerm)
        );
      });
    },
    [chat.messages]
  );

  // Auto-create thread on mount if needed
  useEffect(() => {
    if (!threadId && autoCreateThread) {
      createThread();
    }
  }, [threadId, autoCreateThread, createThread]);

  return {
    // Core state
    messages: chat.messages,
    isLoading: chat.isLoading,
    error: chat.error,
    status: chat.status,

    // Thread management
    threadId,
    thread,

    // Actions
    submitMessage,
    appendMessage,
    regenerateLastMessage: async () => {
      await chat.reload();
    },
    stop: chat.stop,
    clearMessages: () => chat.setMessages([]),

    // Thread operations
    createThread,
    loadThread,
    deleteThread,
    updateThreadMetadata,

    // Tool management
    tools,
    addTool,
    removeTool,

    // File operations
    uploadFile,
    deleteFile,

    // Advanced features
    exportThread,
    searchMessages,
    retry: chat.retry,

    // State
    metrics,
  };
}
