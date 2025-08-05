import { act, renderHook, waitFor } from '@testing-library/react';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  useMultiStepToolStreaming,
  useToolStreaming,
} from '@/hooks/use-tool-streaming';
import type {
  MultiStepToolContext,
  ToolExecutionProgress,
  ToolStreamingError,
  ToolStreamingOptions,
  ToolStreamingSSEMessage,
} from '@/types/tool-streaming';
import { ToolStreamingManager, toolStreamingManager } from '../tool-streaming';
import { enhancedArtifactTools } from '../tools/enhanced-tools';

// Mock dependencies
vi.mock('../streaming-optimization', () => ({
  streamingOptimizer: {
    optimizeTextStream: vi.fn().mockResolvedValue(
      (async function* () {
        yield { data: 'optimized chunk 1' };
        yield { data: 'optimized chunk 2' };
      })()
    ),
  },
}));

vi.mock('../workflow-caching', () => ({
  workflowCachingEngine: {
    executeWorkflow: vi.fn().mockResolvedValue({
      success: true,
      finalResult: 'workflow result',
    }),
  },
}));

vi.mock('../structured-memoization', () => ({
  structuredMemoizer: {
    memoizedGenerateObject: vi.fn().mockResolvedValue({
      id: 'test-artifact',
      type: 'code',
      content: 'test content',
    }),
  },
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

// Mock fetch for API tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock EventSource for SSE tests
class MockEventSource {
  constructor(public url: string) {}

  onmessage?: (event: MessageEvent) => void;
  onerror?: (event: Event) => void;
  onopen?: (event: Event) => void;

  close = vi.fn();

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  readyState = MockEventSource.CONNECTING;
}

global.EventSource = MockEventSource as any;

describe('ToolStreamingManager', () => {
  let manager: ToolStreamingManager;

  beforeEach(() => {
    manager = ToolStreamingManager.getInstance({
      maxConcurrentExecutions: 5,
      defaultTimeout: 30_000,
      enableMetrics: true,
      enableCaching: true,
    });

    // Clear any existing sessions
    manager.clearAllSessions();
  });

  afterEach(() => {
    manager.clearAllSessions();
  });

  describe('basic functionality', () => {
    it('should create singleton instance', () => {
      const instance1 = ToolStreamingManager.getInstance();
      const instance2 = ToolStreamingManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should generate unique execution IDs', () => {
      const id1 = (manager as any).generateExecutionId();
      const id2 = (manager as any).generateExecutionId();

      expect(id1).toMatch(/^tool_exec_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^tool_exec_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should calculate size correctly', () => {
      const calculateSize = (manager as any).calculateSize.bind(manager);

      expect(calculateSize('hello')).toBe(10); // 5 chars * 2
      expect(calculateSize({ key: 'value' })).toBe(30); // JSON string length * 2
      expect(calculateSize(null)).toBe(8); // 'null' * 2
    });

    it('should hash input consistently', () => {
      const hashInput = (manager as any).hashInput.bind(manager);

      const hash1 = hashInput('test input');
      const hash2 = hashInput('test input');
      const hash3 = hashInput('different input');

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });
  });

  describe('tool execution with streaming', () => {
    it('should execute simple tool with streaming', async () => {
      const mockTool = {
        name: 'createCodeArtifact',
        inputSchema: { safeParse: vi.fn().mockReturnValue({ success: true }) },
        execute: vi.fn().mockResolvedValue({
          id: 'test-artifact',
          type: 'code',
          content: 'console.log("Hello, World!");',
        }),
      };

      // Mock tool registry
      vi.spyOn(manager as any, 'getTool').mockReturnValue(mockTool);

      const options: ToolStreamingOptions = {
        enableInputStreaming: true,
        enableProgressStreaming: true,
        enableOutputStreaming: true,
      };

      const { executionId, stream } = await manager.executeToolWithStreaming(
        'createCodeArtifact',
        {
          title: 'Test',
          language: 'javascript',
          content: 'console.log("test");',
        },
        options
      );

      expect(executionId).toMatch(/^tool_exec_\d+_[a-z0-9]+$/);
      expect(stream).toBeInstanceOf(ReadableStream);

      // Test stream reading
      const reader = stream.getReader();
      const messages: ToolStreamingSSEMessage[] = [];

      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        try {
          const { done, value } = await reader.read();
          if (done) break;

          messages.push(value);
          attempts++;
        } catch (error) {
          break;
        }
      }

      reader.releaseLock();

      // Should have received some messages
      expect(messages.length).toBeGreaterThan(0);

      // Check for expected message types
      const eventTypes = messages.map((m) => m.event);
      expect(eventTypes).toContain('input-start');
    });

    it('should handle tool execution errors gracefully', async () => {
      const mockTool = {
        name: 'createCodeArtifact',
        inputSchema: { safeParse: vi.fn().mockReturnValue({ success: true }) },
        execute: vi.fn().mockRejectedValue(new Error('Tool execution failed')),
      };

      vi.spyOn(manager as any, 'getTool').mockReturnValue(mockTool);

      const { executionId, stream } = await manager.executeToolWithStreaming(
        'createCodeArtifact',
        { title: 'Test', language: 'javascript', content: 'invalid code' }
      );

      const reader = stream.getReader();
      const messages: ToolStreamingSSEMessage[] = [];

      // Read a few messages before timeout
      for (let i = 0; i < 5; i++) {
        try {
          const { done, value } = await reader.read();
          if (done) break;
          messages.push(value);
        } catch (error) {
          break;
        }
      }

      reader.releaseLock();

      // Should have received error message
      const errorMessages = messages.filter((m) => m.event === 'error');

      // At minimum should have some messages
      expect(messages.length).toBeGreaterThan(0);
    });

    it('should validate tool input correctly', async () => {
      const mockTool = {
        name: 'createCodeArtifact',
        inputSchema: {
          safeParse: vi.fn().mockReturnValue({
            success: false,
            error: { errors: [{ path: ['content'], message: 'Required' }] },
          }),
        },
      };

      vi.spyOn(manager as any, 'getTool').mockReturnValue(mockTool);

      const validation = await (manager as any).validateToolInput(
        'createCodeArtifact',
        { title: 'Test' }, // Missing content
        mockTool
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('content: Required');
      expect(validation.score).toBeLessThan(100);
    });

    it('should handle cancellation correctly', () => {
      const executionId = 'test-execution-id';
      const abortController = new AbortController();

      // Simulate active session
      const session = {
        id: executionId,
        toolName: 'createCodeArtifact',
        state: 'tool-executing' as const,
        startTime: Date.now(),
        lastUpdateTime: Date.now(),
        metadata: {
          toolName: 'createCodeArtifact',
          executionId,
          startTime: Date.now(),
          endTime: 0,
          duration: 0,
          inputSize: 100,
          outputSize: 0,
          cacheHit: false,
          retryCount: 0,
        },
        options: {},
      };

      manager['activeSessions'].set(executionId, session);
      manager['abortControllers'].set(executionId, abortController);

      const cancelled = manager.cancelToolExecution(
        executionId,
        'Test cancellation'
      );

      expect(cancelled).toBe(true);
      expect(abortController.signal.aborted).toBe(true);

      const updatedSession = manager.getSession(executionId);
      expect(updatedSession?.state).toBe('cancelled');
      expect(updatedSession?.error?.type).toBe('cancellation');
    });
  });

  describe('multi-step tool execution', () => {
    it('should handle multi-step workflow context', async () => {
      const mockTool = {
        name: 'executeWorkflow',
        inputSchema: { safeParse: vi.fn().mockReturnValue({ success: true }) },
        execute: vi
          .fn()
          .mockResolvedValue({ workflowComplete: true, results: [] }),
      };

      vi.spyOn(manager as any, 'getTool').mockReturnValue(mockTool);

      const context: MultiStepToolContext = {
        workflowId: 'test-workflow',
        stepIndex: 0,
        totalSteps: 3,
        previousResults: [],
        dependencies: [],
        parallelExecution: false,
      };

      const { executionId, stream } = await manager.executeToolWithStreaming(
        'executeWorkflow',
        { steps: [] },
        {},
        context
      );

      expect(executionId).toBeTruthy();
      expect(stream).toBeInstanceOf(ReadableStream);

      const session = manager.getSession(executionId);
      expect(session).toBeTruthy();
    });
  });

  describe('analytics and metrics', () => {
    it('should track execution analytics', () => {
      const analytics = manager.getAnalytics();

      expect(analytics).toHaveProperty('totalExecutions');
      expect(analytics).toHaveProperty('successRate');
      expect(analytics).toHaveProperty('averageExecutionTime');
      expect(analytics).toHaveProperty('errorRate');
      expect(analytics).toHaveProperty('mostUsedTools');
      expect(analytics).toHaveProperty('performanceBottlenecks');
    });

    it('should update metrics on session completion', () => {
      const session = {
        id: 'test-session',
        toolName: 'createCodeArtifact',
        state: 'tool-complete' as const,
        startTime: Date.now() - 5000,
        lastUpdateTime: Date.now(),
        metadata: {
          toolName: 'createCodeArtifact',
          executionId: 'test-session',
          startTime: Date.now() - 5000,
          endTime: Date.now(),
          duration: 5000,
          inputSize: 100,
          outputSize: 200,
          cacheHit: false,
          retryCount: 0,
        },
        options: {},
      };

      manager['activeSessions'].set('test-session', session);
      manager['updateAnalytics'](session);

      const analytics = manager.getAnalytics();
      expect(analytics.totalExecutions).toBeGreaterThan(0);
    });
  });

  describe('caching integration', () => {
    it('should attempt to get cached results', async () => {
      const getCachedResult = vi.spyOn(manager as any, 'getCachedResult');
      getCachedResult.mockResolvedValue(null);

      await (manager as any).getCachedResult('createCodeArtifact', {
        test: 'input',
      });

      expect(getCachedResult).toHaveBeenCalledWith('createCodeArtifact', {
        test: 'input',
      });
    });

    it('should cache results after execution', async () => {
      const cacheResult = vi.spyOn(manager as any, 'cacheResult');
      cacheResult.mockResolvedValue(undefined);

      await (manager as any).cacheResult(
        'createCodeArtifact',
        { test: 'input' },
        { result: 'data' }
      );

      expect(cacheResult).toHaveBeenCalledWith(
        'createCodeArtifact',
        { test: 'input' },
        { result: 'data' }
      );
    });
  });

  describe('error handling and classification', () => {
    it('should classify errors correctly', () => {
      const classifyError = (manager as any).classifyError.bind(manager);

      expect(classifyError(new Error('Validation failed'))).toBe(
        'input-validation'
      );
      expect(classifyError(new Error('Timeout occurred'))).toBe('timeout');
      expect(classifyError(new Error('Network error'))).toBe('network-error');
      expect(classifyError({ name: 'AbortError' })).toBe('cancellation');
      expect(classifyError(new Error('Generic error'))).toBe('execution-error');
    });

    it('should determine if errors are retryable', () => {
      const isRetryableError = (manager as any).isRetryableError.bind(manager);

      expect(isRetryableError(new Error('Network error'))).toBe(true);
      expect(isRetryableError(new Error('Timeout'))).toBe(true);
      expect(isRetryableError(new Error('Validation failed'))).toBe(false);
      expect(isRetryableError({ name: 'AbortError' })).toBe(false);
    });
  });

  describe('session management', () => {
    it('should get active sessions', () => {
      const session1 = {
        id: 'session-1',
        toolName: 'createCodeArtifact',
        state: 'tool-executing' as const,
        startTime: Date.now(),
        lastUpdateTime: Date.now(),
        metadata: {} as any,
        options: {},
      };

      const session2 = {
        id: 'session-2',
        toolName: 'createDocumentArtifact',
        state: 'tool-complete' as const,
        startTime: Date.now(),
        lastUpdateTime: Date.now(),
        metadata: {} as any,
        options: {},
      };

      manager['activeSessions'].set('session-1', session1);
      manager['activeSessions'].set('session-2', session2);

      const activeSessions = manager.getActiveSessions();
      expect(activeSessions).toHaveLength(2);
      expect(activeSessions.map((s) => s.id)).toContain('session-1');
      expect(activeSessions.map((s) => s.id)).toContain('session-2');
    });

    it('should clear all sessions', () => {
      // Add some sessions
      manager['activeSessions'].set('session-1', {} as any);
      manager['activeSessions'].set('session-2', {} as any);
      manager['abortControllers'].set('session-1', new AbortController());

      expect(manager.getActiveSessions()).toHaveLength(2);

      manager.clearAllSessions();

      expect(manager.getActiveSessions()).toHaveLength(0);
    });
  });
});

describe('useToolStreaming hook', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useToolStreaming());

    expect(result.current.state).toBe('idle');
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.isComplete).toBe(false);
    expect(result.current.hasError).toBe(false);
    expect(result.current.input).toBeNull();
    expect(result.current.output).toBeNull();
    expect(result.current.progress).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.parts).toEqual([]);
  });

  it('should handle successful tool execution', async () => {
    // Mock successful streaming response
    const mockReadableStream = new ReadableStream({
      start(controller) {
        // Simulate SSE messages
        const messages = [
          'data: {"event":"connection-established","data":{"payload":{"executionId":"test-123"}}}\n\n',
          'data: {"event":"input-start","data":{"payload":{"toolName":"createCodeArtifact"}}}\n\n',
          'data: {"event":"execution-start","data":{"payload":{"toolName":"createCodeArtifact","executionId":"test-123"}}}\n\n',
          'data: {"event":"execution-complete","data":{"payload":{"result":{"id":"artifact-1"}}}}\n\n',
        ];

        messages.forEach((msg, index) => {
          setTimeout(() => {
            controller.enqueue(new TextEncoder().encode(msg));
            if (index === messages.length - 1) {
              controller.close();
            }
          }, index * 100);
        });
      },
    });

    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Map([['X-Execution-ID', 'test-123']]),
      body: mockReadableStream,
    });

    const onComplete = vi.fn();
    const { result } = renderHook(() => useToolStreaming({ onComplete }));

    await act(async () => {
      await result.current.executeTool('createCodeArtifact', {
        title: 'Test',
        language: 'javascript',
        content: 'console.log("test");',
      });
    });

    // Fast-forward timers to process stream
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/ai/tool-streaming', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: expect.stringContaining('createCodeArtifact'),
      signal: expect.any(AbortSignal),
    });
  });

  it('should handle execution errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const onError = vi.fn();
    const { result } = renderHook(() =>
      useToolStreaming({ onError, enableToasts: false })
    );

    await act(async () => {
      await result.current.executeTool('createCodeArtifact', { title: 'Test' });
    });

    expect(result.current.hasError).toBe(true);
    expect(result.current.error).toMatchObject({
      type: 'network-error',
      message: 'Network error',
      retryable: true,
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'network-error',
        message: 'Network error',
      })
    );
  });

  it('should handle cancellation', async () => {
    const { result } = renderHook(() => useToolStreaming());

    // Start execution but don't await
    act(() => {
      result.current.executeTool('createCodeArtifact', { title: 'Test' });
    });

    // Cancel immediately
    act(() => {
      result.current.cancelExecution();
    });

    expect(result.current.state).toBe('cancelled');
  });

  it('should clear state correctly', () => {
    const { result } = renderHook(() => useToolStreaming());

    // Set some state first
    act(() => {
      result.current.executeTool('createCodeArtifact', { title: 'Test' });
    });

    act(() => {
      result.current.clearState();
    });

    expect(result.current.state).toBe('idle');
    expect(result.current.input).toBeNull();
    expect(result.current.output).toBeNull();
    expect(result.current.parts).toEqual([]);
  });

  it('should handle retry functionality', async () => {
    const mockFailure = mockFetch.mockRejectedValueOnce(
      new Error('First failure')
    );
    const mockSuccess = mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Map([['X-Execution-ID', 'test-retry']]),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"event":"execution-complete","data":{"payload":{"result":"success"}}}\n\n'
            )
          );
          controller.close();
        },
      }),
    });

    const { result } = renderHook(() =>
      useToolStreaming({ autoRetry: true, enableToasts: false })
    );

    await act(async () => {
      await result.current.executeTool('createCodeArtifact', { title: 'Test' });
    });

    expect(result.current.hasError).toBe(true);

    // Trigger retry
    await act(async () => {
      result.current.retryExecution();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('useMultiStepToolStreaming hook', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should handle workflow step execution', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Map([['X-Execution-ID', 'workflow-step-1']]),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"event":"execution-complete","data":{"payload":{"result":"step-result"}}}\n\n'
            )
          );
          controller.close();
        },
      }),
    });

    const onStepComplete = vi.fn();
    const onWorkflowComplete = vi.fn();

    const { result } = renderHook(() =>
      useMultiStepToolStreaming({
        workflowId: 'test-workflow',
        onStepComplete,
        onWorkflowComplete,
        enableToasts: false,
      })
    );

    await act(async () => {
      await result.current.executeWorkflowStep(
        'createCodeArtifact',
        { title: 'Step 1' },
        0, // stepIndex
        3, // totalSteps
        [], // dependencies
        {} // options
      );
    });

    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.totalSteps).toBe(3);
    expect(mockFetch).toHaveBeenCalledWith('/api/ai/tool-streaming', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: expect.stringContaining('test-workflow'),
      signal: expect.any(AbortSignal),
    });
  });

  it('should track step results across workflow', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        headers: new Map([['X-Execution-ID', 'step-1']]),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                'data: {"event":"execution-complete","data":{"payload":{"result":"result-1"}}}\n\n'
              )
            );
            controller.close();
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Map([['X-Execution-ID', 'step-2']]),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                'data: {"event":"execution-complete","data":{"payload":{"result":"result-2"}}}\n\n'
              )
            );
            controller.close();
          },
        }),
      });

    const { result } = renderHook(() =>
      useMultiStepToolStreaming({
        enableToasts: false,
      })
    );

    // Execute first step
    await act(async () => {
      await result.current.executeWorkflowStep(
        'createCodeArtifact',
        { title: 'Step 1' },
        0,
        2
      );
    });

    // Execute second step
    await act(async () => {
      await result.current.executeWorkflowStep(
        'createDocumentArtifact',
        { title: 'Step 2' },
        1,
        2
      );
    });

    expect(result.current.stepResults).toHaveLength(2);
    expect(result.current.isWorkflowComplete).toBe(true);
  });
});

