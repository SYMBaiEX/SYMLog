import type { ToolChoice } from 'ai';

// Define CoreTool locally since it's not exported from 'ai'
interface CoreTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: object;
  };
}

import { z } from 'zod';
import { logError as logErrorToConsole } from '@/lib/logger';
import { standardErrorHandler, type ToolError } from '../error-handling/error-handler';
import { enhancedArtifactTools } from './enhanced-tools';

// Create a logger wrapper
const loggingService = {
  info: (message: string, data?: unknown) =>
    console.log(`[INFO] ${message}`, data),
  warn: (message: string, data?: unknown) =>
    console.warn(`[WARN] ${message}`, data),
  error: (message: string, data?: unknown) => logErrorToConsole(message, data),
  debug: (message: string, data?: unknown) =>
    console.debug(`[DEBUG] ${message}`, data),
};

// Constants for tool choice configuration
const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8,
  MEDIUM: 0.6,
  BOOST_CREATE: 0.2,
  BOOST_EXECUTE: 0.3,
  BOOST_SIMPLE: 0.1,
  PERFORMANCE_BONUS_MAX: 0.2,
  RECENCY_BONUS_MAX: 0.1,
} as const;

const DEFAULT_METRICS = {
  SUCCESS_RATE: 1.0,
  AVG_EXECUTION_TIME: 1000,
  LEARNING_RATE: 0.1,
} as const;

// Tool choice configuration interface
export interface ToolChoiceConfig {
  mode: 'auto' | 'required' | 'none' | 'tool';
  toolName?: string;
  fallbackBehavior?: 'error' | 'retry' | 'bypass';
  maxRetries?: number;
  timeout?: number;
  priority?: 'high' | 'medium' | 'low';
}

// Tool selection criteria
export interface ToolSelectionCriteria {
  outputType?: 'code' | 'document' | 'chart' | 'data' | 'image' | 'spreadsheet';
  contentType?: 'unknown' | 'code' | 'visualization' | 'data' | 'text';
  complexity?: 'simple' | 'moderate' | 'complex';
  userIntent?: 'create' | 'analyze' | 'transform' | 'execute';
  securityLevel?: 'low' | 'medium' | 'high';
}

// Tool recommendation result
export interface ToolRecommendation {
  toolName: string;
  confidence: number; // 0-1
  reasoning: string;
  alternativeTools: string[];
  choiceMode: ToolChoice<any>;
}

// Enhanced tool choice errors
export class ToolChoiceError extends Error {
  constructor(
    message: string,
    public readonly errorType:
      | 'validation'
      | 'execution'
      | 'timeout'
      | 'unavailable',
    public readonly toolName?: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'ToolChoiceError';
  }
}

// Tool metric interface for proper typing
export interface ToolMetric {
  successRate: number;
  avgExecutionTime: number;
  lastUsed: number;
  usageCount: number;
}

/**
 * Tool Choice Enforcement System
 * Manages required tool usage, smart tool selection, and fallback strategies
 */
export class ToolChoiceEnforcer {
  private static instance: ToolChoiceEnforcer;
  private toolRegistry = new Map<string, CoreTool>();
  private toolMetrics = new Map<string, ToolMetric>();

  private constructor() {
    this.initializeToolRegistry();
  }

  static getInstance(): ToolChoiceEnforcer {
    if (!ToolChoiceEnforcer.instance) {
      ToolChoiceEnforcer.instance = new ToolChoiceEnforcer();
    }
    return ToolChoiceEnforcer.instance;
  }

