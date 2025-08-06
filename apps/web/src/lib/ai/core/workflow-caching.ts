import {
  type CoreMessage,
  generateObject,
  generateText,
  type LanguageModel,
} from 'ai';
import type { z } from 'zod';
import { logError as logErrorToConsole } from '@/lib/logger';
import { AIResponseCache } from './caching';
import { streamingOptimizer } from '../streaming';
import { structuredMemoizer } from './structured-memoization';

// Create a logger wrapper
const loggingService = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data),
  warn: (message: string, data?: any) =>
    console.warn(`[WARN] ${message}`, data),
  error: (message: string, data?: any) => logErrorToConsole(message, data),
  debug: (message: string, data?: any) =>
    console.debug(`[DEBUG] ${message}`, data),
};

// Workflow step definition
export interface WorkflowStep {
  id: string;
  name: string;
  type: 'text' | 'object' | 'stream' | 'function';
  prompt?: string;
  schema?: z.ZodSchema<any>;
  function?: (...args: any[]) => Promise<any>;
  dependencies: string[];
  cacheStrategy: 'none' | 'step' | 'chain' | 'smart';
  retryConfig?: {
    maxRetries: number;
    backoffMultiplier: number;
  };
  metadata?: Record<string, any>;
}

// Workflow definition
export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  steps: WorkflowStep[];
  cacheConfig: {
    enableStepCaching: boolean;
    enableChainCaching: boolean;
    enableSmartCaching: boolean;
    defaultTTL: number;
    maxCacheSize: number;
  };
  executionConfig: {
    maxParallelSteps: number;
    timeoutMs: number;
    enableRecovery: boolean;
  };
}

// Workflow execution context
export interface WorkflowContext {
  workflowId: string;
  executionId: string;
  sessionId?: string;
  userId?: string;
  variables: Record<string, any>;
  stepResults: Map<string, any>;
  startTime: number;
  currentStep: number;
  metadata: Record<string, any>;
}

// Workflow execution result
export interface WorkflowResult {
  success: boolean;
  executionId: string;
  duration: number;
  stepsExecuted: number;
  stepsSkipped: number;
  stepsCached: number;
  finalResult?: any;
  error?: Error;
  executionTrace: WorkflowExecutionTrace[];
}

// Execution trace for debugging and optimization
export interface WorkflowExecutionTrace {
  stepId: string;
  stepName: string;
  startTime: number;
  endTime: number;
  duration: number;
  cacheHit: boolean;
  retries: number;
  error?: string;
  inputHash: string;
  outputHash: string;
  memoryUsage?: number;
}

// Workflow cache entry
interface WorkflowCacheEntry {
  workflowId: string;
  stepId: string;
  inputHash: string;
  result: any;
  dependencies: string[];
  createdAt: number;
  lastUsed: number;
  usageCount: number;
  computationTime: number;
  size: number;
}

// Default workflow configuration
const DEFAULT_WORKFLOW_CONFIG = {
  cacheConfig: {
    enableStepCaching: true,
    enableChainCaching: true,
    enableSmartCaching: true,
    defaultTTL: 1_800_000, // 30 minutes
    maxCacheSize: 1000,
  },
  executionConfig: {
    maxParallelSteps: 3,
    timeoutMs: 300_000, // 5 minutes
    enableRecovery: true,
  },
};

/**
 * Advanced Workflow Caching System
 */
export class WorkflowCachingEngine {
  private static instance: WorkflowCachingEngine;
  private stepCache: AIResponseCache;
  private chainCache: Map<string, any> = new Map();
  private workflowCache: Map<string, WorkflowCacheEntry> = new Map();
  private executionHistory: Map<string, WorkflowResult> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();

  private constructor() {
    this.stepCache = new AIResponseCache({
      maxSize: 5000,
      maxAge: 1_800_000, // 30 minutes
      updateAgeOnGet: true,
    });
  }

  static getInstance(): WorkflowCachingEngine {
    if (!WorkflowCachingEngine.instance) {
      WorkflowCachingEngine.instance = new WorkflowCachingEngine();
    }
    return WorkflowCachingEngine.instance;
  }