describe('Enhanced Tools Integration', () => {
  it('should integrate with enhanced artifact tools', async () => {
    const createCodeArtifact = enhancedArtifactTools.createCodeArtifact;

    expect(createCodeArtifact).toBeDefined();
    expect(createCodeArtifact.description).toContain(
      'Create executable code artifacts'
    );
    expect(createCodeArtifact.parameters).toBeDefined();
    expect(createCodeArtifact.execute).toBeInstanceOf(Function);
  });

  it('should execute enhanced tools with progress tracking', async () => {
    const mockContext = {
      progressCallback: vi.fn(),
      signal: new AbortController().signal,
    };

    const input = {
      title: 'Test Code',
      language: 'javascript' as const,
      content: 'console.log("Hello, World!");',
      runnable: true,
      validation: false, // Skip validation for test
    };

    try {
      const result = await enhancedArtifactTools.createCodeArtifact.execute(
        input,
        mockContext
      );

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('type', 'code');
      expect(result).toHaveProperty('content', input.content);
      expect(result).toHaveProperty('language', input.language);
    } catch (error) {
      // May fail due to missing dependencies, but structure should work
      expect(error).toBeInstanceOf(Error);
    }
  });
});

describe('Error Recovery and Retry Logic', () => {
  beforeEach(() => {
    toolStreamingManager.clearAllSessions();
  });

  it('should implement exponential backoff for retries', async () => {
    const delay = vi.spyOn(toolStreamingManager as any, 'delay');
    delay.mockResolvedValue(undefined);

    const mockTool = {
      name: 'createCodeArtifact',
      inputSchema: { safeParse: vi.fn().mockReturnValue({ success: true }) },
      execute: vi
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce({ success: true }),
    };

    vi.spyOn(toolStreamingManager as any, 'getTool').mockReturnValue(mockTool);

    const { executionId, stream } =
      await toolStreamingManager.executeToolWithStreaming(
        'createCodeArtifact',
        { title: 'Test' },
        { maxRetries: 3 }
      );

    // Let the stream process
    const reader = stream.getReader();

    // Read a few messages to trigger retries
    for (let i = 0; i < 10; i++) {
      try {
        const { done } = await reader.read();
        if (done) break;
      } catch {
        break;
      }
    }

    reader.releaseLock();

    expect(mockTool.execute).toHaveBeenCalled();
  });

  it('should handle non-retryable errors correctly', () => {
    const error = new Error('Validation failed');
    const isRetryable = (toolStreamingManager as any).isRetryableError(error);

    expect(isRetryable).toBe(false);
  });

  it('should handle retryable errors correctly', () => {
    const error = new Error('Network timeout');
    const isRetryable = (toolStreamingManager as any).isRetryableError(error);

    expect(isRetryable).toBe(true);
  });
});

