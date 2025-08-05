import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock fetch
global.fetch = vi.fn();

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}));

// Mock EventSource
global.EventSource = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2,
}));

// Mock AbortController
global.AbortController = vi.fn().mockImplementation(() => ({
  signal: {
    aborted: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
  abort: vi.fn(),
}));

// Mock crypto for ID generation
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'test-uuid-1234-5678-9012'),
    getRandomValues: vi.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
  },
});

// Mock performance API
Object.defineProperty(global, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByType: vi.fn(() => []),
  },
});

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock File and FileReader
global.File = vi.fn().mockImplementation((chunks, filename, options) => ({
  name: filename,
  size: chunks.reduce((acc, chunk) => acc + chunk.length, 0),
  type: options?.type || 'application/octet-stream',
  lastModified: Date.now(),
  slice: vi.fn(),
  stream: vi.fn(),
  text: vi.fn(() => Promise.resolve(chunks.join(''))),
  arrayBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
}));

global.FileReader = vi.fn().mockImplementation(() => ({
  readAsText: vi.fn(),
  readAsDataURL: vi.fn(),
  readAsArrayBuffer: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  result: null,
  error: null,
  readyState: 0,
  EMPTY: 0,
  LOADING: 1,
  DONE: 2,
}));

// Mock Blob
global.Blob = vi.fn().mockImplementation((content, options) => ({
  size: content.reduce((acc, chunk) => acc + chunk.length, 0),
  type: options?.type || '',
  slice: vi.fn(),
  stream: vi.fn(),
  text: vi.fn(() => Promise.resolve(content.join(''))),
  arrayBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
}));

// Mock MediaRecorder
global.MediaRecorder = vi.fn().mockImplementation(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  state: 'inactive',
  mimeType: 'audio/webm',
  stream: null,
}));

// Mock speechSynthesis
Object.defineProperty(global, 'speechSynthesis', {
  value: {
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => []),
    speaking: false,
    pending: false,
    paused: false,
  },
});

// Mock SpeechRecognition
global.SpeechRecognition = vi.fn().mockImplementation(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  abort: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  continuous: false,
  interimResults: false,
  lang: 'en-US',
  maxAlternatives: 1,
}));

global.webkitSpeechRecognition = global.SpeechRecognition;

// Mock navigator
Object.defineProperty(global, 'navigator', {
  value: {
    userAgent: 'test-user-agent',
    language: 'en-US',
    languages: ['en-US', 'en'],
    onLine: true,
    clipboard: {
      writeText: vi.fn(() => Promise.resolve()),
      readText: vi.fn(() => Promise.resolve('test clipboard text')),
    },
    mediaDevices: {
      getUserMedia: vi.fn(() => Promise.resolve({})),
      enumerateDevices: vi.fn(() => Promise.resolve([])),
    },
    geolocation: {
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    },
  },
  writable: true,
});

// Mock console to reduce noise in tests
const originalConsole = { ...console };
beforeAll(() => {
  console.warn = vi.fn();
  console.error = vi.fn();
  console.info = vi.fn();
});

afterAll(() => {
  Object.assign(console, originalConsole);
});

// Setup and cleanup for each test
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();

  // Reset localStorage
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();

  // Reset fetch
  if (vi.isMockFunction(global.fetch)) {
    global.fetch.mockClear();
  }
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllTimers();
});

// Custom test utilities
export const createMockResponse = (data: any, status = 200) => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers(),
    clone: vi.fn(),
  } as Response);
};

export const createMockFile = (
  name: string,
  content: string,
  type = 'text/plain'
) => {
  return new File([content], name, { type });
};

export const createMockMessage = (
  role: 'user' | 'assistant',
  content: string,
  id?: string
) => {
  return {
    id: id || `msg-${Date.now()}-${Math.random()}`,
    role,
    content,
    createdAt: new Date(),
  };
};

