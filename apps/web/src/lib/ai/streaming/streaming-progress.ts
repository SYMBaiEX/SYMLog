import { z } from 'zod';

// Use console for logging instead of importing @/lib/logger
const logErrorToConsole = (message: string, data?: any) =>
  console.error(`[ERROR] ${message}`, data);

import type {
  EnhancedToolResult,
  ToolExecutionContext,
} from '../tools/enhanced-tools';

// Create a logger wrapper
const loggingService = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data),
  warn: (message: string, data?: any) =>
    console.warn(`[WARN] ${message}`, data),
  error: (message: string, data?: any) => logErrorToConsole(message, data),
  debug: (message: string, data?: any) =>
    console.debug(`[DEBUG] ${message}`, data),
};

// Progress update types with enhanced type safety
export interface ToolProgressUpdate {
  readonly executionId: string;
  readonly toolName: string;
  readonly stage: ProgressStage;
  readonly progress: number; // 0-100
  readonly message: string;
  readonly timestamp: number;
  readonly metadata?: Readonly<Record<string, any>>;
  readonly estimatedTimeRemaining?: number;
}

// Mutable version for builder pattern
interface MutableToolProgressUpdate {
  executionId: string;
  toolName: string;
  stage: ProgressStage;
  progress: number;
  message: string;
  timestamp: number;
  metadata?: Record<string, any>;
  estimatedTimeRemaining?: number;
}

// Type-safe progress update builder
export class ProgressUpdateBuilder {
  private update: Partial<MutableToolProgressUpdate> = {};

  constructor(executionId: string, toolName: string) {
    this.update.executionId = executionId;
    this.update.toolName = toolName;
    this.update.timestamp = Date.now();
  }

  stage(stage: ProgressStage): this {
    this.update.stage = stage;
    return this;
  }

  progress(progress: number): this {
    // Clamp progress to valid range
    this.update.progress = Math.min(100, Math.max(0, progress));
    return this;
  }

  message(message: string): this {
    this.update.message = message;
    return this;
  }

  metadata(metadata: Record<string, any>): this {
    this.update.metadata = { ...metadata };
    return this;
  }

  estimatedTimeRemaining(timeMs: number): this {
    this.update.estimatedTimeRemaining = Math.max(0, timeMs);
    return this;
  }

  build(): ToolProgressUpdate {
    if (!this.update.stage) {
      throw new Error('Stage is required for progress update');
    }
    if (this.update.progress === undefined) {
      throw new Error('Progress is required for progress update');
    }
    if (!this.update.message) {
      throw new Error('Message is required for progress update');
    }

    // Create readonly version from mutable builder data
    return {
      executionId: this.update.executionId!,
      toolName: this.update.toolName!,
      stage: this.update.stage,
      progress: this.update.progress,
      message: this.update.message,
      timestamp: this.update.timestamp!,
      metadata: this.update.metadata ? { ...this.update.metadata } : undefined,
      estimatedTimeRemaining: this.update.estimatedTimeRemaining,
    } as const;
  }
}

export interface StreamingProgressConfig {
  readonly enableProgress: boolean;
  readonly updateInterval: number; // milliseconds
  readonly progressStages: readonly ProgressStage[];
  readonly enableTimeEstimation: boolean;
  readonly enableDetailedLogging: boolean;
  readonly maxConcurrentTrackings?: number;
  readonly progressHistoryLimit?: number;
  readonly enableProgressValidation?: boolean;
}

// Mutable version for config builder
interface MutableStreamingProgressConfig {
  enableProgress: boolean;
  updateInterval: number;
  progressStages: ProgressStage[];
  enableTimeEstimation: boolean;
  enableDetailedLogging: boolean;
  maxConcurrentTrackings?: number;
  progressHistoryLimit?: number;
  enableProgressValidation?: boolean;
}

// Type-safe config builder
export class StreamingProgressConfigBuilder {
  private config: Partial<MutableStreamingProgressConfig> = {};

  enableProgress(enable: boolean): this {
    this.config.enableProgress = enable;
    return this;
  }

  updateInterval(intervalMs: number): this {
    if (intervalMs < 100 || intervalMs > 10_000) {
      throw new Error('Update interval must be between 100ms and 10000ms');
    }
    this.config.updateInterval = intervalMs;
    return this;
  }