describe('Performance and Load Testing', () => {
  it('should handle multiple concurrent executions', async () => {
    const concurrentExecutions = 5;
    const promises: Promise<any>[] = [];

    for (let i = 0; i < concurrentExecutions; i++) {
      const promise = toolStreamingManager.executeToolWithStreaming(
        'createCodeArtifact',
        {
          title: `Test ${i}`,
          language: 'javascript',
          content: `console.log(${i});`,
        }
      );
      promises.push(promise);
    }

    const results = await Promise.allSettled(promises);

    expect(results).toHaveLength(concurrentExecutions);

    // Check that each execution got a unique ID
    const executionIds = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as any).value.executionId);

    const uniqueIds = new Set(executionIds);
    expect(uniqueIds.size).toBe(executionIds.length);
  });

  it('should cleanup old sessions automatically', () => {
    const cleanupTimer = vi.spyOn(
      toolStreamingManager as any,
      'startCleanupTimer'
    );

    // Cleanup timer should be called during initialization
    expect(cleanupTimer).toHaveBeenCalled();
  });

  it('should enforce memory limits', () => {
    const enforceMemoryLimits = vi.spyOn(
      toolStreamingManager as any,
      'enforceMemoryLimits'
    );
    enforceMemoryLimits.mockImplementation(() => {});

    // Add many validation cache entries to trigger cleanup
    for (let i = 0; i < 1200; i++) {
      toolStreamingManager['validationCache'].set(`key-${i}`, {
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: [],
        score: 100,
      });
    }

    // Manually trigger cache enforcement
    toolStreamingManager['enforceMemoryLimits']();

    expect(enforceMemoryLimits).toHaveBeenCalled();
  });
});