export const createMockConversation = (messageCount = 5) => {
  const messages = [];
  for (let i = 0; i < messageCount; i++) {
    messages.push(
      createMockMessage('user', `User message ${i + 1}`),
      createMockMessage('assistant', `Assistant response ${i + 1}`)
    );
  }
  return {
    id: `conv-${Date.now()}`,
    messages,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

export const createMockTool = (
  name: string,
  executeResult: any = 'tool result'
) => {
  return {
    type: 'function' as const,
    function: {
      name,
      description: `Mock tool: ${name}`,
      parameters: { type: 'object', properties: {} },
      execute: vi.fn().mockResolvedValue(executeResult),
    },
  };
};

export const createMockWorkflow = (stepCount = 3) => {
  return {
    id: `workflow-${Date.now()}`,
    name: 'Test Workflow',
    description: 'A test workflow',
    initialStep: 'step-1',
    steps: Array.from({ length: stepCount }, (_, i) => ({
      id: `step-${i + 1}`,
      name: `Step ${i + 1}`,
      type: 'text' as const,
      config: {
        prompt: `Execute step ${i + 1}`,
      },
      status: 'pending' as const,
    })),
    variables: {},
    metadata: {},
  };
};

// Mock API endpoints for testing
export const mockApiEndpoints = {
  chat: '/api/chat',
  completion: '/api/completion',
  assistant: '/api/assistant',
  upload: '/api/assistant/upload',
  workflow: '/api/workflow',
};

// Test data generators
export const generateTestMessages = (count: number) => {
  return Array.from({ length: count }, (_, i) => [
    createMockMessage('user', `Test user message ${i + 1}`),
    createMockMessage('assistant', `Test assistant response ${i + 1}`),
  ]).flat();
};

export const generateTestConversations = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `conv-${i + 1}`,
    name: `Conversation ${i + 1}`,
    messages: generateTestMessages(3),
    createdAt: new Date(Date.now() - (count - i) * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - (count - i) * 12 * 60 * 60 * 1000),
  }));
};

// Performance testing utilities
export const measureHookPerformance = async (
  hookFunction: () => any,
  iterations = 100
) => {
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    hookFunction();
  }

  const endTime = performance.now();
  return {
    totalTime: endTime - startTime,
    averageTime: (endTime - startTime) / iterations,
    iterations,
  };
};

// Memory leak detection
export const checkForMemoryLeaks = () => {
  const initialMemory = (performance as any).measureUserAgentSpecificMemory?.();

  return {
    check: async () => {
      if (!(performance as any).measureUserAgentSpecificMemory) {
        console.warn('Memory measurement not available in test environment');
        return { leaked: false, difference: 0 };
      }

      const currentMemory = await (
        performance as any
      ).measureUserAgentSpecificMemory();
      const difference = currentMemory - (initialMemory || 0);

      return {
        leaked: difference > 1024 * 1024, // 1MB threshold
        difference,
        initial: initialMemory,
        current: currentMemory,
      };
    },
  };
};

// Export common test patterns
export const testPatterns = {
  // Test hook initialization
  initialization: (hookFn: () => any, expectedInitialState: any) => {
    const { result } = hookFn();
    expect(result.current).toMatchObject(expectedInitialState);
  },

  // Test async operations
  asyncOperation: async (
    hookFn: () => any,
    operation: string,
    expectedResult: any
  ) => {
    const { result } = hookFn();

    await act(async () => {
      await result.current[operation]();
    });

    expect(result.current).toMatchObject(expectedResult);
  },

  // Test error handling
  errorHandling: async (
    hookFn: () => any,
    operation: string,
    errorMessage: string
  ) => {
    const { result } = hookFn();

    await act(async () => {
      try {
        await result.current[operation]();
      } catch (error) {
        expect(error.message).toBe(errorMessage);
      }
    });
  },

  // Test cleanup
  cleanup: (hookFn: () => any, cleanupChecks: () => void) => {
    const { unmount } = hookFn();

    act(() => {
      unmount();
    });

    cleanupChecks();
  },
};

export default {
  createMockResponse,
  createMockFile,
  createMockMessage,
  createMockConversation,
  createMockTool,
  createMockWorkflow,
  mockApiEndpoints,
  generateTestMessages,
  generateTestConversations,
  measureHookPerformance,
  checkForMemoryLeaks,
  testPatterns,
};
