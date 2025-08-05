import { z } from 'zod';
import { logError as logErrorToConsole } from '@/lib/logger';
import type {
  EnhancedToolResult,
  ToolExecutionContext,
} from './tools/enhanced-tools';

// Create a logger wrapper
const loggingService = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data),
  warn: (message: string, data?: any) =>
    console.warn(`[WARN] ${message}`, data),
  error: (message: string, data?: any) => logErrorToConsole(message, data),
  debug: (message: string, data?: any) =>
    console.debug(`[DEBUG] ${message}`, data),
};

// Progress update types
export interface ToolProgressUpdate {
  executionId: string;
  toolName: string;
  stage: ProgressStage;
  progress: number; // 0-100
  message: string;
  timestamp: number;
  metadata?: Record<string, any>;
  estimatedTimeRemaining?: number;
}

export interface StreamingProgressConfig {
  enableProgress: boolean;
  updateInterval: number; // milliseconds
  progressStages: ProgressStage[];
  enableTimeEstimation: boolean;
  enableDetailedLogging: boolean;
}

export type ProgressStage =
  | 'initializing'
  | 'validating'
  | 'processing'
  | 'generating'
  | 'optimizing'
  | 'finalizing'
  | 'complete'
  | 'error';

// Progress tracking interface
export interface ProgressTracker {
  executionId: string;
  startTime: number;
  currentStage: ProgressStage;
  stageStartTime: number;
  totalStages: number;
  completedStages: number;
  estimatedDuration: number;
  progressHistory: ToolProgressUpdate[];
}

// Stream controller for progress updates
export interface ProgressStreamController {
  update: (update: ToolProgressUpdate) => void;
  complete: (result: any) => void;
  error: (error: Error) => void;
  close: () => void;
}

/**
 * Streaming Tool Progress System
 * Provides real-time progress updates for long-running tool operations
 */
export class StreamingProgressManager {
  private static instance: StreamingProgressManager;
  private activeTrackers = new Map<string, ProgressTracker>();
  private streamControllers = new Map<string, ProgressStreamController>();
  private progressIntervals = new Map<string, NodeJS.Timeout>();

  // Stage duration estimates in milliseconds
  private readonly stageEstimates: Record<ProgressStage, number> = {
    initializing: 500,
    validating: 1000,
    processing: 3000,
    generating: 5000,
    optimizing: 2000,
    finalizing: 1000,
    complete: 0,
    error: 0,
  };

  private constructor() {}

  static getInstance(): StreamingProgressManager {
    if (!StreamingProgressManager.instance) {
      StreamingProgressManager.instance = new StreamingProgressManager();
    }
    return StreamingProgressManager.instance;
  }