  progressStages(stages: ProgressStage[]): this {
    if (stages.length === 0) {
      throw new Error('At least one progress stage is required');
    }
    this.config.progressStages = [...stages];
    return this;
  }

  enableTimeEstimation(enable: boolean): this {
    this.config.enableTimeEstimation = enable;
    return this;
  }

  enableDetailedLogging(enable: boolean): this {
    this.config.enableDetailedLogging = enable;
    return this;
  }

  maxConcurrentTrackings(max: number): this {
    if (max < 1) {
      throw new Error('Max concurrent trackings must be at least 1');
    }
    this.config.maxConcurrentTrackings = max;
    return this;
  }

  progressHistoryLimit(limit: number): this {
    if (limit < 1) {
      throw new Error('Progress history limit must be at least 1');
    }
    this.config.progressHistoryLimit = limit;
    return this;
  }

  enableProgressValidation(enable: boolean): this {
    this.config.enableProgressValidation = enable;
    return this;
  }

  build(): StreamingProgressConfig {
    // Create readonly version with defaults
    const builtConfig = {
      enableProgress: this.config.enableProgress ?? true,
      updateInterval: this.config.updateInterval ?? 1000,
      progressStages: this.config.progressStages ?? [
        'initializing',
        'processing',
        'finalizing',
        'complete',
      ],
      enableTimeEstimation: this.config.enableTimeEstimation ?? true,
      enableDetailedLogging: this.config.enableDetailedLogging ?? false,
      maxConcurrentTrackings: this.config.maxConcurrentTrackings ?? 10,
      progressHistoryLimit: this.config.progressHistoryLimit ?? 100,
      enableProgressValidation: this.config.enableProgressValidation ?? true,
    } as const;
    return builtConfig;
  }
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

// Progress tracking interface with enhanced type safety
export interface ProgressTracker {
  readonly executionId: string;
  readonly startTime: number;
  currentStage: ProgressStage;
  stageStartTime: number;
  readonly totalStages: number;
  completedStages: number;
  readonly estimatedDuration: number;
  readonly progressHistory: readonly ToolProgressUpdate[];
  readonly metadata?: Readonly<Record<string, any>>;
}

// Mutable version for progress tracker builder
interface MutableProgressTracker {
  executionId: string;
  startTime: number;
  currentStage: ProgressStage;
  stageStartTime: number;
  totalStages: number;
  completedStages: number;
  estimatedDuration: number;
  progressHistory: ToolProgressUpdate[];
  metadata?: Record<string, any>;
}

// Type-safe progress tracker builder
export class ProgressTrackerBuilder {
  private tracker: Partial<MutableProgressTracker> = {};

  constructor(executionId: string) {
    this.tracker.executionId = executionId;
    this.tracker.startTime = Date.now();
    this.tracker.stageStartTime = Date.now();
    this.tracker.progressHistory = [];
    this.tracker.completedStages = 0;
  }

  stages(stages: ProgressStage[]): this {
    if (stages.length === 0) {
      throw new Error('At least one stage is required');
    }
    this.tracker.totalStages = stages.length;
    this.tracker.currentStage = stages[0];
    this.tracker.estimatedDuration = this.calculateEstimatedDuration(stages);
    return this;
  }

  metadata(metadata: Record<string, any>): this {
    this.tracker.metadata = { ...metadata };
    return this;
  }

  build(): ProgressTracker {
    if (!this.tracker.totalStages) {
      throw new Error('Stages must be set before building tracker');
    }
    if (!this.tracker.currentStage) {
      throw new Error('Current stage must be set before building tracker');
    }
    if (this.tracker.estimatedDuration === undefined) {
      throw new Error('Estimated duration must be set before building tracker');
    }

    // Create readonly version from mutable builder data
    return {
      executionId: this.tracker.executionId!,
      startTime: this.tracker.startTime!,
      currentStage: this.tracker.currentStage,
      stageStartTime: this.tracker.stageStartTime!,
      totalStages: this.tracker.totalStages,
      completedStages: this.tracker.completedStages!,
      estimatedDuration: this.tracker.estimatedDuration,
      progressHistory: [...this.tracker.progressHistory!],
      metadata: this.tracker.metadata
        ? { ...this.tracker.metadata }
        : undefined,
    } as const;
  }

