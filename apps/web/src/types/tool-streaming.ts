// ToolInvocation type is not exported from 'ai' - using local definition
import type { z } from 'zod';

// Tool streaming state types
export type ToolStreamingState =
  | 'idle'
  | 'input-parsing'
  | 'input-available'
  | 'tool-executing'
  | 'tool-progress'
  | 'tool-complete'
  | 'error'
  | 'cancelled';

// Tool execution progress details
export interface ToolExecutionProgress {
  toolName: string;
  executionId: string;
  stage: string;
  progress: number; // 0-100
  message?: string;
  estimatedTimeRemaining?: number;
  metadata?: Record<string, any>;
  timestamp: number;
}

// Tool execution metadata
export interface ToolExecutionMetadata {
  toolName: string;
  executionId: string;
  startTime: number;
  endTime: number;
  duration: number;
  inputSize: number;
  outputSize: number;
  cacheHit: boolean;
  retryCount: number;
  performanceMetrics?: {
    cpuTime?: number;
    memoryUsed?: number;
    networkLatency?: number;
  };
  validationResults?: {
    warnings: string[];
    suggestions: string[];
  };
}

// Tool streaming error types
export interface ToolStreamingError {
  type:
    | 'input-validation'
    | 'execution-error'
    | 'timeout'
    | 'network-error'
    | 'cancellation';
  toolName: string;
  executionId: string;
  message: string;
  retryable: boolean;
  retryCount: number;
  originalError?: Error;
  timestamp: number;
  context?: Record<string, any>;
}

// Fine-grained streaming callbacks
export interface ToolStreamingCallbacks {
  onInputStart?: (toolName: string, inputSchema: z.ZodSchema<any>) => void;
  onInputDelta?: (
    toolName: string,
    partialInput: any,
    progress: number
  ) => void;
  onInputAvailable?: (
    toolName: string,
    completeInput: any,
    validation: ToolInputValidation
  ) => void;
  onToolExecutionStart?: (
    toolName: string,
    executionId: string,
    input: any
  ) => void;
  onToolExecutionProgress?: (progress: ToolExecutionProgress) => void;
  onToolExecutionComplete?: (
    result: any,
    metadata: ToolExecutionMetadata
  ) => void;
  onToolExecutionError?: (error: ToolStreamingError) => void;
  onStreamEnd?: (executionId: string, finalState: ToolStreamingState) => void;
  onStreamCancel?: (executionId: string, reason: string) => void;
}

// Tool input validation result
export interface ToolInputValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  score: number; // 0-100 confidence score
}

// Streaming tool part for UI components
export interface StreamingToolPart {
  id: string;
  type: 'input' | 'progress' | 'output' | 'error';
  toolName: string;
  executionId: string;
  timestamp: number;
  data: any;
  metadata?: Record<string, any>;
}

// Tool streaming options
export interface ToolStreamingOptions {
  enableInputStreaming?: boolean;
  enableProgressStreaming?: boolean;
  enableOutputStreaming?: boolean;
  inputChunkSize?: number;
  outputChunkSize?: number;
  progressUpdateInterval?: number;
  maxRetries?: number;
  timeout?: number;
  cacheStrategy?: 'none' | 'input' | 'output' | 'both';
  compressionEnabled?: boolean;
  validationLevel?: 'none' | 'basic' | 'strict';
  callbacks?: ToolStreamingCallbacks;
}

// Server-Sent Events message types
export interface ToolStreamingSSEMessage {
  id: string;
  event:
    | 'input-start'
    | 'input-delta'
    | 'input-available'
    | 'execution-start'
    | 'execution-progress'
    | 'execution-complete'
    | 'error'
    | 'end'
    | 'connection-established'
    | 'stream-close'
    | 'stream-error';
  data: {
    toolName: string;
    executionId: string;
    timestamp: number;
    payload: any;
  };
  retry?: number;
}

// Tool streaming session state
export interface ToolStreamingSession {
  id: string;
  userId?: string;
  toolName: string;
  state: ToolStreamingState;
  startTime: number;
  lastUpdateTime: number;
  input?: any;
  output?: any;
  progress?: ToolExecutionProgress;
  error?: ToolStreamingError;
  metadata: ToolExecutionMetadata;
  options: ToolStreamingOptions;
  executionId: string;
}

// Tool streaming manager configuration
export interface ToolStreamingManagerConfig {
  maxConcurrentExecutions?: number;
  defaultTimeout?: number;
  defaultRetries?: number;
  enableMetrics?: boolean;
  enableCaching?: boolean;
  sseHeartbeatInterval?: number;
  compressionThreshold?: number;
  validationCacheSize?: number;
}

// Multi-step tool execution context
export interface MultiStepToolContext {
  workflowId: string;
  stepIndex: number;
  totalSteps: number;
  previousResults: any[];
  dependencies: string[];
  parallelExecution: boolean;
}

// Tool streaming analytics
export interface ToolStreamingAnalytics {
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  averageInputSize: number;
  averageOutputSize: number;
  cacheHitRate: number;
  errorRate: number;
  mostUsedTools: Array<{ toolName: string; count: number }>;
  performanceBottlenecks: Array<{ toolName: string; avgDuration: number }>;
  timeRange: {
    start: number;
    end: number;
  };
}

// Enhanced tool definition with streaming support
export interface StreamingToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<any>;
  outputSchema?: z.ZodSchema<any>;
  streamingSupported: boolean;
  progressStages?: string[];
  estimatedDuration?: number;
  cacheable: boolean;
  retryable: boolean;
  execute: (input: any, options?: ToolStreamingOptions) => Promise<any>;
  validateInput?: (input: any) => ToolInputValidation;
  estimateProgress?: (input: any, currentStage: string) => number;
}

// Tool streaming hook return type
export interface UseToolStreamingReturn {
  // Core state
  state: ToolStreamingState;
  isStreaming: boolean;
  isComplete: boolean;
  hasError: boolean;

  // Data
  input: any;
  output: any;
  progress: ToolExecutionProgress | null;
  error: ToolStreamingError | null;
  parts: StreamingToolPart[];

  // Actions
  executeTool: (
    toolName: string,
    input: any,
    options?: ToolStreamingOptions
  ) => Promise<void>;
  cancelExecution: () => void;
  retryExecution: () => void;
  clearState: () => void;

  // Analytics
  session: ToolStreamingSession | null;
  analytics: Partial<ToolStreamingAnalytics>;
}

// React component props for tool streaming display
export interface ToolStreamingDisplayProps {
  session: ToolStreamingSession | null;
  showProgress?: boolean;
  showInput?: boolean;
  showOutput?: boolean;
  showMetadata?: boolean;
  enableRetry?: boolean;
  enableCancel?: boolean;
  onRetry?: () => void;
  onCancel?: () => void;
  className?: string;
}

// Export utility types
export type ToolStreamingEventMap = {
  'input-start': { toolName: string; inputSchema: z.ZodSchema<any> };
  'input-delta': { toolName: string; partialInput: any; progress: number };
  'input-available': {
    toolName: string;
    completeInput: any;
    validation: ToolInputValidation;
  };
  'execution-start': { toolName: string; executionId: string; input: any };
  'execution-progress': ToolExecutionProgress;
  'execution-complete': { result: any; metadata: ToolExecutionMetadata };
  error: ToolStreamingError;
  end: { executionId: string; finalState: ToolStreamingState };
  // Additional events for connection state
  'connection-established': { connectionId: string; timestamp: number };
  'stream-close': { executionId: string; reason: string };
  'stream-error': { executionId: string; error: string };
};