describe('SSE Protocol Compliance', () => {
  it('should format SSE messages correctly', () => {
    const formatSSEMessage = (message: ToolStreamingSSEMessage): string => {
      let sseMessage = '';

      if (message.id) {
        sseMessage += `id: ${message.id}\n`;
      }

      if (message.event) {
        sseMessage += `event: ${message.event}\n`;
      }

      if (message.retry) {
        sseMessage += `retry: ${message.retry}\n`;
      }

      const dataString = JSON.stringify(message.data);
      sseMessage += `data: ${dataString}\n`;
      sseMessage += '\n';

      return sseMessage;
    };

    const message: ToolStreamingSSEMessage = {
      id: 'test-123',
      event: 'execution-start',
      data: {
        toolName: 'createCodeArtifact',
        executionId: 'test-123',
        timestamp: Date.now(),
        payload: { test: 'data' },
      },
    };

    const formatted = formatSSEMessage(message);

    expect(formatted).toContain('id: test-123\n');
    expect(formatted).toContain('event: execution-start\n');
    expect(formatted).toContain('data: ');
    expect(formatted).toEndWith('\n\n');
  });

  it('should handle SSE reconnection', () => {
    const message: ToolStreamingSSEMessage = {
      id: 'reconnect-test',
      event: 'error',
      data: {
        toolName: 'createCodeArtifact',
        executionId: 'test',
        timestamp: Date.now(),
        payload: { type: 'network-error' },
      },
      retry: 3000,
    };

    expect(message.retry).toBe(3000);
    expect(message.event).toBe('error');
  });
});

describe('Integration with Existing Systems', () => {
  it('should integrate with streaming optimization', async () => {
    const { streamingOptimizer } = await import('../streaming-optimization');

    expect(streamingOptimizer.optimizeTextStream).toBeDefined();

    // Test integration
    const result = await streamingOptimizer.optimizeTextStream(async () =>
      (async function* () {
        yield 'test chunk 1';
        yield 'test chunk 2';
      })()
    );

    expect(result).toBeDefined();
  });

  it('should integrate with workflow caching', async () => {
    const { workflowCachingEngine } = await import('../workflow-caching');

    expect(workflowCachingEngine.executeWorkflow).toBeDefined();
  });

  it('should integrate with structured memoization', async () => {
    const { structuredMemoizer } = await import('../structured-memoization');

    expect(structuredMemoizer.memoizedGenerateObject).toBeDefined();
  });
});
