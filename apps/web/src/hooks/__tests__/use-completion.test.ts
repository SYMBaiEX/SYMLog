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
import {
  useBatchCompletion,
  useCompletion,
  useStreamingCompletion,
} from '../use-completion';

// Mock dependencies
vi.mock('@ai-sdk/react', () => ({
  useCompletion: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

const mockBaseUseCompletion = vi.fn();
const mockUseCompletion = require('@ai-sdk/react').useCompletion as Mock;

describe('useCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCompletion.mockReturnValue({
      completion: '',
      isLoading: false,
      error: null,
      input: '',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      setInput: vi.fn(),
      setCompletion: vi.fn(),
      stop: vi.fn(),
      complete: vi.fn(),
      data: [],
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Basic functionality', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useCompletion());

      expect(result.current.completion).toBe('');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.status).toBe('idle');
      expect(result.current.retryCount).toBe(0);
      expect(result.current.canRetry).toBe(true);
    });

    it('should handle completion execution', async () => {
      const complete = vi.fn();
      mockUseCompletion.mockReturnValue({
        completion: 'Test completion',
        isLoading: false,
        error: null,
        input: 'test input',
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
        setInput: vi.fn(),
        setCompletion: vi.fn(),
        stop: vi.fn(),
        complete,
        data: [],
      });

      const { result } = renderHook(() => useCompletion());

      act(() => {
        result.current.complete('test prompt');
      });

      expect(complete).toHaveBeenCalledWith('test prompt');
    });

    it('should handle timeout correctly', async () => {
      const onError = vi.fn();
      const complete = vi.fn();

      mockUseCompletion.mockReturnValue({
        completion: '',
        isLoading: true,
        error: null,
        input: '',
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
        setInput: vi.fn(),
        setCompletion: vi.fn(),
        stop: vi.fn(),
        complete,
        data: [],
      });

      const { result } = renderHook(() =>
        useCompletion({
          timeout: 1000,
          onError,
        })
      );

      act(() => {
        result.current.complete('test prompt');
      });

      // Fast-forward time to trigger timeout
      act(() => {
        vi.advanceTimersByTime(1001);
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Request timed out after 1000ms',
        })
      );
    });
  });

  describe('Retry functionality', () => {
    it('should automatically retry on failure', async () => {
      const complete = vi.fn();
      const onError = vi.fn();

      let callCount = 0;
      mockUseCompletion.mockImplementation((options) => {
        callCount++;

        // Simulate failure on first call, success on second
        if (callCount === 1) {
          setTimeout(() => {
            options.onError?.(new Error('Test error'));
          }, 0);
        } else {
          setTimeout(() => {
            options.onFinish?.('prompt', 'completion');
          }, 0);
        }

        return {
          completion: callCount === 1 ? '' : 'Success',
          isLoading: callCount === 1,
          error: callCount === 1 ? new Error('Test error') : null,
          input: '',
          handleInputChange: vi.fn(),
          handleSubmit: vi.fn(),
          setInput: vi.fn(),
          setCompletion: vi.fn(),
          stop: vi.fn(),
          complete,
          data: [],
        };
      });

      const { result } = renderHook(() =>
        useCompletion({
          maxRetries: 2,
          retryDelay: 100,
          onError,
        })
      );

      act(() => {
        result.current.complete('test prompt');
      });

      // Wait for retry
      await waitFor(
        () => {
          expect(result.current.retryCount).toBe(1);
        },
        { timeout: 2000 }
      );

      // Verify retry was attempted
      expect(complete).toHaveBeenCalledTimes(2);
    });

    it('should manual retry', () => {
      const complete = vi.fn();
      mockUseCompletion.mockReturnValue({
        completion: '',
        isLoading: false,
        error: new Error('Test error'),
        input: 'test input',
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
        setInput: vi.fn(),
        setCompletion: vi.fn(),
        stop: vi.fn(),
        complete,
        data: [],
      });

      const { result } = renderHook(() => useCompletion());

      // First completion
      act(() => {
        result.current.complete('test prompt');
      });

      // Manual retry
      act(() => {
        result.current.retry();
      });

      expect(complete).toHaveBeenCalledTimes(2);
    });
  });

  describe('Enhanced features', () => {
    it('should handle retry with modifications', () => {
      const complete = vi.fn();
      mockUseCompletion.mockReturnValue({
        completion: '',
        isLoading: false,
        error: null,
        input: 'original prompt',
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
        setInput: vi.fn(),
        setCompletion: vi.fn(),
        stop: vi.fn(),
        complete,
        data: [],
      });

      const { result } = renderHook(() => useCompletion());

      // First completion
      act(() => {
        result.current.complete('original prompt');
      });

      // Retry with modifications
      act(() => {
        result.current.retryWithModifications('additional context');
      });

      expect(complete).toHaveBeenLastCalledWith(
        'original prompt\n\nAdditional instructions: additional context'
      );
    });

    it('should track performance metrics', async () => {
      mockUseCompletion.mockImplementation((options) => {
        // Simulate completion after delay
        setTimeout(() => {
          options.onFinish?.('prompt', 'completion');
        }, 100);

        return {
          completion: '',
          isLoading: true,
          error: null,
          input: '',
          handleInputChange: vi.fn(),
          handleSubmit: vi.fn(),
          setInput: vi.fn(),
          setCompletion: vi.fn(),
          stop: vi.fn(),
          complete: vi.fn(),
          data: [],
        };
      });

      const { result } = renderHook(() => useCompletion());

      act(() => {
        result.current.complete('test prompt');
      });

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(result.current.metrics.responseTime).toBeGreaterThan(0);
        expect(result.current.metrics.tokensPerSecond).toBeGreaterThan(0);
      });
    });

    it('should validate input length', () => {
      const handleInputChange = vi.fn();
      mockUseCompletion.mockReturnValue({
        completion: '',
        isLoading: false,
        error: null,
        input: '',
        handleInputChange,
        handleSubmit: vi.fn(),
        setInput: vi.fn(),
        setCompletion: vi.fn(),
        stop: vi.fn(),
        complete: vi.fn(),
        data: [],
      });

      const { result } = renderHook(() => useCompletion());

      const longInput = 'x'.repeat(10_001);
      const event = {
        target: { value: longInput },
      } as React.ChangeEvent<HTMLInputElement>;

      act(() => {
        result.current.handleInputChange(event);
      });

      expect(toast.error).toHaveBeenCalledWith(
        'Input too long (max 10,000 characters)'
      );
      expect(handleInputChange).not.toHaveBeenCalled();
    });

    it('should clear state correctly', () => {
      const setCompletion = vi.fn();
      const setInput = vi.fn();

      mockUseCompletion.mockReturnValue({
        completion: 'test completion',
        isLoading: false,
        error: null,
        input: 'test input',
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
        setInput,
        setCompletion,
        stop: vi.fn(),
        complete: vi.fn(),
        data: [],
      });

      const { result } = renderHook(() => useCompletion());

      act(() => {
        result.current.clear();
      });

      expect(setCompletion).toHaveBeenCalledWith('');
      expect(setInput).toHaveBeenCalledWith('');
      expect(result.current.status).toBe('idle');
      expect(result.current.retryCount).toBe(0);
    });
  });
});