  /**
   * Initialize the tool registry with available tools
   */
  private initializeToolRegistry(): void {
    // Register enhanced artifact tools
    Object.entries(enhancedArtifactTools).forEach(([name, tool]) => {
      // Convert AI SDK tool to CoreTool format
      const coreTool: CoreTool = {
        type: 'function',
        function: {
          name,
          description: tool.description || `Enhanced tool: ${name}`,
          parameters: tool.inputSchema || {},
        },
      };

      this.toolRegistry.set(name, coreTool);

      // Initialize metrics with default values
      this.toolMetrics.set(name, {
        successRate: DEFAULT_METRICS.SUCCESS_RATE,
        avgExecutionTime: DEFAULT_METRICS.AVG_EXECUTION_TIME,
        lastUsed: 0,
        usageCount: 0,
      });
    });

    loggingService.info('Tool registry initialized', {
      registeredTools: Array.from(this.toolRegistry.keys()),
      totalTools: this.toolRegistry.size,
    });
  }

  /**
   * Enforce tool usage for specific scenarios
   */
  enforceToolUsage(
    criteria: ToolSelectionCriteria,
    config: ToolChoiceConfig = { mode: 'required' }
  ): ToolChoice<any> {
    try {
      const recommendation = this.recommendTool(criteria);

      switch (config.mode) {
        case 'required':
          // Force tool usage - return specific tool choice
          if (recommendation.confidence > CONFIDENCE_THRESHOLDS.HIGH) {
            loggingService.info('Enforcing required tool usage', {
              toolName: recommendation.toolName,
              confidence: recommendation.confidence,
              reasoning: recommendation.reasoning,
            });

            return {
              type: 'tool',
              toolName: recommendation.toolName,
            };
          }

          // Fallback to any required tool if specific recommendation isn't confident enough
          return { type: 'required' } as unknown as ToolChoice<any>;

        case 'tool':
          // Force specific tool
          if (config.toolName && this.toolRegistry.has(config.toolName)) {
            return {
              type: 'tool',
              toolName: config.toolName,
            };
          }
          throw new ToolChoiceError(
            `Tool ${config.toolName} not available`,
            'unavailable',
            config.toolName
          );

        case 'auto':
          // Smart tool selection with preference
          if (recommendation.confidence > CONFIDENCE_THRESHOLDS.MEDIUM) {
            return {
              type: 'tool',
              toolName: recommendation.toolName,
            };
          }
          return { type: 'auto' } as unknown as ToolChoice<any>;

        case 'none':
          return { type: 'none' } as unknown as ToolChoice<any>;

        default:
          return { type: 'auto' } as unknown as ToolChoice<any>;
      }
    } catch (error) {
      const toolError = standardErrorHandler.handleError(error, {
        criteria,
        config,
        context: 'tool-choice-enforcement',
      });

      // Apply fallback behavior
      return this.handleToolChoiceError(toolError, config);
    }
  }

