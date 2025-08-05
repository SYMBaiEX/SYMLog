import { act, renderHook, waitFor } from '@testing-library/react';
import { DefaultChatTransport } from 'ai';
import { toast } from 'sonner';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';
import { useChatEnhanced } from '../use-chat-enhanced';

// Mock dependencies
vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(),
}));

vi.mock('ai', () => ({
  DefaultChatTransport: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

const mockUseChat = require('@ai-sdk/react').useChat as Mock;
const mockDefaultChatTransport = DefaultChatTransport as Mock;

describe('useChatEnhanced', () => {
  const mockMessages = [
    { id: '1', role: 'user', content: 'Hello' },
    { id: '2', role: 'assistant', content: 'Hi there!' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockDefaultChatTransport.mockImplementation(() => ({}));

    mockUseChat.mockReturnValue({
      messages: mockMessages,
      input: '',
      setInput: vi.fn(),
      isLoading: false,
      error: null,
      append: vi.fn(),
      reload: vi.fn(),
      stop: vi.fn(),
      setMessages: vi.fn(),
      addToolResult: vi.fn(),
      status: 'idle',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic functionality', () => {
    it('should initialize with default transport configuration', () => {
      renderHook(() => useChatEnhanced());

      expect(mockDefaultChatTransport).toHaveBeenCalledWith({
        api: '/api/chat',
        headers: {},
        body: undefined,
        credentials: undefined,
        prepareSendMessagesRequest: undefined,
      });
    });

    it('should initialize with custom transport configuration', () => {
      const customHeaders = { Authorization: 'Bearer token' };
      const customBody = { model: 'gpt-4' };

      renderHook(() =>
        useChatEnhanced({
          api: '/api/custom-chat',
          headers: customHeaders,
          body: customBody,
          credentials: 'include',
        })
      );

      expect(mockDefaultChatTransport).toHaveBeenCalledWith({
        api: '/api/custom-chat',
        headers: customHeaders,
        body: customBody,
        credentials: 'include',
        prepareSendMessagesRequest: undefined,
      });
    });

    it('should generate unique conversation ID', () => {
      const { result: result1 } = renderHook(() => useChatEnhanced());
      const { result: result2 } = renderHook(() => useChatEnhanced());

      expect(result1.current.conversationId).toBeDefined();
      expect(result2.current.conversationId).toBeDefined();
      expect(result1.current.conversationId).not.toBe(
        result2.current.conversationId
      );
    });

    it('should use provided ID as conversation ID', () => {
      const customId = 'custom-chat-id';
      const { result } = renderHook(() => useChatEnhanced({ id: customId }));

      expect(result.current.conversationId).toBe(customId);
    });
  });

  describe('Message handling', () => {
    it('should send messages with enhanced context', async () => {
      const append = vi.fn();
      mockUseChat.mockReturnValue({
        messages: mockMessages,
        input: '',
        setInput: vi.fn(),
        isLoading: false,
        error: null,
        append,
        reload: vi.fn(),
        stop: vi.fn(),
        setMessages: vi.fn(),
        addToolResult: vi.fn(),
        status: 'idle',
      });

      const { result } = renderHook(() => useChatEnhanced());

      await act(async () => {
        result.current.sendMessage(
          { text: 'Hello' },
          {
            headers: { 'Custom-Header': 'value' },
          }
        );
      });

      expect(append).toHaveBeenCalledWith('Hello', {
        headers: { 'Custom-Header': 'value' },
      });
    });

    it('should append messages with step history tracking', async () => {
      const append = vi.fn();
      mockUseChat.mockReturnValue({
        messages: mockMessages,
        input: '',
        setInput: vi.fn(),
        isLoading: false,
        error: null,
        append,
        reload: vi.fn(),
        stop: vi.fn(),
        setMessages: vi.fn(),
        addToolResult: vi.fn(),
        status: 'idle',
      });

      const { result } = renderHook(() => useChatEnhanced({ maxSteps: 3 }));

      await act(async () => {
        await result.current.append('Test message');
      });

      expect(append).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'user',
          content: 'Test message',
        }),
        undefined
      );
      expect(result.current.stepHistory).toHaveLength(1);
      expect(result.current.stepHistory[0]).toHaveLength(1);
    });
  });

  describe('Error handling and retry logic', () => {
    it('should handle automatic retry on error', async () => {
      let callCount = 0;
      const append = vi.fn();

      mockUseChat.mockImplementation((config) => {
        callCount++;

        // Simulate error on first call, success on second
        if (callCount === 1) {
          setTimeout(() => {
            config.onError?.(new Error('Network error'));
          }, 0);
        } else {
          setTimeout(() => {
            config.onFinish?.(
              { id: '3', role: 'assistant', content: 'Success' },
              { usage: { totalTokens: 10 }, finishReason: 'stop' }
            );
          }, 0);
        }

        return {
          messages: mockMessages,
          input: '',
          setInput: vi.fn(),
          isLoading: callCount === 1,
          error: callCount === 1 ? new Error('Network error') : null,
          append,
          reload: vi.fn(),
          stop: vi.fn(),
          setMessages: vi.fn(),
          addToolResult: vi.fn(),
          status: callCount === 1 ? 'error' : 'ready',
        };
      });

      const onError = vi.fn();
      const { result } = renderHook(() =>
        useChatEnhanced({
          maxRetries: 2,
          retryDelay: 100,
          onError,
        })
      );

      await act(async () => {
        await result.current.append('Test message');
      });

      // Wait for retry
      await waitFor(() => {
        expect(result.current.canRetry).toBe(true);
      });

      // Fast-forward retry delay
      act(() => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(
        () => {
          expect(append).toHaveBeenCalledTimes(2);
        },
        { timeout: 1000 }
      );
    });

    it('should handle manual retry', async () => {
      const append = vi.fn();
      mockUseChat.mockReturnValue({
        messages: mockMessages,
        input: '',
        setInput: vi.fn(),
        isLoading: false,
        error: new Error('Test error'),
        append,
        reload: vi.fn(),
        stop: vi.fn(),
        setMessages: vi.fn(),
        addToolResult: vi.fn(),
        status: 'error',
      });

      const { result } = renderHook(() => useChatEnhanced());

      // Send initial message
      await act(async () => {
        await result.current.append('Test message');
      });

      // Manual retry
      act(() => {
        result.current.retry();
      });

      expect(append).toHaveBeenCalledTimes(2);
    });

    it('should handle retry with modifications', async () => {
      const append = vi.fn();
      mockUseChat.mockReturnValue({
        messages: mockMessages,
        input: '',
        setInput: vi.fn(),
        isLoading: false,
        error: null,
        append,
        reload: vi.fn(),
        stop: vi.fn(),
        setMessages: vi.fn(),
        addToolResult: vi.fn(),
        status: 'idle',
      });

      const { result } = renderHook(() => useChatEnhanced());

      // Send initial message
      await act(async () => {
        await result.current.append('Original message');
      });

      // Retry with modifications
      act(() => {
        result.current.retryWithModifications('Please be more specific');
      });

      expect(append).toHaveBeenLastCalledWith(
        expect.objectContaining({
          content:
            'Original message\n\nAdditional instructions: Please be more specific',
        })
      );
    });
  });

  describe('Performance metrics', () => {
    it('should track response metrics', async () => {
      mockUseChat.mockImplementation((config) => {
        // Simulate successful completion after delay
        setTimeout(() => {
          config.onFinish?.(
            { id: '3', role: 'assistant', content: 'Response' },
            { usage: { totalTokens: 25 }, finishReason: 'stop' }
          );
        }, 100);

        return {
          messages: mockMessages,
          input: '',
          setInput: vi.fn(),
          isLoading: true,
          error: null,
          append: vi.fn(),
          reload: vi.fn(),
          stop: vi.fn(),
          setMessages: vi.fn(),
          addToolResult: vi.fn(),
          status: 'streaming',
        };
      });

      const { result } = renderHook(() => useChatEnhanced());

      await act(async () => {
        await result.current.append('Test message');
      });

      // Fast-forward time to complete the request
      act(() => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(result.current.metrics.messageCount).toBe(1);
        expect(result.current.metrics.totalTokens).toBe(25);
        expect(result.current.metrics.averageResponseTime).toBeGreaterThan(0);
      });
    });

    it('should track error rate', async () => {
      mockUseChat.mockImplementation((config) => {
        // Simulate error
        setTimeout(() => {
          config.onError?.(new Error('Test error'));
        }, 50);

        return {
          messages: mockMessages,
          input: '',
          setInput: vi.fn(),
          isLoading: true,
          error: null,
          append: vi.fn(),
          reload: vi.fn(),
          stop: vi.fn(),
          setMessages: vi.fn(),
          addToolResult: vi.fn(),
          status: 'streaming',
        };
      });

      const { result } = renderHook(() => useChatEnhanced());

      await act(async () => {
        await result.current.append('Test message');
      });

      // Fast-forward time to trigger error
      act(() => {
        vi.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(result.current.metrics.errorRate).toBe(1); // 1 error out of 1 request
      });
    });
  });

  describe('Conversation persistence', () => {
    it('should save conversation to localStorage', async () => {
      const mockSetItem = vi.spyOn(Storage.prototype, 'setItem');

      const { result } = renderHook(() => useChatEnhanced());

      await act(async () => {
        await result.current.saveConversation();
      });

      expect(mockSetItem).toHaveBeenCalledWith(
        `conversation-${result.current.conversationId}`,
        expect.stringContaining('"messages"')
      );
      expect(result.current.hasUnsavedChanges).toBe(false);
      expect(toast.success).toHaveBeenCalledWith('Conversation saved');

      mockSetItem.mockRestore();
    });

    it('should load conversation from localStorage', async () => {
      const conversationData = {
        id: 'test-conversation',
        messages: mockMessages,
        metrics: {
          messageCount: 2,
          totalTokens: 50,
          averageResponseTime: 100,
          errorRate: 0,
        },
        stepHistory: [],
        timestamp: Date.now(),
      };

      const mockGetItem = vi.spyOn(Storage.prototype, 'getItem');
      mockGetItem.mockReturnValue(JSON.stringify(conversationData));

      const setMessages = vi.fn();
      mockUseChat.mockReturnValue({
        messages: [],
        input: '',
        setInput: vi.fn(),
        isLoading: false,
        error: null,
        append: vi.fn(),
        reload: vi.fn(),
        stop: vi.fn(),
        setMessages,
        addToolResult: vi.fn(),
        status: 'idle',
      });

      const { result } = renderHook(() => useChatEnhanced());

      await act(async () => {
        await result.current.loadConversation('test-conversation');
      });

      expect(mockGetItem).toHaveBeenCalledWith(
        'conversation-test-conversation'
      );
      expect(setMessages).toHaveBeenCalledWith(conversationData.messages);
      expect(result.current.metrics.messageCount).toBe(2);
      expect(toast.success).toHaveBeenCalledWith('Conversation loaded');

      mockGetItem.mockRestore();
    });

    it('should export conversation in different formats', () => {
      const { result } = renderHook(() => useChatEnhanced());

      // JSON export
      const jsonExport = result.current.exportConversation('json');
      expect(jsonExport).toContain('"messages"');
      expect(jsonExport).toContain('"metrics"');

      // Markdown export
      const markdownExport = result.current.exportConversation('markdown');
      expect(markdownExport).toContain('## User');
      expect(markdownExport).toContain('## Assistant');

      // Text export
      const textExport = result.current.exportConversation('txt');
      expect(textExport).toContain('USER: Hello');
      expect(textExport).toContain('ASSISTANT: Hi there!');
    });
  });

  describe('Timeout handling', () => {
    it('should handle request timeout', async () => {
      const stop = vi.fn();
      const onError = vi.fn();

      mockUseChat.mockReturnValue({
        messages: mockMessages,
        input: '',
        setInput: vi.fn(),
        isLoading: true,
        error: null,
        append: vi.fn(),
        reload: vi.fn(),
        stop,
        setMessages: vi.fn(),
        addToolResult: vi.fn(),
        status: 'streaming',
      });

      const { result } = renderHook(() =>
        useChatEnhanced({
          timeout: 1000,
          onError,
        })
      );

      await act(async () => {
        await result.current.append('Test message');
      });

      // Fast-forward past timeout
      act(() => {
        vi.advanceTimersByTime(1001);
      });

      expect(stop).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Request timed out after 1000ms',
        })
      );
    });

    it('should clear timeout on successful completion', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      mockUseChat.mockImplementation((config) => {
        setTimeout(() => {
          config.onFinish?.(
            { id: '3', role: 'assistant', content: 'Success' },
            { usage: { totalTokens: 10 }, finishReason: 'stop' }
          );
        }, 100);

        return {
          messages: mockMessages,
          input: '',
          setInput: vi.fn(),
          isLoading: false,
          error: null,
          append: vi.fn(),
          reload: vi.fn(),
          stop: vi.fn(),
          setMessages: vi.fn(),
          addToolResult: vi.fn(),
          status: 'ready',
        };
      });

      const { result } = renderHook(() => useChatEnhanced({ timeout: 1000 }));

      await act(async () => {
        await result.current.append('Test message');
      });

      // Fast-forward to completion
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('Tool execution', () => {
    it('should handle tool calls with error handling', async () => {
      const onToolCall = vi.fn().mockResolvedValue('tool result');

      mockUseChat.mockImplementation((config) => {
        // Simulate tool call
        const toolCall = {
          toolCallId: 'test-tool',
          toolName: 'testTool',
          args: { param: 'value' },
        };

        setTimeout(() => {
          config.onToolCall?.(toolCall);
        }, 50);

        return {
          messages: mockMessages,
          input: '',
          setInput: vi.fn(),
          isLoading: false,
          error: null,
          append: vi.fn(),
          reload: vi.fn(),
          stop: vi.fn(),
          setMessages: vi.fn(),
          addToolResult: vi.fn(),
          status: 'idle',
        };
      });

      renderHook(() => useChatEnhanced({ onToolCall }));

      // Fast-forward to trigger tool call
      act(() => {
        vi.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(onToolCall).toHaveBeenCalled();
      });
    });

    it('should handle tool execution errors', async () => {
      const onToolCall = vi
        .fn()
        .mockRejectedValue(new Error('Tool execution failed'));

      mockUseChat.mockImplementation((config) => {
        const toolCall = {
          toolCallId: 'test-tool',
          toolName: 'failingTool',
          args: { param: 'value' },
        };

        setTimeout(async () => {
          try {
            await config.onToolCall?.(toolCall);
          } catch (error) {
            // Error should be handled by the hook
          }
        }, 50);

        return {
          messages: mockMessages,
          input: '',
          setInput: vi.fn(),
          isLoading: false,
          error: null,
          append: vi.fn(),
          reload: vi.fn(),
          stop: vi.fn(),
          setMessages: vi.fn(),
          addToolResult: vi.fn(),
          status: 'idle',
        };
      });

      renderHook(() => useChatEnhanced({ onToolCall }));

      act(() => {
        vi.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Tool execution failed: Tool execution failed'
        );
      });
    });
  });
});
