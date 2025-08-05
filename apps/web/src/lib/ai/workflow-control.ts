import type {
  CoreMessage,
  CoreToolMessage,
  ToolCallPart,
  ToolResultPart,
} from 'ai';
import { generateText, type StopCondition, stepCountIs, streamText } from 'ai';
import { getAIModel } from './providers';
import { artifactTools } from './tools/artifact-tools';

export interface WorkflowStep {
  stepNumber: number;
  stepType: 'text' | 'tool-call' | 'tool-result';
  content?: string;
  toolCalls?: ToolCallPart[];
  toolResults?: ToolResultPart[];
  timestamp: Date;
}

export interface WorkflowResult {
  text: string;
  steps: WorkflowStep[];
  toolCalls?: any[];
  toolResults?: any[];
  finishReason: string;
  usage: any;
}

export interface WorkflowOptions {
  maxSteps?: number;
  stopConditions?: Array<(step: any) => boolean>;
  onStepStart?: (step: number) => void | Promise<void>;
  onStepFinish?: (step: WorkflowStep) => void | Promise<void>;
  onToolCall?: (toolCall: ToolCallPart) => void | Promise<void>;
  onToolResult?: (toolResult: ToolResultPart) => void | Promise<void>;
  tools?: Record<string, any>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Advanced workflow controller for multi-step AI interactions
 */
export class WorkflowController {
  private steps: WorkflowStep[] = [];
  private abortController?: AbortController;

  /**
   * Execute a multi-step workflow with custom stop conditions
   */
  async executeMultiStepWorkflow(
    initialPrompt: string,
    options: WorkflowOptions = {}
  ): Promise<WorkflowResult> {
    const {
      maxSteps = 5,
      stopConditions = [],
      onStepStart,
      onStepFinish,
      onToolCall,
      onToolResult,
      tools = artifactTools,
      model,
      temperature,
      maxTokens,
    } = options;

    this.steps = [];
    this.abortController = new AbortController();

    try {
      const result = await generateText({
        model: getAIModel(model),
        prompt: initialPrompt,
        tools,
        temperature,
        maxRetries: 3,
        maxTokens,
        abortSignal: this.abortController.signal,
        stopWhen: stepCountIs(maxSteps),
        onStepFinish: async ({ step, stepType, toolCalls, toolResults }) => {
          const stepNumber = this.steps.length + 1;

          // Call step start callback
          if (onStepStart) {
            await onStepStart(stepNumber);
          }

          // Create workflow step
          const workflowStep: WorkflowStep = {
            stepNumber,
            stepType: stepType as any,
            timestamp: new Date(),
          };

          // Handle different step types
          if (stepType === 'text' && typeof step === 'string') {
            workflowStep.content = step;
          } else if (stepType === 'tool-calls' && toolCalls) {
            workflowStep.toolCalls = toolCalls;

            // Call tool call callbacks
            for (const toolCall of toolCalls) {
              if (onToolCall) {
                await onToolCall(toolCall);
              }
            }
          } else if (stepType === 'tool-results' && toolResults) {
            workflowStep.toolResults = toolResults;

            // Call tool result callbacks
            for (const toolResult of toolResults) {
              if (onToolResult) {
                await onToolResult(toolResult);
              }
            }
          }

          this.steps.push(workflowStep);

          // Call step finish callback
          if (onStepFinish) {
            await onStepFinish(workflowStep);
          }

          // Check custom stop conditions
          for (const condition of stopConditions) {
            if (condition(workflowStep)) {
              console.log(
                `Workflow stopped by custom condition at step ${stepNumber}`
              );
              return { stop: true };
            }
          }

          // Log progress
          console.log(`Workflow step ${stepNumber}/${maxSteps} completed:`, {
            type: stepType,
            hasToolCalls: !!toolCalls,
            hasToolResults: !!toolResults,
          });
        },
      });

      return {
        text: result.text,
        steps: this.steps,
        toolCalls: result.toolCalls,
        toolResults: result.toolResults,
        finishReason: result.finishReason,
        usage: result.usage,
      };
    } catch (error) {
      console.error('Workflow execution failed:', error);

      // Provide detailed error information
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const workflowError = new Error(
        `Workflow execution failed: ${errorMessage}`
      );

      // Include partial results if available
      const partialResult: WorkflowResult = {
        text: '',
        steps: this.steps,
        toolCalls: [],
        toolResults: [],
        finishReason: 'error',
        usage: null,
      };

      // Add error details to the error object
      Object.assign(workflowError, {
        partialResult,
        originalError: error,
        stepCount: this.steps.length,
      });

      throw workflowError;
    }
  }