  /**
   * Smart tool recommendation based on criteria
   */
  recommendTool(criteria: ToolSelectionCriteria): ToolRecommendation {
    const scores = new Map<string, number>();
    const reasoning: string[] = [];

    // Score tools based on output type
    if (criteria.outputType) {
      switch (criteria.outputType) {
        case 'code':
          scores.set('createCodeArtifact', 0.9);
          reasoning.push('Code output type detected');
          break;
        case 'document':
          scores.set('createDocumentArtifact', 0.9);
          reasoning.push('Document output type detected');
          break;
        case 'chart':
          scores.set('createChartArtifact', 0.9);
          reasoning.push('Chart output type detected');
          break;
        case 'data':
          scores.set('createCodeArtifact', 0.7); // Can create JSON/CSV
          scores.set('createDocumentArtifact', 0.5); // Can document data
          reasoning.push('Data output type - flexible tools selected');
          break;
      }
    }

    // Factor in user intent
    if (criteria.userIntent) {
      switch (criteria.userIntent) {
        case 'create':
          // Boost creation tools
          this.boostScore(
            scores,
            'createCodeArtifact',
            CONFIDENCE_THRESHOLDS.BOOST_CREATE
          );
          this.boostScore(
            scores,
            'createDocumentArtifact',
            CONFIDENCE_THRESHOLDS.BOOST_CREATE
          );
          this.boostScore(
            scores,
            'createChartArtifact',
            CONFIDENCE_THRESHOLDS.BOOST_CREATE
          );
          reasoning.push('Creation intent detected');
          break;
        case 'execute':
          this.boostScore(
            scores,
            'executeWorkflow',
            CONFIDENCE_THRESHOLDS.BOOST_EXECUTE
          );
          reasoning.push('Execution intent detected');
          break;
        case 'analyze':
          this.boostScore(
            scores,
            'generateStructuredOutput',
            CONFIDENCE_THRESHOLDS.BOOST_CREATE
          );
          reasoning.push('Analysis intent detected');
          break;
      }
    }

    // Factor in complexity
    if (criteria.complexity) {
      switch (criteria.complexity) {
        case 'complex':
          this.boostScore(
            scores,
            'executeWorkflow',
            CONFIDENCE_THRESHOLDS.BOOST_EXECUTE
          );
          reasoning.push('Complex task - workflow tool preferred');
          break;
        case 'simple':
          // Prefer simpler tools
          this.boostScore(
            scores,
            'createDocumentArtifact',
            CONFIDENCE_THRESHOLDS.BOOST_SIMPLE
          );
          reasoning.push('Simple task - basic tools preferred');
          break;
      }
    }

    // Factor in tool performance metrics
    for (const [toolName, score] of scores) {
      const metrics = this.toolMetrics.get(toolName);
      if (metrics) {
        const performanceBonus =
          metrics.successRate * CONFIDENCE_THRESHOLDS.PERFORMANCE_BONUS_MAX;
        const recencyBonus = this.calculateRecencyBonus(metrics.lastUsed);
        scores.set(toolName, score + performanceBonus + recencyBonus);
      }
    }

    // Get best tool
    const bestTool = this.getBestTool(scores);
    const alternatives = this.getAlternativeTools(scores, bestTool.name);

    return {
      toolName: bestTool.name,
      confidence: bestTool.score,
      reasoning: reasoning.join('; '),
      alternativeTools: alternatives,
      choiceMode:
        bestTool.score > CONFIDENCE_THRESHOLDS.HIGH
          ? ({
              type: 'tool',
              toolName: bestTool.name,
            } as unknown as ToolChoice<any>)
          : ({ type: 'auto' } as unknown as ToolChoice<any>),
    };
  }

  /**
   * Dynamic tool selection for output type
   */
  selectToolForOutput(outputType: string, content?: string): string {
    // Validate outputType against known types
    const validOutputTypes = [
      'code',
      'document',
      'chart',
      'data',
      'image',
      'spreadsheet',
    ];
    const validatedOutputType = validOutputTypes.includes(outputType)
      ? (outputType as ToolSelectionCriteria['outputType'])
      : 'document'; // Safe fallback

    const contentAnalysis = this.analyzeContent(content);

    const criteria: ToolSelectionCriteria = {
      outputType: validatedOutputType,
      contentType: contentAnalysis.type,
      complexity: contentAnalysis.complexity,
      userIntent: contentAnalysis.intent,
    };

    const recommendation = this.recommendTool(criteria);
    return recommendation.toolName;
  }

  /**
   * Tool availability check
   */
  isToolAvailable(toolName: string): boolean {
    return this.toolRegistry.has(toolName);
  }

  /**
   * Get all available tools
   */
  getAvailableTools(): string[] {
    return Array.from(this.toolRegistry.keys());
  }

  /**
   * Update tool metrics after execution
   */
  updateToolMetrics(
    toolName: string,
    success: boolean,
    executionTime: number
  ): void {
    const metrics = this.toolMetrics.get(toolName);
    if (!metrics) return;

    // Update success rate using exponential moving average
    const alpha = DEFAULT_METRICS.LEARNING_RATE;
    metrics.successRate =
      metrics.successRate * (1 - alpha) + (success ? 1 : 0) * alpha;

    // Update average execution time
    metrics.avgExecutionTime =
      metrics.avgExecutionTime * (1 - alpha) + executionTime * alpha;

    // Update usage stats
    metrics.lastUsed = Date.now();
    metrics.usageCount++;

    loggingService.debug('Tool metrics updated', {
      toolName,
      success,
      executionTime,
      newSuccessRate: metrics.successRate,
      newAvgTime: metrics.avgExecutionTime,
    });
  }

