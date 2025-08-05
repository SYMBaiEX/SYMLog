import { act, renderHook, waitFor } from '@testing-library/react';
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
import type { AssistantTool } from '../use-assistant';
import { useAssistant } from '../use-assistant';

// Mock dependencies
vi.mock('../use-chat-enhanced', () => ({
  useChatEnhanced: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

const mockUseChatEnhanced = require('../use-chat-enhanced')
  .useChatEnhanced as Mock;

describe('useAssistant', () => {
  const mockMessages = [
    { id: '1', role: 'user', content: 'Hello assistant' },
    { id: '2', role: 'assistant', content: 'Hello! How can I help you today?' },
  ];

  const mockChatHook = {
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
    sendMessage: vi.fn(),
    retry: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockUseChatEnhanced.mockReturnValue(mockChatHook);

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });

    // Mock fetch for file operations
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with required assistant ID', () => {
      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
        })
      );

      expect(result.current.threadId).toBeNull();
      expect(result.current.thread).toBeNull();
      expect(result.current.messages).toEqual(mockMessages);
      expect(result.current.tools).toEqual([]);
      expect(result.current.metrics.messageCount).toBe(0);
    });

    it('should auto-create thread when autoCreateThread is true', async () => {
      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
          autoCreateThread: true,
        })
      );

      await waitFor(() => {
        expect(result.current.threadId).toBeTruthy();
        expect(result.current.thread).toBeTruthy();
      });

      expect(toast.success).toHaveBeenCalledWith('New thread created');
    });

    it('should use provided threadId', () => {
      const customThreadId = 'existing-thread';

      renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
          threadId: customThreadId,
        })
      );

      expect(mockUseChatEnhanced).toHaveBeenCalledWith(
        expect.objectContaining({
          id: customThreadId,
          headers: expect.objectContaining({
            'Thread-ID': customThreadId,
          }),
        })
      );
    });

    it('should initialize with tools', () => {
      const testTools: AssistantTool[] = [
        {
          type: 'function',
          function: {
            name: 'testTool',
            description: 'A test tool',
            parameters: { type: 'object' },
            execute: vi.fn(),
          },
        },
      ];

      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
          tools: testTools,
        })
      );

      expect(result.current.tools).toEqual(testTools);
    });
  });

  describe('Thread management', () => {
    it('should create new thread with metadata', async () => {
      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
          autoCreateThread: false,
        })
      );

      const metadata = { userType: 'premium', sessionId: 'abc123' };
      let threadId: string;

      await act(async () => {
        threadId = await result.current.createThread(metadata);
      });

      expect(threadId).toBeTruthy();
      expect(result.current.threadId).toBe(threadId);
      expect(result.current.thread?.metadata).toEqual(metadata);
      expect(toast.success).toHaveBeenCalledWith('New thread created');
    });

    it('should load existing thread', async () => {
      const mockThread = {
        id: 'existing-thread',
        messages: mockMessages,
        metadata: { test: 'data' },
        createdAt: Date.now() - 10_000,
        updatedAt: Date.now() - 5000,
      };

      vi.mocked(localStorage.getItem).mockReturnValue(
        JSON.stringify(mockThread)
      );

      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
          persistent: true,
        })
      );

      await act(async () => {
        await result.current.loadThread('existing-thread');
      });

      expect(result.current.threadId).toBe('existing-thread');
      expect(result.current.thread).toEqual(mockThread);
      expect(mockChatHook.setMessages).toHaveBeenCalledWith(mockMessages);
      expect(toast.success).toHaveBeenCalledWith('Thread loaded');
    });

    it('should delete thread', async () => {
      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
          autoCreateThread: true,
        })
      );

      // Wait for auto-created thread
      await waitFor(() => {
        expect(result.current.threadId).toBeTruthy();
      });

      const initialThreadId = result.current.threadId;

      await act(async () => {
        await result.current.deleteThread(initialThreadId!);
      });

      expect(localStorage.removeItem).toHaveBeenCalledWith(
        `assistant-thread-${initialThreadId}`
      );
      expect(result.current.threadId).not.toBe(initialThreadId); // Should create new thread
      expect(toast.success).toHaveBeenCalledWith('Thread deleted');
    });

    it('should update thread metadata', async () => {
      const mockSetItem = vi.mocked(localStorage.setItem);

      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
          autoCreateThread: true,
          persistent: true,
        })
      );

      // Wait for thread creation
      await waitFor(() => {
        expect(result.current.threadId).toBeTruthy();
      });

      const newMetadata = { updated: true, timestamp: Date.now() };

      await act(async () => {
        await result.current.updateThreadMetadata(newMetadata);
      });

      expect(result.current.thread?.metadata).toEqual(
        expect.objectContaining(newMetadata)
      );
      expect(mockSetItem).toHaveBeenCalled();
    });
  });

  describe('Message handling', () => {
    it('should submit message to assistant', async () => {
      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
          autoCreateThread: true,
        })
      );

      // Wait for thread creation
      await waitFor(() => {
        expect(result.current.threadId).toBeTruthy();
      });

      await act(async () => {
        await result.current.submitMessage('Hello assistant');
      });

      expect(mockChatHook.append).toHaveBeenCalledWith('Hello assistant', {
        headers: expect.objectContaining({
          'Assistant-ID': 'test-assistant',
          'Thread-ID': result.current.threadId,
        }),
      });
    });

    it('should create thread automatically when submitting message', async () => {
      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
          autoCreateThread: true,
        })
      );

      await act(async () => {
        await result.current.submitMessage('Hello');
      });

      expect(result.current.threadId).toBeTruthy();
      expect(mockChatHook.append).toHaveBeenCalled();
    });

    it('should throw error when no thread and autoCreateThread is false', async () => {
      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
          autoCreateThread: false,
        })
      );

      await expect(async () => {
        await act(async () => {
          await result.current.submitMessage('Hello');
        });
      }).rejects.toThrow(
        'No thread available and autoCreateThread is disabled'
      );
    });

    it('should append message without triggering assistant response', async () => {
      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
          autoCreateThread: true,
          persistent: true,
        })
      );

      // Wait for thread creation
      await waitFor(() => {
        expect(result.current.threadId).toBeTruthy();
      });

      const newMessage = {
        id: '3',
        role: 'user' as const,
        content: 'Manual message',
      };

      await act(async () => {
        await result.current.appendMessage(newMessage);
      });

      expect(mockChatHook.setMessages).toHaveBeenCalledWith(
        expect.any(Function)
      );
      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('Tool management', () => {
    const testTool: AssistantTool = {
      type: 'function',
      function: {
        name: 'calculator',
        description: 'Perform calculations',
        parameters: {
          type: 'object',
          properties: { operation: { type: 'string' } },
        },
        execute: vi.fn().mockResolvedValue(42),
      },
    };

    it('should add tool', () => {
      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
        })
      );

      act(() => {
        result.current.addTool(testTool);
      });

      expect(result.current.tools).toContain(testTool);
    });

    it('should replace existing tool with same name', () => {
      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
          tools: [testTool],
        })
      );

      const updatedTool = {
        ...testTool,
        function: {
          ...testTool.function,
          description: 'Updated calculator',
        },
      };

      act(() => {
        result.current.addTool(updatedTool);
      });

      expect(result.current.tools).toHaveLength(1);
      expect(result.current.tools[0].function.description).toBe(
        'Updated calculator'
      );
    });

    it('should remove tool', () => {
      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
          tools: [testTool],
        })
      );

      act(() => {
        result.current.removeTool('calculator');
      });

      expect(result.current.tools).toHaveLength(0);
    });

    it('should execute tool during chat', async () => {
      const mockOnToolCall = vi.fn();

      mockUseChatEnhanced.mockImplementation((config) => {
        // Simulate tool call
        setTimeout(() => {
          const toolCall = {
            toolCallId: 'call-1',
            toolName: 'calculator',
            args: { operation: 'add', a: 2, b: 3 },
          };
          config.onToolCall?.(toolCall);
        }, 50);

        return mockChatHook;
      });

      renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
          tools: [testTool],
          onToolCall: mockOnToolCall,
        })
      );

      // Fast-forward to trigger tool call
      act(() => {
        vi.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(testTool.function.execute).toHaveBeenCalledWith(
          { operation: 'add', a: 2, b: 3 },
          expect.any(Object)
        );
        expect(mockOnToolCall).toHaveBeenCalled();
      });
    });

    it('should handle tool execution errors', async () => {
      const failingTool: AssistantTool = {
        type: 'function',
        function: {
          name: 'failingTool',
          description: 'This tool fails',
          parameters: { type: 'object' },
          execute: vi.fn().mockRejectedValue(new Error('Tool failed')),
        },
      };

      mockUseChatEnhanced.mockImplementation((config) => {
        setTimeout(async () => {
          const toolCall = {
            toolCallId: 'call-1',
            toolName: 'failingTool',
            args: {},
          };

          try {
            await config.onToolCall?.(toolCall);
          } catch (error) {
            // Error should be handled
          }
        }, 50);

        return mockChatHook;
      });

      renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
          tools: [failingTool],
        })
      );

      act(() => {
        vi.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Tool execution failed: Tool failed'
        );
      });
    });
  });

  describe('File operations', () => {
    it('should upload file successfully', async () => {
      const mockResponse = { file_id: 'file-123' };
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
        })
      );

      const testFile = new File(['test content'], 'test.txt', {
        type: 'text/plain',
      });

      let fileId: string;
      await act(async () => {
        fileId = await result.current.uploadFile(testFile);
      });

      expect(fetch).toHaveBeenCalledWith('/api/assistant/upload', {
        method: 'POST',
        body: expect.any(FormData),
        headers: expect.objectContaining({
          'Assistant-ID': 'test-assistant',
        }),
      });
      expect(fileId!).toBe('file-123');
      expect(toast.success).toHaveBeenCalledWith('File uploaded successfully');
    });

    it('should handle file upload errors', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
        })
      );

      const testFile = new File(['test content'], 'test.txt', {
        type: 'text/plain',
      });

      await expect(async () => {
        await act(async () => {
          await result.current.uploadFile(testFile);
        });
      }).rejects.toThrow('File upload failed');

      expect(toast.error).toHaveBeenCalledWith('Failed to upload file');
    });

    it('should delete file successfully', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
      } as Response);

      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
        })
      );

      await act(async () => {
        await result.current.deleteFile('file-123');
      });

      expect(fetch).toHaveBeenCalledWith('/api/assistant/files/file-123', {
        method: 'DELETE',
        headers: expect.objectContaining({
          'Assistant-ID': 'test-assistant',
        }),
      });
      expect(toast.success).toHaveBeenCalledWith('File deleted successfully');
    });
  });

  describe('Thread export and search', () => {
    it('should export thread in JSON format', async () => {
      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
          autoCreateThread: true,
        })
      );

      // Wait for thread creation
      await waitFor(() => {
        expect(result.current.thread).toBeTruthy();
      });

      const jsonExport = result.current.exportThread('json');
      const parsed = JSON.parse(jsonExport);

      expect(parsed).toHaveProperty('id');
      expect(parsed).toHaveProperty('messages');
      expect(parsed).toHaveProperty('createdAt');
      expect(parsed).toHaveProperty('updatedAt');
    });

    it('should export thread in markdown format', async () => {
      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
          autoCreateThread: true,
        })
      );

      await waitFor(() => {
        expect(result.current.thread).toBeTruthy();
      });

      const markdownExport = result.current.exportThread('markdown');

      expect(markdownExport).toContain('# Assistant Thread:');
      expect(markdownExport).toContain('Created:');
      expect(markdownExport).toContain('## User');
      expect(markdownExport).toContain('## Assistant');
    });

    it('should export thread in text format', async () => {
      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
          autoCreateThread: true,
        })
      );

      await waitFor(() => {
        expect(result.current.thread).toBeTruthy();
      });

      const textExport = result.current.exportThread('txt');

      expect(textExport).toContain('Assistant Thread:');
      expect(textExport).toContain('USER: Hello assistant');
      expect(textExport).toContain(
        'ASSISTANT: Hello! How can I help you today?'
      );
    });

    it('should search messages', () => {
      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
        })
      );

      const searchResults = result.current.searchMessages('hello');

      expect(searchResults).toHaveLength(2); // Both messages contain "hello"
      expect(searchResults[0].content).toContain('Hello');
      expect(searchResults[1].content).toContain('Hello');
    });

    it('should search messages by role', () => {
      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
        })
      );

      const searchResults = result.current.searchMessages('user');

      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].role).toBe('user');
    });
  });

  describe('Metrics tracking', () => {
    it('should update metrics when thread ages', async () => {
      const { result } = renderHook(() =>
        useAssistant({
          assistantId: 'test-assistant',
          autoCreateThread: true,
        })
      );

      // Wait for thread creation
      await waitFor(() => {
        expect(result.current.thread).toBeTruthy();
      });

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(10_000);
      });

      // Simulate activity update
      act(() => {
        result.current.metrics.lastActivity = Date.now();
      });

      expect(result.current.metrics.lastActivity).toBeGreaterThan(0);
    });
  });
});