  private calculateEstimatedDuration(stages: ProgressStage[]): number {
    const stageEstimates: Record<ProgressStage, number> = {
      initializing: 500,
      validating: 1000,
      processing: 3000,
      generating: 5000,
      optimizing: 2000,
      finalizing: 1000,
      complete: 0,
      error: 0,
    };

    return stages.reduce((total, stage) => total + stageEstimates[stage], 0);
  }
}

// Stream controller for progress updates with enhanced type safety
export interface ProgressStreamController<TResult = any> {
  readonly id: string;
  readonly createdAt: number;
  update: (update: ToolProgressUpdate) => void | Promise<void>;
  complete: (result: TResult) => void | Promise<void>;
  error: (error: Error) => void | Promise<void>;
  close: () => void | Promise<void>;
  isActive: () => boolean;
  metadata?: Readonly<Record<string, any>>;
}

// Mutable version for controller builder
interface MutableProgressStreamController<TResult = any> {
  id: string;
  createdAt: number;
  update: (update: ToolProgressUpdate) => void | Promise<void>;
  complete: (result: TResult) => void | Promise<void>;
  error: (error: Error) => void | Promise<void>;
  close: () => void | Promise<void>;
  isActive: () => boolean;
  metadata?: Record<string, any>;
}

// Type-safe controller builder
export class ProgressStreamControllerBuilder<TResult = any> {
  private controller: Partial<MutableProgressStreamController<TResult>> = {};
  private handlers = {
    update: null as
      | ((update: ToolProgressUpdate) => void | Promise<void>)
      | null,
    complete: null as ((result: TResult) => void | Promise<void>) | null,
    error: null as ((error: Error) => void | Promise<void>) | null,
    close: null as (() => void | Promise<void>) | null,
  };
  private active = true;