  /**
   * Get tool performance metrics
   */
  getToolMetrics(
    toolName?: string
  ): Map<string, ToolMetric> | ToolMetric | undefined {
    if (toolName) {
      return this.toolMetrics.get(toolName);
    }
    return this.toolMetrics;
  }

  // Private helper methods

  private boostScore(
    scores: Map<string, number>,
    toolName: string,
    boost: number
  ): void {
    const currentScore = scores.get(toolName) || 0;
    scores.set(toolName, Math.min(1.0, currentScore + boost));
  }

  private getBestTool(scores: Map<string, number>): {
    name: string;
    score: number;
  } {
    let bestTool = { name: '', score: 0 };

    for (const [toolName, score] of scores) {
      if (score > bestTool.score) {
        bestTool = { name: toolName, score };
      }
    }

    // Default to createCodeArtifact if no clear winner
    if (bestTool.score === 0) {
      bestTool = { name: 'createCodeArtifact', score: 0.5 };
    }

    return bestTool;
  }

  private getAlternativeTools(
    scores: Map<string, number>,
    excludeTool: string
  ): string[] {
    return Array.from(scores.entries())
      .filter(([name]) => name !== excludeTool)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);
  }

  private calculateRecencyBonus(lastUsed: number): number {
    if (lastUsed === 0) return 0;

    const hoursSinceUsed = (Date.now() - lastUsed) / (1000 * 60 * 60);
    // Bonus decreases over time, max RECENCY_BONUS_MAX
    return Math.max(
      0,
      CONFIDENCE_THRESHOLDS.RECENCY_BONUS_MAX * Math.exp(-hoursSinceUsed / 24)
    );
  }

  /**
   * Analyze content to determine type, complexity, and intent
   */
  public analyzeContent(content?: string): {
    type: 'unknown' | 'code' | 'visualization' | 'data' | 'text';
    complexity: 'simple' | 'moderate' | 'complex';
    intent: 'create' | 'analyze' | 'transform' | 'execute';
  } {
    if (!content) {
      return { type: 'unknown', complexity: 'simple', intent: 'create' };
    }

    const length = content.length;
    const codePatterns =
      /(?:function|class|import|export|const|let|var|\{|\}|\[|\])/g;
    const codeMatches = content.match(codePatterns)?.length || 0;

    // Determine complexity
    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    if (length > 1000 || codeMatches > 20) {
      complexity = 'complex';
    } else if (length > 200 || codeMatches > 5) {
      complexity = 'moderate';
    }

    // Determine intent
    let intent: 'create' | 'analyze' | 'transform' | 'execute' = 'create';
    if (content.includes('analyze') || content.includes('explain')) {
      intent = 'analyze';
    } else if (content.includes('transform') || content.includes('convert')) {
      intent = 'transform';
    } else if (content.includes('run') || content.includes('execute')) {
      intent = 'execute';
    }

    // Determine type
    let type: 'unknown' | 'code' | 'visualization' | 'data' | 'text' = 'text';
    if (codeMatches > 3) {
      type = 'code';
    } else if (content.includes('chart') || content.includes('graph')) {
      type = 'visualization';
    } else if (content.includes('data') || content.includes('json')) {
      type = 'data';
    }

    return { type, complexity, intent };
  }

  private handleToolChoiceError(
    error: ToolError,
    config: ToolChoiceConfig
  ): ToolChoice<any> {
    const errorType =
      error.code === 'TOOL_CHOICE_ERROR' ? 'unavailable' : 'execution';

    switch (config.fallbackBehavior) {
      case 'retry':
        // Return a safe fallback tool choice
        return { type: 'auto' } as unknown as ToolChoice<any>;

      case 'bypass':
        return { type: 'none' } as unknown as ToolChoice<any>;

      case 'error':
      default:
        // Re-throw the error
        if (error instanceof Error) {
          throw error;
        }
        throw new ToolChoiceError('Unknown tool choice error', errorType);
    }
  }
}