describe('useStreamingCompletion', () => {
  it('should handle streaming chunks', async () => {
    const onChunk = vi.fn();

    mockUseCompletion.mockImplementation((options) => {
      // Simulate streaming completion
      setTimeout(() => {
        options.onFinish?.('prompt', 'This is a test completion');
      }, 100);

      return {
        completion: 'This is a test completion',
        isLoading: false,
        error: null,
        input: '',
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
        setInput: vi.fn(),
        setCompletion: vi.fn(),
        stop: vi.fn(),
        complete: vi.fn(),
        data: [],
      };
    });

    const { result } = renderHook(() =>
      useStreamingCompletion({
        onChunk,
        chunkSize: 4,
      })
    );

    act(() => {
      result.current.complete('test prompt');
    });

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(onChunk).toHaveBeenCalled();
      expect(result.current.chunks).toHaveLength(6); // "This is a test completion" split into chunks of 4
    });
  });
});

describe('useBatchCompletion', () => {
  it('should process multiple prompts in sequence', async () => {
    let completionCount = 0;
    const completions = ['First result', 'Second result', 'Third result'];

    mockUseCompletion.mockImplementation((options) => {
      return {
        completion: '',
        isLoading: false,
        error: null,
        input: '',
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
        setInput: vi.fn(),
        setCompletion: vi.fn(),
        stop: vi.fn(),
        complete: vi.fn((prompt) => {
          setTimeout(() => {
            options.onFinish?.(prompt, completions[completionCount]);
            completionCount++;
          }, 50);
        }),
        data: [],
      };
    });

    const { result } = renderHook(() => useBatchCompletion());

    const prompts = ['prompt 1', 'prompt 2', 'prompt 3'];

    act(() => {
      result.current.processBatch(prompts);
    });

    expect(result.current.batchStatus).toBe('processing');
    expect(result.current.prompts).toEqual(prompts);

    // Wait for all completions
    await waitFor(
      () => {
        expect(result.current.batchStatus).toBe('completed');
        expect(result.current.completions).toEqual(completions);
        expect(result.current.progress).toBe(1);
      },
      { timeout: 1000 }
    );
  });

  it('should handle batch errors', async () => {
    mockUseCompletion.mockImplementation((options) => {
      return {
        completion: '',
        isLoading: false,
        error: null,
        input: '',
        handleInputChange: vi.fn(),
        handleSubmit: vi.fn(),
        setInput: vi.fn(),
        setCompletion: vi.fn(),
        stop: vi.fn(),
        complete: vi.fn(() => {
          setTimeout(() => {
            options.onError?.(new Error('Batch error'));
          }, 50);
        }),
        data: [],
      };
    });

    const { result } = renderHook(() => useBatchCompletion());

    act(() => {
      result.current.processBatch(['prompt 1']);
    });

    await waitFor(() => {
      expect(result.current.batchStatus).toBe('error');
    });
  });

  it('should stop batch processing', () => {
    const stop = vi.fn();
    mockUseCompletion.mockReturnValue({
      completion: '',
      isLoading: true,
      error: null,
      input: '',
      handleInputChange: vi.fn(),
      handleSubmit: vi.fn(),
      setInput: vi.fn(),
      setCompletion: vi.fn(),
      stop,
      complete: vi.fn(),
      data: [],
    });

    const { result } = renderHook(() => useBatchCompletion());

    act(() => {
      result.current.processBatch(['prompt 1', 'prompt 2']);
    });

    act(() => {
      result.current.stopBatch();
    });

    expect(stop).toHaveBeenCalled();
    expect(result.current.batchStatus).toBe('idle');
  });
});