  constructor() {
    this.controller.id = `controller_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.controller.createdAt = Date.now();
  }

  onUpdate(
    handler: (update: ToolProgressUpdate) => void | Promise<void>
  ): this {
    this.handlers.update = handler;
    return this;
  }

  onComplete(handler: (result: TResult) => void | Promise<void>): this {
    this.handlers.complete = handler;
    return this;
  }

  onError(handler: (error: Error) => void | Promise<void>): this {
    this.handlers.error = handler;
    return this;
  }

  onClose(handler: () => void | Promise<void>): this {
    this.handlers.close = handler;
    return this;
  }

  metadata(metadata: Record<string, any>): this {
    this.controller.metadata = { ...metadata };
    return this;
  }

  build(): ProgressStreamController<TResult> {
    if (!this.handlers.update) {
      throw new Error('Update handler is required');
    }
    if (!this.handlers.complete) {
      throw new Error('Complete handler is required');
    }
    if (!this.handlers.error) {
      throw new Error('Error handler is required');
    }
    if (!this.handlers.close) {
      throw new Error('Close handler is required');
    }

    // Create readonly version from mutable builder data
    const builtController: ProgressStreamController<TResult> = {
      id: this.controller.id!,
      createdAt: this.controller.createdAt!,
      metadata: this.controller.metadata
        ? { ...this.controller.metadata }
        : undefined,
      update: this.handlers.update,
      complete: this.handlers.complete,
      error: this.handlers.error,
      close: async () => {
        this.active = false;
        await this.handlers.close!();
      },
      isActive: () => this.active,
    } as const;
    return builtController;
  }
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
   * Start progress tracking for a tool execution with enhanced type safety
   */
  startTracking(
    executionId: string,
    toolName: string,
    stages: readonly ProgressStage[] = [
      'initializing',
      'processing',
      'finalizing',
      'complete',
    ],
    controller?: ProgressStreamController,
    options?: {
      metadata?: Record<string, any>;
      enableValidation?: boolean;
    }
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
      estimatedDuration: this.calculateEstimatedDuration([...stages]),
      progressHistory: [],
      metadata: options?.metadata,
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
   * Update progress for a tool execution with enhanced validation
   */
  updateProgress(
    executionId: string,
    update: Partial<ToolProgressUpdate>,
    options?: {
      validateProgress?: boolean;
      skipDuplicates?: boolean;
    }
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
        (update as any).progress = undefined;
      } else {
        // Clamp progress to 0-100 range
        (update as any).progress = Math.min(100, Math.max(0, update.progress));
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
      (update as any).toolName = undefined;
    }

    // Update tracker state
    if (update.stage && update.stage !== tracker.currentStage) {
      tracker.currentStage = update.stage;
      tracker.stageStartTime = Date.now();
      tracker.completedStages++;
    }

    // Create progress update with type safety
    const progressUpdate: ToolProgressUpdate = new ProgressUpdateBuilder(
      executionId,
      update.toolName || 'unknown'
    )
      .stage(update.stage || tracker.currentStage)
      .progress(update.progress ?? this.calculateProgress(tracker))
      .message(update.message || this.getDefaultMessage(tracker.currentStage))
      .metadata(update.metadata || {})
      .estimatedTimeRemaining(this.calculateTimeRemaining(tracker))
      .build();

    // Optional validation
    if (options?.validateProgress) {
      this.validateProgressUpdate(progressUpdate, tracker);
    }

    // Skip duplicates if requested
    if (
      options?.skipDuplicates &&
      this.isDuplicateUpdate(progressUpdate, tracker)
    ) {
      return;
    }

    // Add to history (cast to mutable for internal management)
    (tracker.progressHistory as unknown as ToolProgressUpdate[]).push(
      progressUpdate
    );

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
  getProgressHistory(executionId: string): readonly ToolProgressUpdate[] {
    const tracker = this.activeTrackers.get(executionId);
    return tracker?.progressHistory ?? [];
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

  /**
   * Register a stream controller for an execution
   */
  registerController(
    executionId: string,
    controller: ProgressStreamController
  ): void {
    this.streamControllers.set(executionId, controller);
  }

  /**
   * Unregister a stream controller
   */
  unregisterController(executionId: string): void {
    this.streamControllers.delete(executionId);
  }

  /**
   * Get registered stream controller
   */
  getController(executionId: string): ProgressStreamController | undefined {
    return this.streamControllers.get(executionId);
  }

  /**
   * Check if controller is registered
   */
  hasController(executionId: string): boolean {
    return this.streamControllers.has(executionId);
  }

  /**
   * Get all registered controller IDs
   */
  getControllerIds(): string[] {
    return Array.from(this.streamControllers.keys());
  }

  /**
   * Clear all controllers
   */
  clearControllers(): void {
    // Close all controllers before clearing
    for (const [executionId, controller] of this.streamControllers) {
      try {
        controller.close();
      } catch (error) {
        loggingService.warn('Failed to close controller during clear', {
          executionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    this.streamControllers.clear();
  }

  /**
   * Batch update multiple progress trackings
   */
  batchUpdateProgress(
    updates: Array<{
      executionId: string;
      update: Partial<ToolProgressUpdate>;
    }>
  ): void {
    for (const { executionId, update } of updates) {
      this.updateProgress(executionId, update);
    }
  }

  /**
   * Get statistics for all active trackings
   */
  getTrackingStatistics(): {
    totalActive: number;
    averageProgress: number;
    stageCounts: Record<ProgressStage, number>;
    oldestTracking: { executionId: string; startTime: number } | null;
  } {
    const trackers = Array.from(this.activeTrackers.values());

    if (trackers.length === 0) {
      return {
        totalActive: 0,
        averageProgress: 0,
        stageCounts: {
          initializing: 0,
          validating: 0,
          processing: 0,
          generating: 0,
          optimizing: 0,
          finalizing: 0,
          complete: 0,
          error: 0,
        },
        oldestTracking: null,
      };
    }

    const stageCounts = trackers.reduce(
      (counts, tracker) => {
        counts[tracker.currentStage] = (counts[tracker.currentStage] || 0) + 1;
        return counts;
      },
      {} as Record<ProgressStage, number>
    );

    // Fill in missing stages with 0
    const allStages: ProgressStage[] = [
      'initializing',
      'validating',
      'processing',
      'generating',
      'optimizing',
      'finalizing',
      'complete',
      'error',
    ];
    for (const stage of allStages) {
      if (!(stage in stageCounts)) {
        stageCounts[stage] = 0;
      }
    }

    const totalProgress = trackers.reduce(
      (sum, tracker) => sum + this.calculateProgress(tracker),
      0
    );

    const oldestTracker = trackers.reduce((oldest, current) =>
      !oldest || current.startTime < oldest.startTime ? current : oldest
    );

    return {
      totalActive: trackers.length,
      averageProgress: totalProgress / trackers.length,
      stageCounts,
      oldestTracking: {
        executionId: oldestTracker.executionId,
        startTime: oldestTracker.startTime,
      },
    };
  }

  /**
   * Force complete all active trackings
   */
  forceCompleteAll(reason?: string): void {
    const activeIds = Array.from(this.activeTrackers.keys());

    for (const executionId of activeIds) {
      try {
        this.updateProgress(executionId, {
          stage: 'complete',
          progress: 100,
          message: reason || 'Force completed by system',
        });
        this.completeTracking(executionId, { forceCompleted: true, reason });
      } catch (error) {
        loggingService.error('Failed to force complete tracking', {
          executionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
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

  /**
   * Validate progress update for consistency and correctness
   */
  private validateProgressUpdate(
    update: ToolProgressUpdate,
    tracker: ProgressTracker
  ): void {
    // Validate progress range
    if (update.progress < 0 || update.progress > 100) {
      throw new Error(
        `Invalid progress value: ${update.progress}. Must be between 0 and 100.`
      );
    }

    // Validate stage transition
    const currentStageIndex = this.getStageIndex(tracker.currentStage);
    const newStageIndex = this.getStageIndex(update.stage);

    if (newStageIndex < currentStageIndex && update.stage !== 'error') {
      loggingService.warn('Backward stage transition detected', {
        executionId: update.executionId,
        from: tracker.currentStage,
        to: update.stage,
      });
    }

    // Validate execution ID consistency
    if (update.executionId !== tracker.executionId) {
      throw new Error(
        `Execution ID mismatch: expected ${tracker.executionId}, got ${update.executionId}`
      );
    }

    // Validate timestamp
    if (update.timestamp < tracker.startTime) {
      throw new Error(
        'Progress update timestamp cannot be before tracker start time'
      );
    }
  }

  /**
   * Check if update is duplicate of the last update
   */
  private isDuplicateUpdate(
    update: ToolProgressUpdate,
    tracker: ProgressTracker
  ): boolean {
    const lastUpdate =
      tracker.progressHistory[tracker.progressHistory.length - 1];

    if (!lastUpdate) {
      return false;
    }

    return (
      lastUpdate.stage === update.stage &&
      lastUpdate.progress === update.progress &&
      lastUpdate.message === update.message &&
      Math.abs(lastUpdate.timestamp - update.timestamp) < 100 // Within 100ms
    );
  }

  /**
   * Get stage index for validation
   */
  private getStageIndex(stage: ProgressStage): number {
    const stageOrder: ProgressStage[] = [
      'initializing',
      'validating',
      'processing',
      'generating',
      'optimizing',
      'finalizing',
      'complete',
      'error',
    ];

    return stageOrder.indexOf(stage);
  }

  private cleanup(executionId: string): void {
    // Clear interval
    const intervalId = this.progressIntervals.get(executionId);
    if (intervalId) {
      clearInterval(intervalId);
      this.progressIntervals.delete(executionId);
    }

    // Close controller before removing
    const controller = this.streamControllers.get(executionId);
    if (controller) {
      try {
        controller.close();
      } catch (error) {
        loggingService.warn('Failed to close controller during cleanup', {
          executionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
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
  let streamController: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      streamController = ctrl;

      // Register stream controller
      const progressHandlers = {
        update: (update: ToolProgressUpdate) => {
          const data = `data: ${JSON.stringify(update)}\n\n`;
          streamController.enqueue(new TextEncoder().encode(data));
        },
        complete: (result: any) => {
          const data = `data: ${JSON.stringify({ type: 'complete', result })}\n\n`;
          streamController.enqueue(new TextEncoder().encode(data));
          streamController.close();
        },
        error: (error: Error) => {
          const data = `data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`;
          streamController.enqueue(new TextEncoder().encode(data));
          streamController.close();
        },
        close: () => {
          streamController.close();
        },
      };

      // Register the controller using the public method
      const progressController: ProgressStreamController = {
        id: `controller_${executionId}`,
        createdAt: Date.now(),
        update: progressHandlers.update,
        complete: progressHandlers.complete,
        error: progressHandlers.error,
        close: progressHandlers.close,
        isActive: () => true,
      };
      streamingProgressManager.registerController(
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
  metadata: z.record(z.string(), z.any()).optional(),
  estimatedTimeRemaining: z.number().optional(),
});

// Removed prototype modification - registerController is now a proper class method

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