  /**
   * Start progress tracking for a tool execution
   */
  startTracking(
    executionId: string,
    toolName: string,
    stages: ProgressStage[] = [
      'initializing',
      'processing',
      'finalizing',
      'complete',
    ],
    controller?: ProgressStreamController
  ): ProgressTracker {
    // Validate inputs
    if (!executionId || typeof executionId !== 'string') {
      throw new Error('Invalid executionId: must be a non-empty string');
    }

    if (!toolName || typeof toolName !== 'string') {
      throw new Error('Invalid toolName: must be a non-empty string');
    }

    if (!stages || stages.length === 0) {
      stages = ['initializing', 'processing', 'finalizing', 'complete']; // Safe default
    }

    // Check for existing execution ID
    if (this.activeTrackers.has(executionId)) {
      loggingService.warn('Execution ID already exists, generating new one', {
        originalId: executionId,
        toolName,
      });
      executionId = `${executionId}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    }
    const tracker: ProgressTracker = {
      executionId,
      startTime: Date.now(),
      currentStage: 'initializing',
      stageStartTime: Date.now(),
      totalStages: stages.length,
      completedStages: 0,
      estimatedDuration: this.calculateEstimatedDuration(stages),
      progressHistory: [],
    };

    this.activeTrackers.set(executionId, tracker);

    if (controller) {
      this.streamControllers.set(executionId, controller);
    }

    // Start progress updates
    this.startProgressUpdates(executionId, 1000); // Update every second

    loggingService.info('Progress tracking started', {
      executionId,
      toolName,
      stages,
      estimatedDuration: tracker.estimatedDuration,
    });

    // Send initial progress update
    this.updateProgress(executionId, {
      stage: 'initializing',
      progress: 0,
      message: 'Starting tool execution...',
    });

    return tracker;
  }

  /**
   * Update progress for a tool execution
   */
  updateProgress(
    executionId: string,
    update: Partial<ToolProgressUpdate>
  ): void {
    // Validate inputs
    if (!executionId || typeof executionId !== 'string') {
      loggingService.error('Invalid executionId for progress update', {
        executionId,
      });
      return;
    }

    if (!update || typeof update !== 'object') {
      loggingService.error('Invalid update object for progress update', {
        executionId,
        update,
      });
      return;
    }

    const tracker = this.activeTrackers.get(executionId);
    if (!tracker) {
      loggingService.warn('Progress update for unknown execution', {
        executionId,
      });
      return;
    }

    // Validate and clamp progress if provided
    if (update.progress !== undefined) {
      if (typeof update.progress !== 'number' || isNaN(update.progress)) {
        loggingService.warn('Invalid progress value, ignoring', {
          executionId,
          progress: update.progress,
        });
        update.progress = undefined;
      } else {
        // Clamp progress to 0-100 range
        update.progress = Math.min(100, Math.max(0, update.progress));
      }
    }

    // Validate toolName
    if (
      update.toolName !== undefined &&
      (!update.toolName || typeof update.toolName !== 'string')
    ) {
      loggingService.warn('Invalid toolName in progress update', {
        executionId,
        toolName: update.toolName,
      });
      update.toolName = undefined;
    }

    // Update tracker state
    if (update.stage && update.stage !== tracker.currentStage) {
      tracker.currentStage = update.stage;
      tracker.stageStartTime = Date.now();
      tracker.completedStages++;
    }

    // Create progress update
    const progressUpdate: ToolProgressUpdate = {
      executionId,
      toolName: update.toolName || 'unknown',
      stage: update.stage || tracker.currentStage,
      progress: update.progress ?? this.calculateProgress(tracker),
      message: update.message || this.getDefaultMessage(tracker.currentStage),
      timestamp: Date.now(),
      metadata: update.metadata,
      estimatedTimeRemaining: this.calculateTimeRemaining(tracker),
    };

    // Add to history
    tracker.progressHistory.push(progressUpdate);

    // Send to stream controller
    const controller = this.streamControllers.get(executionId);
    if (controller) {
      try {
        controller.update(progressUpdate);
      } catch (error) {
        loggingService.error('Failed to send progress update', {
          executionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    loggingService.debug('Progress updated', {
      executionId,
      stage: progressUpdate.stage,
      progress: progressUpdate.progress,
      message: progressUpdate.message,
    });
  }

  /**
   * Complete progress tracking
   */
  completeTracking(executionId: string, result?: any): void {
    const tracker = this.activeTrackers.get(executionId);
    if (!tracker) return;

    // Final progress update
    this.updateProgress(executionId, {
      stage: 'complete',
      progress: 100,
      message: 'Tool execution completed successfully',
    });

    // Send completion to stream controller
    const controller = this.streamControllers.get(executionId);
    if (controller) {
      try {
        controller.complete(result);
      } catch (error) {
        loggingService.error('Failed to send completion update', {
          executionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.cleanup(executionId);

    loggingService.info('Progress tracking completed', {
      executionId,
      totalTime: Date.now() - tracker.startTime,
      stages: tracker.totalStages,
    });
  }

  /**
   * Handle error in progress tracking
   */
  errorTracking(executionId: string, error: Error): void {
    const tracker = this.activeTrackers.get(executionId);
    if (!tracker) return;

    // Error progress update
    this.updateProgress(executionId, {
      stage: 'error',
      progress: (tracker.completedStages / tracker.totalStages) * 100,
      message: `Error: ${error.message}`,
    });

    // Send error to stream controller
    const controller = this.streamControllers.get(executionId);
    if (controller) {
      try {
        controller.error(error);
      } catch (controllerError) {
        loggingService.error('Failed to send error update', {
          executionId,
          error:
            controllerError instanceof Error
              ? controllerError.message
              : 'Unknown error',
        });
      }
    }

    this.cleanup(executionId);

    loggingService.error('Progress tracking failed', {
      executionId,
      error: error.message,
      stage: tracker.currentStage,
    });
  }

  /**
   * Get current progress for an execution
   */
  getProgress(executionId: string): ToolProgressUpdate | null {
    const tracker = this.activeTrackers.get(executionId);
    if (!tracker || tracker.progressHistory.length === 0) {
      return null;
    }

    return tracker.progressHistory[tracker.progressHistory.length - 1];
  }

  /**
   * Get all progress history for an execution
   */
  getProgressHistory(executionId: string): ToolProgressUpdate[] {
    const tracker = this.activeTrackers.get(executionId);
    return tracker?.progressHistory || [];
  }

  /**
   * Check if execution is being tracked
   */
  isTracking(executionId: string): boolean {
    return this.activeTrackers.has(executionId);
  }

  /**
   * Cancel progress tracking
   */
  cancelTracking(executionId: string): void {
    const controller = this.streamControllers.get(executionId);
    if (controller) {
      try {
        controller.close();
      } catch (error) {
        loggingService.error('Failed to close progress stream', {
          executionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.cleanup(executionId);

    loggingService.info('Progress tracking cancelled', { executionId });
  }

  /**
   * Get all active trackings
   */
  getActiveTrackings(): string[] {
    return Array.from(this.activeTrackers.keys());
  }

  // Private helper methods

  private startProgressUpdates(executionId: string, interval: number): void {
    const intervalId = setInterval(() => {
      const tracker = this.activeTrackers.get(executionId);
      if (!tracker) {
        clearInterval(intervalId);
        return;
      }

      // Send periodic progress update based on stage timing
      const stageProgress = this.calculateStageProgress(tracker);
      const overallProgress = this.calculateProgress(tracker);

      this.updateProgress(executionId, {
        progress: overallProgress,
        message: this.getProgressMessage(tracker, stageProgress),
      });
    }, interval);

    this.progressIntervals.set(executionId, intervalId);
  }

  private calculateProgress(tracker: ProgressTracker): number {
    // Prevent division by zero
    if (tracker.totalStages <= 0) {
      return 0;
    }

    const stageProgress = this.calculateStageProgress(tracker);
    const completedStageProgress =
      tracker.totalStages > 0
        ? ((tracker.completedStages - 1) / tracker.totalStages) * 100
        : 0;
    const currentStageProgress =
      tracker.totalStages > 0 ? stageProgress / tracker.totalStages : 0;

    return Math.min(
      100,
      Math.max(0, completedStageProgress + currentStageProgress)
    );
  }

  private calculateStageProgress(tracker: ProgressTracker): number {
    const stageElapsed = Date.now() - tracker.stageStartTime;
    const stageEstimate = this.stageEstimates[tracker.currentStage];

    if (stageEstimate === 0) return 100;

    return Math.min(100, (stageElapsed / stageEstimate) * 100);
  }

  private calculateTimeRemaining(tracker: ProgressTracker): number {
    if (tracker.completedStages === 0 || tracker.totalStages <= 0) {
      return tracker.estimatedDuration;
    }

    const elapsed = Date.now() - tracker.startTime;
    const progress = tracker.completedStages / tracker.totalStages;

    // Prevent division by zero and handle edge cases
    const EPSILON = 0.0001; // Small value to prevent division by zero
    if (progress <= EPSILON || elapsed <= 0) {
      return tracker.estimatedDuration;
    }

    const totalEstimated = elapsed / progress;

    // Ensure we return a reasonable value
    if (!isFinite(totalEstimated) || isNaN(totalEstimated)) {
      return tracker.estimatedDuration;
    }

    return Math.max(0, totalEstimated - elapsed);
  }

  private calculateEstimatedDuration(stages: ProgressStage[]): number {
    return stages.reduce(
      (total, stage) => total + this.stageEstimates[stage],
      0
    );
  }

  private getDefaultMessage(stage: ProgressStage): string {
    const messages: Record<ProgressStage, string> = {
      initializing: 'Initializing tool execution...',
      validating: 'Validating input parameters...',
      processing: 'Processing request...',
      generating: 'Generating output...',
      optimizing: 'Optimizing results...',
      finalizing: 'Finalizing output...',
      complete: 'Execution completed successfully',
      error: 'An error occurred during execution',
    };

    return messages[stage];
  }

  private getProgressMessage(
    tracker: ProgressTracker,
    stageProgress: number
  ): string {
    const stage = tracker.currentStage;
    const baseMessage = this.getDefaultMessage(stage);
    const timeMessage = this.formatTimeRemaining(tracker);

    return timeMessage ? `${baseMessage} ${timeMessage}` : baseMessage;
  }

  /**
   * Format time remaining message
   */
  private formatTimeRemaining(tracker: ProgressTracker): string {
    const stage = tracker.currentStage;

    if (stage === 'complete' || stage === 'error') {
      return '';
    }

    const timeRemaining = this.calculateTimeRemaining(tracker);

    if (timeRemaining > 0) {
      const seconds = Math.ceil(timeRemaining / 1000);
      return `(~${seconds}s remaining)`;
    }

    return '';
  }

  private cleanup(executionId: string): void {
    // Clear interval
    const intervalId = this.progressIntervals.get(executionId);
    if (intervalId) {
      clearInterval(intervalId);
      this.progressIntervals.delete(executionId);
    }

    // Remove tracker and controller
    this.activeTrackers.delete(executionId);
    this.streamControllers.delete(executionId);
  }
}

// Export singleton instance
export const streamingProgressManager = StreamingProgressManager.getInstance();

/**
 * Progress-aware tool execution wrapper
 */
export async function executeToolWithProgress<T>(
  toolName: string,
  execution: (
    progressUpdate: (update: Partial<ToolProgressUpdate>) => void
  ) => Promise<T>,
  options: {
    executionId?: string;
    stages?: ProgressStage[];
    controller?: ProgressStreamController;
    context?: ToolExecutionContext;
  } = {}
): Promise<EnhancedToolResult<T>> {
  const executionId =
    options.executionId ||
    `exec_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  const stages = options.stages || [
    'initializing',
    'processing',
    'finalizing',
    'complete',
  ];

  const startTime = Date.now();

  try {
    // Start progress tracking
    const tracker = streamingProgressManager.startTracking(
      executionId,
      toolName,
      stages,
      options.controller
    );

    // Create progress update function
    const progressUpdate = (update: Partial<ToolProgressUpdate>) => {
      streamingProgressManager.updateProgress(executionId, {
        toolName,
        ...update,
      });
    };

    // Execute with progress updates
    const result = await execution(progressUpdate);

    // Complete tracking
    streamingProgressManager.completeTracking(executionId, result);

    return {
      success: true,
      data: result,
      executionTime: Date.now() - startTime,
      metadata: {
        toolName,
        executionId,
        progressTracked: true,
        stages: stages.length,
      },
    };
  } catch (error) {
    const toolError = error instanceof Error ? error : new Error(String(error));

    // Handle error in tracking
    streamingProgressManager.errorTracking(executionId, toolError);

    return {
      success: false,
      error: toolError.message,
      executionTime: Date.now() - startTime,
      metadata: {
        toolName,
        executionId,
        progressTracked: true,
        errorStage: streamingProgressManager.getProgress(executionId)?.stage,
      },
    };
  }
}

/**
 * Create a progress stream for Server-Sent Events
 */
export function createProgressStream(
  executionId: string
): ReadableStream<Uint8Array> {
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;

      // Register stream controller
      const progressController: ProgressStreamController = {
        update: (update: ToolProgressUpdate) => {
          const data = `data: ${JSON.stringify(update)}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));
        },
        complete: (result: any) => {
          const data = `data: ${JSON.stringify({ type: 'complete', result })}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));
          controller.close();
        },
        error: (error: Error) => {
          const data = `data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));
          controller.close();
        },
        close: () => {
          controller.close();
        },
      };

      streamingProgressManager.streamControllers.set(
        executionId,
        progressController
      );
    },
    cancel() {
      streamingProgressManager.cancelTracking(executionId);
    },
  });

  return stream;
}

// Validation schemas
export const progressUpdateSchema = z.object({
  executionId: z.string(),
  toolName: z.string(),
  stage: z.enum([
    'initializing',
    'validating',
    'processing',
    'generating',
    'optimizing',
    'finalizing',
    'complete',
    'error',
  ]),
  progress: z.number().min(0).max(100),
  message: z.string(),
  timestamp: z.number(),
  metadata: z.record(z.any()).optional(),
  estimatedTimeRemaining: z.number().optional(),
});

export const streamingProgressConfigSchema = z.object({
  enableProgress: z.boolean().default(true),
  updateInterval: z.number().min(100).max(10_000).default(1000),
  progressStages: z.array(
    z.enum([
      'initializing',
      'validating',
      'processing',
      'generating',
      'optimizing',
      'finalizing',
      'complete',
      'error',
    ])
  ),
  enableTimeEstimation: z.boolean().default(true),
  enableDetailedLogging: z.boolean().default(false),
});

export type ProgressUpdateType = z.infer<typeof progressUpdateSchema>;
export type StreamingProgressConfigType = z.infer<
  typeof streamingProgressConfigSchema
>;