  /**
   * Stream a multi-step workflow with real-time updates
   */
  async streamWorkflow(prompt: string, options: WorkflowOptions = {}) {
    try {
      const {
        maxSteps = 5,
        stopConditions = [],
        onStepStart,
        onStepFinish,
        onToolCall,
        onToolResult,
        tools = artifactTools,
        model,
        temperature,
        maxTokens,
      } = options;

      this.steps = [];
      this.abortController = new AbortController();

      return streamText({
        model: getAIModel(model),
        prompt,
        tools,
        temperature,
        maxTokens,
        maxRetries: 3,
        abortSignal: this.abortController.signal,
        stopWhen: stepCountIs(maxSteps),
        onStepFinish: async ({ step, stepType, toolCalls, toolResults }) => {
          const stepNumber = this.steps.length + 1;

          if (onStepStart) {
            await onStepStart(stepNumber);
          }

          const workflowStep: WorkflowStep = {
            stepNumber,
            stepType: stepType as any,
            timestamp: new Date(),
          };

          // Process step based on type
          if (stepType === 'text' && typeof step === 'string') {
            workflowStep.content = step;
          } else if (stepType === 'tool-calls' && toolCalls) {
            workflowStep.toolCalls = toolCalls;
            for (const toolCall of toolCalls) {
              if (onToolCall) await onToolCall(toolCall);
            }
          } else if (stepType === 'tool-results' && toolResults) {
            workflowStep.toolResults = toolResults;
            for (const toolResult of toolResults) {
              if (onToolResult) await onToolResult(toolResult);
            }
          }

          this.steps.push(workflowStep);

          if (onStepFinish) {
            await onStepFinish(workflowStep);
          }

          // Check stop conditions
          for (const condition of stopConditions) {
            if (condition(workflowStep)) {
              return { stop: true };
            }
          }
        },
      });
    } catch (error) {
      console.error('Stream workflow failed:', error);

      // Clean up abort controller
      this.abortController = undefined;

      // Re-throw with context
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Stream workflow failed after ${this.steps.length} steps: ${errorMessage}`
      );
    }
  }

  /**
   * Execute a research workflow that gathers information
   */
  async executeResearchWorkflow(
    topic: string,
    maxSteps = 10
  ): Promise<WorkflowResult> {
    const researchPrompt = `Research the topic: "${topic}". 
    Break down the research into multiple steps:
    1. Identify key aspects to research
    2. Gather information on each aspect
    3. Synthesize findings
    4. Provide a comprehensive summary`;

    return this.executeMultiStepWorkflow(researchPrompt, {
      maxSteps,
      stopConditions: [
        // Stop when we have a final summary
        (step) => step.content?.toLowerCase().includes('final summary:'),
        // Stop if we've gathered enough information
        (step) =>
          step.stepNumber > 5 &&
          step.content?.includes('sufficient information'),
      ],
      onStepFinish: async (step) => {
        console.log(`Research step ${step.stepNumber} completed`);
      },
    });
  }

  /**
   * Execute a code generation workflow with validation
   */
  async executeCodeGenerationWorkflow(
    requirements: string,
    language = 'typescript'
  ): Promise<WorkflowResult> {
    const codePrompt = `Generate ${language} code for: "${requirements}".
    Follow these steps:
    1. Analyze requirements and plan the implementation
    2. Generate the initial code
    3. Review and validate the code
    4. Fix any issues found
    5. Provide the final, tested code`;

    return this.executeMultiStepWorkflow(codePrompt, {
      maxSteps: 8,
      stopConditions: [
        // Stop when code is validated
        (step) => step.content?.includes('✓ Code validated successfully'),
        // Stop if we hit a critical error
        (step) => step.content?.toLowerCase().includes('critical error:'),
      ],
      tools: {
        ...artifactTools,
        validateCode: {
          description: 'Validate generated code',
          inputSchema: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              language: { type: 'string' },
            },
          },
          execute: async ({ code, language }) => {
            // Mock validation
            return { valid: true, message: '✓ Code validated successfully' };
          },
        },
      },
    });
  }

  /**
   * Execute an analysis workflow with iterative refinement
   */
  async executeAnalysisWorkflow(
    data: any,
    analysisType: string
  ): Promise<WorkflowResult> {
    const analysisPrompt = `Perform ${analysisType} analysis on the provided data.
    Steps:
    1. Initial data exploration
    2. Identify patterns and insights
    3. Deep dive into significant findings
    4. Generate visualizations if applicable
    5. Provide actionable recommendations`;

    return this.executeMultiStepWorkflow(analysisPrompt, {
      maxSteps: 7,
      stopConditions: [
        // Stop when recommendations are complete
        (step) =>
          step.content?.includes('## Recommendations') &&
          step.content?.includes('## Conclusion'),
      ],
      onStepFinish: async (step) => {
        if (
          step.toolCalls?.some((tc) => tc.toolName === 'createChartArtifact')
        ) {
          console.log('Chart artifact created in analysis');
        }
      },
    });
  }

  /**
   * Get current workflow steps
   */
  getSteps(): WorkflowStep[] {
    return [...this.steps];
  }

  /**
   * Abort the current workflow
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Clear workflow history
   */
  clear(): void {
    this.steps = [];
    this.abortController = undefined;
  }
}

/**
 * Create a custom stop condition
 */
export function createStopCondition(
  predicate: (step: WorkflowStep) => boolean,
  description?: string
): (step: any) => boolean {
  const condition = (step: any) => {
    try {
      return predicate(step);
    } catch (error) {
      console.error(
        `Stop condition error${description ? ` (${description})` : ''}:`,
        error
      );
      return false;
    }
  };

  // Add description for debugging
  if (description) {
    Object.defineProperty(condition, 'description', {
      value: description,
      enumerable: false,
    });
  }

  return condition;
}

/**
 * Common stop conditions
 */
export const commonStopConditions = {
  // Stop after specific tool execution
  afterToolExecution: (toolName: string) =>
    createStopCondition(
      (step) =>
        step.toolResults?.some((tr) => tr.toolName === toolName) ?? false,
      `After ${toolName} execution`
    ),

  // Stop when content contains keyword
  contentContains: (keyword: string) =>
    createStopCondition(
      (step) => step.content?.includes(keyword) ?? false,
      `Content contains "${keyword}"`
    ),

  // Stop after certain number of tool calls
  maxToolCalls: (max: number) => {
    let toolCallCount = 0;
    return createStopCondition((step) => {
      if (step.toolCalls) {
        toolCallCount += step.toolCalls.length;
      }
      return toolCallCount >= max;
    }, `Max ${max} tool calls`);
  },

  // Stop on error
  onError: () =>
    createStopCondition(
      (step) => step.toolResults?.some((tr) => tr.isError) ?? false,
      'On error'
    ),

  // Stop on completion marker
  onCompletion: () =>
    createStopCondition((step) => {
      const markers = ['[COMPLETE]', '[DONE]', '✓ Complete', '## Conclusion'];
      return markers.some((marker) => step.content?.includes(marker) ?? false);
    }, 'On completion marker'),
};

// Export singleton instance
export const workflowController = new WorkflowController();