  /**
   * Execute workflow with advanced caching
   */
  async executeWorkflow(
    workflow: WorkflowDefinition,
    model: LanguageModel,
    context: Partial<WorkflowContext> = {}
  ): Promise<WorkflowResult> {
    const executionId = this.generateExecutionId();
    const workflowContext: WorkflowContext = {
      workflowId: workflow.id,
      executionId,
      sessionId: context.sessionId,
      userId: context.userId,
      variables: context.variables || {},
      stepResults: new Map(),
      startTime: Date.now(),
      currentStep: 0,
      metadata: context.metadata || {},
    };

    const executionTrace: WorkflowExecutionTrace[] = [];
    let stepsExecuted = 0;
    const stepsSkipped = 0;
    let stepsCached = 0;
    let finalResult: any;

    try {
      // Check for full workflow cache hit
      if (workflow.cacheConfig.enableChainCaching) {
        const chainCacheKey = this.generateChainCacheKey(
          workflow,
          workflowContext
        );
        const cachedWorkflow = await this.getChainCacheResult(chainCacheKey);

        if (cachedWorkflow) {
          loggingService.info('Full workflow cache hit', {
            workflowId: workflow.id,
            executionId,
          });

          return {
            success: true,
            executionId,
            duration: Date.now() - workflowContext.startTime,
            stepsExecuted: 0,
            stepsSkipped: workflow.steps.length,
            stepsCached: workflow.steps.length,
            finalResult: cachedWorkflow,
            executionTrace: [],
          };
        }
      }

      // Execute workflow steps
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        workflowContext.currentStep = i;

        const stepTrace: WorkflowExecutionTrace = {
          stepId: step.id,
          stepName: step.name,
          startTime: Date.now(),
          endTime: 0,
          duration: 0,
          cacheHit: false,
          retries: 0,
          inputHash: '',
          outputHash: '',
        };

        try {
          const stepResult = await this.executeStep(
            step,
            model,
            workflowContext,
            stepTrace
          );

          workflowContext.stepResults.set(step.id, stepResult);

          if (i === workflow.steps.length - 1) {
            finalResult = stepResult;
          }

          stepsExecuted++;
          if (stepTrace.cacheHit) {
            stepsCached++;
          }
        } catch (error) {
          stepTrace.error =
            error instanceof Error ? error.message : String(error);

          // Handle step failure based on workflow configuration
          if (workflow.executionConfig.enableRecovery) {
            const recovered = await this.attemptStepRecovery(
              step,
              error,
              workflowContext,
              stepTrace
            );

            if (recovered) {
              workflowContext.stepResults.set(step.id, recovered);
              stepsExecuted++;
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        } finally {
          stepTrace.endTime = Date.now();
          stepTrace.duration = stepTrace.endTime - stepTrace.startTime;
          executionTrace.push(stepTrace);
        }
      }

      // Cache the complete workflow result
      if (workflow.cacheConfig.enableChainCaching && finalResult) {
        const chainCacheKey = this.generateChainCacheKey(
          workflow,
          workflowContext
        );
        await this.cacheChainResult(
          chainCacheKey,
          finalResult,
          workflow.cacheConfig.defaultTTL
        );
      }

      const result: WorkflowResult = {
        success: true,
        executionId,
        duration: Date.now() - workflowContext.startTime,
        stepsExecuted,
        stepsSkipped,
        stepsCached,
        finalResult,
        executionTrace,
      };

      this.executionHistory.set(executionId, result);
      return result;
    } catch (error) {
      const result: WorkflowResult = {
        success: false,
        executionId,
        duration: Date.now() - workflowContext.startTime,
        stepsExecuted,
        stepsSkipped,
        stepsCached,
        error: error instanceof Error ? error : new Error(String(error)),
        executionTrace,
      };

      this.executionHistory.set(executionId, result);
      throw error;
    }
  }

  /**
   * Execute single workflow step with caching
   */
  async executeStep(
    step: WorkflowStep,
    model: LanguageModel,
    context: WorkflowContext,
    trace: WorkflowExecutionTrace
  ): Promise<any> {
    // Generate step cache key
    const stepCacheKey = this.generateStepCacheKey(step, context);
    trace.inputHash = this.hashInput(stepCacheKey);

    // Check step cache
    if (step.cacheStrategy !== 'none') {
      const cached = await this.getStepCacheResult(
        stepCacheKey,
        step.dependencies
      );
      if (cached) {
        trace.cacheHit = true;
        trace.outputHash = this.hashInput(cached);
        loggingService.debug('Step cache hit', {
          stepId: step.id,
          executionId: context.executionId,
        });
        return cached;
      }
    }

    // Execute step
    let result: any;
    const startTime = Date.now();

    try {
      switch (step.type) {
        case 'text':
          result = await this.executeTextStep(step, model, context);
          break;
        case 'object':
          result = await this.executeObjectStep(step, model, context);
          break;
        case 'stream':
          result = await this.executeStreamStep(step, model, context);
          break;
        case 'function':
          result = await this.executeFunctionStep(step, context);
          break;
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      const computationTime = Date.now() - startTime;
      trace.outputHash = this.hashInput(result);

      // Cache the result
      if (step.cacheStrategy !== 'none') {
        await this.cacheStepResult(
          stepCacheKey,
          result,
          step.dependencies,
          computationTime
        );
      }

      return result;
    } catch (error) {
      // Retry logic
      if (step.retryConfig && trace.retries < step.retryConfig.maxRetries) {
        trace.retries++;
        const delay =
          step.retryConfig.backoffMultiplier ** trace.retries * 1000;

        loggingService.warn('Step failed, retrying', {
          stepId: step.id,
          executionId: context.executionId,
          retry: trace.retries,
          delay,
        });

        await this.sleep(delay);
        return this.executeStep(step, model, context, trace);
      }

      throw error;
    }
  }

  /**
   * Get workflow execution analytics
   */
  getWorkflowAnalytics(workflowId?: string): {
    totalExecutions: number;
    successRate: number;
    avgDuration: number;
    cacheHitRate: number;
    mostCachedSteps: Array<{ stepId: string; hits: number }>;
    performanceBottlenecks: Array<{ stepId: string; avgDuration: number }>;
  } {
    const executions = Array.from(this.executionHistory.values());
    const filteredExecutions = workflowId
      ? executions.filter((e) =>
          e.executionTrace.some((t) => t.stepId.startsWith(workflowId))
        )
      : executions;

    if (filteredExecutions.length === 0) {
      return {
        totalExecutions: 0,
        successRate: 0,
        avgDuration: 0,
        cacheHitRate: 0,
        mostCachedSteps: [],
        performanceBottlenecks: [],
      };
    }

    const successfulExecutions = filteredExecutions.filter(
      (e) => e.success
    ).length;
    const totalSteps = filteredExecutions.reduce(
      (sum, e) => sum + e.executionTrace.length,
      0
    );
    const cachedSteps = filteredExecutions.reduce(
      (sum, e) => sum + e.executionTrace.filter((t) => t.cacheHit).length,
      0
    );

    // Analyze step performance
    const stepStats = new Map<
      string,
      { totalDuration: number; hits: number; cacheHits: number }
    >();

    for (const execution of filteredExecutions) {
      for (const trace of execution.executionTrace) {
        const stats = stepStats.get(trace.stepId) || {
          totalDuration: 0,
          hits: 0,
          cacheHits: 0,
        };
        stats.totalDuration += trace.duration;
        stats.hits++;
        if (trace.cacheHit) stats.cacheHits++;
        stepStats.set(trace.stepId, stats);
      }
    }

    const mostCachedSteps = Array.from(stepStats.entries())
      .map(([stepId, stats]) => ({ stepId, hits: stats.cacheHits }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);

    const performanceBottlenecks = Array.from(stepStats.entries())
      .map(([stepId, stats]) => ({
        stepId,
        avgDuration: stats.totalDuration / stats.hits,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10);

    return {
      totalExecutions: filteredExecutions.length,
      successRate: successfulExecutions / filteredExecutions.length,
      avgDuration:
        filteredExecutions.reduce((sum, e) => sum + e.duration, 0) /
        filteredExecutions.length,
      cacheHitRate: totalSteps > 0 ? cachedSteps / totalSteps : 0,
      mostCachedSteps,
      performanceBottlenecks,
    };
  }

  /**
   * Invalidate workflow cache by dependencies
   */
  invalidateWorkflowCache(dependencies: string[]): number {
    let invalidated = 0;

    // Invalidate step cache
    for (const [key, entry] of this.workflowCache.entries()) {
      const hasInvalidDependency = entry.dependencies.some((dep) =>
        dependencies.includes(dep)
      );

      if (hasInvalidDependency) {
        this.workflowCache.delete(key);
        invalidated++;
      }
    }

    // Invalidate chain cache
    for (const key of this.chainCache.keys()) {
      // Simple pattern matching - in production, use more sophisticated dependency tracking
      const hasInvalidDependency = dependencies.some((dep) =>
        key.includes(dep)
      );
      if (hasInvalidDependency) {
        this.chainCache.delete(key);
        invalidated++;
      }
    }

    loggingService.info('Workflow cache invalidated', {
      dependencies,
      invalidated,
    });
    return invalidated;
  }

  /**
   * Clear all workflow caches
   */
  clearCaches(): void {
    this.workflowCache.clear();
    this.chainCache.clear();
    this.stepCache.clear();
    this.executionHistory.clear();
    this.dependencyGraph.clear();
    loggingService.info('All workflow caches cleared');
  }

  // Private helper methods

  private async executeTextStep(
    step: WorkflowStep,
    model: LanguageModel,
    context: WorkflowContext
  ): Promise<string> {
    if (!step.prompt) {
      throw new Error(`Text step ${step.id} missing prompt`);
    }

    const interpolatedPrompt = this.interpolatePrompt(step.prompt, context);

    const result = await generateText({
      model,
      prompt: interpolatedPrompt,
      temperature: step.metadata?.temperature || 0.7,
    });

    return result.text;
  }

  private async executeObjectStep(
    step: WorkflowStep,
    model: LanguageModel,
    context: WorkflowContext
  ): Promise<any> {
    if (!(step.prompt && step.schema)) {
      throw new Error(`Object step ${step.id} missing prompt or schema`);
    }

    const interpolatedPrompt = this.interpolatePrompt(step.prompt, context);

    // Use memoized generation for better performance
    return structuredMemoizer.memoizedGenerateObject(
      model,
      interpolatedPrompt,
      step.schema,
      {
        temperature: step.metadata?.temperature || 0.7,
        dependencies: step.dependencies,
        customKey: `${context.workflowId}:${step.id}:${this.hashInput(interpolatedPrompt)}`,
      }
    );
  }

  private async executeStreamStep(
    step: WorkflowStep,
    model: LanguageModel,
    context: WorkflowContext
  ): Promise<string[]> {
    if (!step.prompt) {
      throw new Error(`Stream step ${step.id} missing prompt`);
    }

    const interpolatedPrompt = this.interpolatePrompt(step.prompt, context);
    const chunks: string[] = [];

    // Use streaming optimizer
    const optimizedStream = await streamingOptimizer.optimizeTextStream(
      async () => {
        const result = await import('ai').then((ai) =>
          ai.streamText({
            model,
            prompt: interpolatedPrompt,
            temperature: step.metadata?.temperature || 0.7,
          })
        );
        return result.textStream;
      },
      {
        cacheKey: `${context.workflowId}:${step.id}:${this.hashInput(interpolatedPrompt)}`,
        enableCache: true,
        enableCompression: true,
      }
    );

    for await (const chunk of optimizedStream) {
      chunks.push(chunk.data);
    }

    return chunks;
  }

  private async executeFunctionStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<any> {
    if (!step.function) {
      throw new Error(`Function step ${step.id} missing function`);
    }

    // Prepare function arguments from context
    const args = this.prepareFunctionArgs(step, context);

    return step.function(...args);
  }

  private async attemptStepRecovery(
    step: WorkflowStep,
    error: any,
    context: WorkflowContext,
    trace: WorkflowExecutionTrace
  ): Promise<any> {
    // Implement recovery strategies based on error type and step configuration
    loggingService.warn('Attempting step recovery', {
      stepId: step.id,
      executionId: context.executionId,
      error: error.message,
    });

    // For now, return null to indicate recovery failed
    // In production, implement sophisticated recovery strategies
    return null;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateStepCacheKey(
    step: WorkflowStep,
    context: WorkflowContext
  ): string {
    const keyData = {
      workflowId: context.workflowId,
      stepId: step.id,
      prompt: step.prompt,
      schema: step.schema ? JSON.stringify(step.schema) : null,
      variables: context.variables,
      metadata: step.metadata,
    };

    return `step:${this.hashInput(JSON.stringify(keyData))}`;
  }

  private generateChainCacheKey(
    workflow: WorkflowDefinition,
    context: WorkflowContext
  ): string {
    const keyData = {
      workflowId: workflow.id,
      version: workflow.version,
      variables: context.variables,
      userId: context.userId,
      sessionId: context.sessionId,
    };

    return `chain:${this.hashInput(JSON.stringify(keyData))}`;
  }

  private interpolatePrompt(prompt: string, context: WorkflowContext): string {
    let interpolated = prompt;

    // Replace variables
    for (const [key, value] of Object.entries(context.variables)) {
      interpolated = interpolated.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
        String(value)
      );
    }

    // Replace step results
    for (const [stepId, result] of context.stepResults) {
      interpolated = interpolated.replace(
        new RegExp(`\\{\\{${stepId}\\}\\}`, 'g'),
        typeof result === 'string' ? result : JSON.stringify(result)
      );
    }

    return interpolated;
  }

  private prepareFunctionArgs(
    step: WorkflowStep,
    context: WorkflowContext
  ): any[] {
    // Extract arguments from step metadata and context
    const argNames = step.metadata?.args || [];
    const args: any[] = [];

    for (const argName of argNames) {
      if (context.variables[argName] !== undefined) {
        args.push(context.variables[argName]);
      } else if (context.stepResults.has(argName)) {
        args.push(context.stepResults.get(argName));
      } else {
        args.push(undefined);
      }
    }

    return args;
  }

  private async getStepCacheResult(
    key: string,
    dependencies: string[]
  ): Promise<any> {
    return this.stepCache.getCachedResponse(
      key,
      async () => null, // Will not be called if cache hit
      { force: false }
    );
  }

  private async getChainCacheResult(key: string): Promise<any> {
    return this.chainCache.get(key) ?? null;
  }

  private async cacheStepResult(
    key: string,
    result: any,
    dependencies: string[],
    computationTime: number
  ): Promise<void> {
    await this.stepCache.getCachedResponse(key, async () => result, {
      ttl: 1_800_000, // 30 minutes
      tags: dependencies,
    });

    // Store additional metadata
    this.workflowCache.set(key, {
      workflowId: '',
      stepId: '',
      inputHash: key,
      result,
      dependencies,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      usageCount: 1,
      computationTime,
      size: this.calculateSize(result),
    });
  }

  private async cacheChainResult(
    key: string,
    result: any,
    ttl: number
  ): Promise<void> {
    this.chainCache.set(key, result);

    // Implement TTL cleanup
    setTimeout(() => {
      this.chainCache.delete(key);
    }, ttl);
  }

  private hashInput(input: any): string {
    const str = typeof input === 'string' ? input : JSON.stringify(input);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private calculateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // UTF-16 encoding
    } catch {
      return 1024; // Default size
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Create singleton instance
const workflowCachingEngine = WorkflowCachingEngine.getInstance();

// Export convenience functions
export async function executeWorkflowWithCaching(
  workflow: WorkflowDefinition,
  model: LanguageModel,
  context?: Partial<WorkflowContext>
): Promise<WorkflowResult> {
  return workflowCachingEngine.executeWorkflow(workflow, model, context);
}

export function getWorkflowAnalytics(workflowId?: string) {
  return workflowCachingEngine.getWorkflowAnalytics(workflowId);
}

export function invalidateWorkflowCacheByDependencies(
  dependencies: string[]
): number {
  return workflowCachingEngine.invalidateWorkflowCache(dependencies);
}

export function clearWorkflowCaches(): void {
  workflowCachingEngine.clearCaches();
}

// Export singleton
export { workflowCachingEngine };