// Export singleton instance
export const toolChoiceEnforcer = ToolChoiceEnforcer.getInstance();

// Convenience functions for common use cases

/**
 * Force tool usage for structured outputs
 */
export function enforceStructuredOutput(
  outputType: 'code' | 'document' | 'chart' | 'data' | 'image',
  complexity: 'simple' | 'moderate' | 'complex' = 'moderate'
): ToolChoice<any> {
  return toolChoiceEnforcer.enforceToolUsage(
    { outputType, complexity, userIntent: 'create' },
    { mode: 'required', fallbackBehavior: 'retry' }
  );
}

/**
 * Smart tool recommendation
 */
export function recommendToolForContent(
  content: string,
  outputType?: string
): ToolRecommendation {
  // Validate outputType if provided
  const validOutputTypes = [
    'code',
    'document',
    'chart',
    'data',
    'image',
    'spreadsheet',
  ];
  const validatedOutputType =
    outputType && validOutputTypes.includes(outputType)
      ? (outputType as ToolSelectionCriteria['outputType'])
      : undefined;

  const contentAnalysis = toolChoiceEnforcer.analyzeContent(content);

  const criteria: ToolSelectionCriteria = {
    outputType: validatedOutputType,
    contentType: contentAnalysis.type,
    complexity: contentAnalysis.complexity,
    userIntent: contentAnalysis.intent,
  };

  return toolChoiceEnforcer.recommendTool(criteria);
}

/**
 * Dynamic tool selection
 */
export function selectOptimalTool(
  userMessage: string,
  previousContext?: unknown[]
): string {
  const outputType = inferOutputType(userMessage);
  return toolChoiceEnforcer.selectToolForOutput(outputType, userMessage);
}

// Helper function to infer output type from user message
function inferOutputType(message: string): string {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes('code') ||
    lowerMessage.includes('function') ||
    lowerMessage.includes('script') ||
    lowerMessage.includes('program')
  ) {
    return 'code';
  }

  if (
    lowerMessage.includes('chart') ||
    lowerMessage.includes('graph') ||
    lowerMessage.includes('visualize') ||
    lowerMessage.includes('plot')
  ) {
    return 'chart';
  }

  if (
    lowerMessage.includes('document') ||
    lowerMessage.includes('write') ||
    lowerMessage.includes('article') ||
    lowerMessage.includes('report')
  ) {
    return 'document';
  }

  if (
    lowerMessage.includes('data') ||
    lowerMessage.includes('json') ||
    lowerMessage.includes('csv') ||
    lowerMessage.includes('table')
  ) {
    return 'data';
  }

  return 'document'; // Default fallback
}

// Validation schemas for API integration
export const toolChoiceConfigSchema = z.object({
  mode: z.enum(['auto', 'required', 'none', 'tool']),
  toolName: z.string().optional(),
  fallbackBehavior: z.enum(['error', 'retry', 'bypass']).optional(),
  maxRetries: z.number().min(0).max(5).optional(),
  timeout: z.number().min(1000).max(60_000).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
});

export const toolSelectionCriteriaSchema = z.object({
  outputType: z
    .enum(['code', 'document', 'chart', 'data', 'image', 'spreadsheet'])
    .optional(),
  contentType: z.string().optional(),
  complexity: z.enum(['simple', 'moderate', 'complex']).optional(),
  userIntent: z.enum(['create', 'analyze', 'transform', 'execute']).optional(),
  securityLevel: z.enum(['low', 'medium', 'high']).optional(),
});

export type ToolChoiceConfigType = z.infer<typeof toolChoiceConfigSchema>;
export type ToolSelectionCriteriaType = z.infer<
  typeof toolSelectionCriteriaSchema
>;
