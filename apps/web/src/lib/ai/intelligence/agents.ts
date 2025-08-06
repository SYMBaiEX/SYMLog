import { generateText, streamText } from 'ai';
import { getAIModel } from '../core/providers';
import { artifactTools } from '../tools/artifact-tools';

// Constants for agent configuration
const DEFAULT_MAX_STEPS = 10;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4096;
const MAX_PROMPT_LENGTH = 10_000;
const DEPENDENCY_CHECK_TIMEOUT = 5000; // 5 seconds
const MAX_WORKFLOW_STEPS = 50;
const MAX_CONCURRENCY = 3; // Maximum concurrent operations to prevent resource exhaustion

// Agent configuration interface
export interface AgentConfig {
  /** Model to use for the agent */
  model?: string;
  /** System prompt for the agent */
  system: string;
  /** Tools available to the agent */
  tools?: Record<string, any>;
  /** Maximum number of steps to execute */
  maxSteps?: number;
  /** Temperature for generation */
  temperature?: number;
  /** Maximum tokens per response */
  maxOutputTokens?: number;
  /** Agent name for logging */
  name?: string;
}

// Agent step interface
export interface AgentStep {
  stepNumber: number;
  stepType: string;
  input: string;
  output: string;
  toolCalls?: any[];
  toolResults?: any[];
  reasoning?: string;
  timestamp: Date;
}

// Agent result interface
export interface AgentResult {
  result: string;
  steps: AgentStep[];
  totalSteps: number;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  success: boolean;
  error?: string;
}

/**
 * SYMLog Agent class for complex multi-step workflows
 * Implements AI SDK 5.0 Agent patterns for agentic conversations
 */
export class SYMLogAgent {
  private config: Required<AgentConfig>;
  private steps: AgentStep[] = [];
  private currentStep = 0;

  constructor(config: AgentConfig) {
    this.config = {
      model: config.model || 'gpt-4.1-nano',
      system: config.system,
      tools: config.tools || artifactTools,
      maxSteps: config.maxSteps || DEFAULT_MAX_STEPS,
      temperature: config.temperature || DEFAULT_TEMPERATURE,
      maxOutputTokens: config.maxOutputTokens || DEFAULT_MAX_TOKENS,
      name: config.name || 'SYMLogAgent',
    };
  }

  /**
   * Execute a multi-step workflow synchronously
   * @param prompt Initial prompt to start the workflow
   * @returns Promise resolving to agent result
   */
  async execute(prompt: string): Promise<AgentResult> {
    this.reset(); // Clear previous state
    let currentInput = prompt;

    try {
      const result = await generateText({
        model: getAIModel(this.config.model),
        system: this.config.system,
        prompt: this.sanitizePrompt(currentInput),
        tools: this.config.tools,
        temperature: this.config.temperature,
        maxOutputTokens: this.config.maxOutputTokens,
        onStepFinish: ({ text, toolCalls, toolResults, finishReason }) => {
          this.currentStep++;

          // Update current input for next step tracking
          const stepInput = text || currentInput;

          const agentStep: AgentStep = {
            stepNumber: this.currentStep,
            stepType: 'text',
            input: stepInput,
            output: text || '',
            toolCalls,
            toolResults,
            reasoning: undefined,
            timestamp: new Date(),
          };

          this.steps.push(agentStep);

          // Update current input for next iteration
          if (stepInput !== currentInput) {
            currentInput = stepInput;
          }

          // Check if we should stop - just track state, don't return
          if (this.currentStep >= this.config.maxSteps) {
            // Stop will be handled by maxSteps config
            return;
          }

          // Check completion conditions
          if (finishReason === 'stop' || this.isWorkflowComplete(agentStep)) {
            // Stop will be handled by finish reason
            return;
          }
        },
      });

      const agentResult = {
        result: result.text,
        steps: this.steps,
        totalSteps: this.currentStep,
        finishReason: result.finishReason,
        usage: {
          promptTokens: (result.usage as any)?.promptTokens || 0,
          completionTokens: (result.usage as any)?.completionTokens || 0,
          totalTokens: (result.usage as any)?.totalTokens || 0,
        },
        success: true,
      };

      // Auto-cleanup after successful execution
      this.reset();

      return agentResult;
    } catch (error) {
      const errorResult = {
        result: '',
        steps: this.steps,
        totalSteps: this.currentStep,
        finishReason: 'error',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      // Auto-cleanup after error
      this.reset();

      return errorResult;
    }
  }

  /**
   * Execute a multi-step workflow with streaming
   * @param prompt Initial prompt to start the workflow
   * @returns Streaming text result
   */
  stream(prompt: string) {
    this.reset(); // Clear previous state
    let currentInput = prompt;

    return streamText({
      model: getAIModel(this.config.model),
      system: this.config.system,
      prompt: this.sanitizePrompt(currentInput),
      tools: this.config.tools,
      temperature: this.config.temperature,
      maxOutputTokens: this.config.maxOutputTokens,
      onStepFinish: ({ text, toolCalls, toolResults, finishReason }) => {
        this.currentStep++;

        // Update current input for step tracking
        const stepInput = text || currentInput;

        const agentStep: AgentStep = {
          stepNumber: this.currentStep,
          stepType: 'text',
          input: stepInput,
          output: text || '',
          toolCalls,
          toolResults,
          reasoning: undefined,
          timestamp: new Date(),
        };

        this.steps.push(agentStep);

        // Update current input for next iteration
        if (stepInput !== currentInput) {
          currentInput = stepInput;
        }

        // Check stop conditions - just track state for streaming
        if (this.currentStep >= this.config.maxSteps) {
          // Stop will be handled by maxSteps config
          return;
        }

        if (finishReason === 'stop' || this.isWorkflowComplete(agentStep)) {
          // Stop will be handled by finish reason
          return;
        }
      },
    });
  }

  /**
   * Get the current workflow steps
   * @returns Array of agent steps
   */
  getSteps(): AgentStep[] {
    return [...this.steps];
  }

  /**
   * Get the current step number
   * @returns Current step number
   */
  getCurrentStep(): number {
    return this.currentStep;
  }

  /**
   * Reset the agent state
   */
  reset(): void {
    this.steps = [];
    this.currentStep = 0;
  }

  /**
   * Check if the workflow is complete based on tool results
   * @param step Current agent step
   * @returns Boolean indicating if workflow is complete
   */
  private isWorkflowComplete(step: AgentStep): boolean {
    // Check if any tool results indicate completion
    return (
      step.toolResults?.some(
        (result) =>
          result.type === 'complete' ||
          result.status === 'completed' ||
          result.done === true
      ) ?? false
    );
  }

  /**
   * Sanitize input prompt to prevent injection with enhanced safety
   * @param prompt Input prompt
   * @returns Sanitized prompt
   */
  private sanitizePrompt(prompt: string): string {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt must be a non-empty string');
    }

    let sanitized = prompt
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[{}]/g, '') // Remove curly braces
      .replace(/\b(eval|function|script|javascript|vbscript)\b/gi, '') // Remove injection keywords
      .trim();

    // Smart truncation for better context preservation
    if (sanitized.length > MAX_PROMPT_LENGTH) {
      // Try to find sentence boundary
      const sentences = sanitized.split(/[.!?]+/);
      let truncated = '';

      for (const sentence of sentences) {
        if (truncated.length + sentence.length < MAX_PROMPT_LENGTH - 50) {
          truncated += sentence + '. ';
        } else {
          break;
        }
      }

      if (truncated.length < MAX_PROMPT_LENGTH / 2) {
        // If sentence-based truncation is too aggressive, use word boundary
        const words = sanitized.split(' ');
        truncated = '';
        for (const word of words) {
          if (truncated.length + word.length < MAX_PROMPT_LENGTH - 10) {
            truncated += word + ' ';
          } else {
            break;
          }
        }
      }

      console.warn(
        `Agent prompt truncated from ${sanitized.length} to ${truncated.length} characters`
      );
      sanitized = truncated.trim();
    }

    return sanitized;
  }
}

// Predefined agent configurations for common use cases

/**
 * Research Agent - Multi-step information gathering
 */
export class ResearchAgent extends SYMLogAgent {
  constructor(options: { maxSteps?: number; temperature?: number } = {}) {
    super({
      name: 'ResearchAgent',
      system: `You are a research agent capable of gathering and analyzing information through multiple steps.
      
Your capabilities:
1. Break down complex research questions into smaller, manageable parts
2. Use available tools to gather information
3. Analyze and synthesize findings
4. Provide comprehensive, well-structured reports

Always think step by step and explain your reasoning at each stage.`,
      maxSteps: options.maxSteps || 8,
      temperature: options.temperature || 0.3,
      tools: artifactTools,
    });
  }
}

/**
 * Code Agent - Complex code generation with validation
 */
export class CodeAgent extends SYMLogAgent {
  constructor(options: { maxSteps?: number; temperature?: number } = {}) {
    super({
      name: 'CodeAgent',
      system: `You are a specialized code generation agent that creates high-quality, production-ready code.

Your workflow:
1. Analyze the requirements and break them down
2. Design the architecture or approach
3. Generate code with proper error handling
4. Create tests for the code
5. Provide documentation
6. Validate the final implementation

Always follow best practices, use proper typing, and include comprehensive error handling.`,
      maxSteps: options.maxSteps || 12,
      temperature: options.temperature || 0.2,
      tools: artifactTools,
    });
  }
}

/**
 * Analysis Agent - Deep data analysis with reasoning steps
 */
export class AnalysisAgent extends SYMLogAgent {
  constructor(options: { maxSteps?: number; temperature?: number } = {}) {
    super({
      name: 'AnalysisAgent',
      system: `You are an analysis agent specialized in deep data analysis and pattern recognition.

Your approach:
1. Examine the data or problem systematically
2. Identify key patterns, trends, or insights
3. Apply relevant analytical frameworks
4. Generate visualizations where helpful
5. Provide actionable recommendations
6. Validate findings through multiple perspectives

Be thorough, objective, and provide evidence-based conclusions.`,
      maxSteps: options.maxSteps || 10,
      temperature: options.temperature || 0.4,
      tools: artifactTools,
    });
  }
}

/**
 * Planning Agent - Project breakdown and task management
 */
export class PlanningAgent extends SYMLogAgent {
  constructor(options: { maxSteps?: number; temperature?: number } = {}) {
    super({
      name: 'PlanningAgent',
      system: `You are a project planning agent that excels at breaking down complex projects into manageable tasks.

Your methodology:
1. Understand the project scope and requirements
2. Identify key deliverables and milestones
3. Break down work into specific, actionable tasks
4. Estimate effort and dependencies
5. Create realistic timelines
6. Identify potential risks and mitigation strategies
7. Generate comprehensive project documentation

Focus on creating practical, executable plans with clear success criteria.`,
      maxSteps: options.maxSteps || 8,
      temperature: options.temperature || 0.5,
      tools: artifactTools,
    });
  }
}

// Utility functions for agent management

/**
 * Create an agent based on task type
 * @param taskType Type of task to create agent for
 * @param options Additional agent options
 * @returns Configured agent instance
 */
export function createAgent(
  taskType: 'research' | 'code' | 'analysis' | 'planning' | 'custom',
  options: {
    system?: string;
    maxSteps?: number;
    temperature?: number;
    tools?: Record<string, any>;
  } = {}
): SYMLogAgent {
  switch (taskType) {
    case 'research':
      return new ResearchAgent(options);
    case 'code':
      return new CodeAgent(options);
    case 'analysis':
      return new AnalysisAgent(options);
    case 'planning':
      return new PlanningAgent(options);
    case 'custom':
      if (!options.system) {
        throw new Error('Custom agent requires system prompt');
      }
      return new SYMLogAgent({
        system: options.system,
        maxSteps: options.maxSteps,
        temperature: options.temperature,
        tools: options.tools,
      });
    default:
      throw new Error(`Unknown agent type: ${taskType}`);
  }
}

// Custom error types for better error handling
class WorkflowExecutionError extends Error {
  constructor(
    message: string,
    public readonly agentName?: string,
    public readonly stepIndex?: number,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'WorkflowExecutionError';
  }
}

class DependencyError extends WorkflowExecutionError {
  constructor(
    agentName: string,
    missingDependencies: string[],
    stepIndex: number
  ) {
    super(
      `Dependencies not met for agent ${agentName}: missing [${missingDependencies.join(', ')}]`,
      agentName,
      stepIndex
    );
    this.name = 'DependencyError';
  }
}

/**
 * Enhanced agent workflow coordinator for complex multi-agent tasks
 */
export class AgentWorkflow {
  private agents: Map<string, SYMLogAgent> = new Map();
  private workflowSteps: Array<{
    id: string;
    agentName: string;
    input: string;
    dependencies: string[];
    priority?: number;
  }> = [];
  private executionOrder: string[] = [];
  private readonly maxConcurrency: number = MAX_CONCURRENCY;

  /**
   * Add an agent to the workflow
   * @param name Agent name
   * @param agent Agent instance
   */
  addAgent(name: string, agent: SYMLogAgent): void {
    if (this.agents.has(name)) {
      console.warn(`Agent ${name} already exists, replacing existing agent`);
    }
    this.agents.set(name, agent);
  }

  /**
   * Add a workflow step with enhanced validation
   * @param agentName Name of agent to execute
   * @param input Input for the agent
   * @param dependencies Names of agents that must complete first
   * @param priority Optional priority for parallel execution
   */
  addStep(
    agentName: string,
    input: string,
    dependencies: string[] = [],
    priority = 0
  ): string {
    if (this.workflowSteps.length >= MAX_WORKFLOW_STEPS) {
      throw new Error(
        `Maximum workflow steps (${MAX_WORKFLOW_STEPS}) exceeded`
      );
    }

    const stepId = `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    // Validate dependencies exist
    const invalidDeps = dependencies.filter(
      (dep) =>
        !(
          this.workflowSteps.some((step) => step.agentName === dep) ||
          this.agents.has(dep)
        )
    );

    if (invalidDeps.length > 0) {
      console.warn(
        `Some dependencies may not exist: [${invalidDeps.join(', ')}]`
      );
    }

    this.workflowSteps.push({
      id: stepId,
      agentName,
      input: this.sanitizeWorkflowInput(input),
      dependencies,
      priority,
    });

    return stepId;
  }

  /**
   * Execute the workflow with enhanced error handling and parallel processing
   * @returns Promise resolving to workflow results
   */
  async execute(): Promise<Map<string, AgentResult>> {
    const results = new Map<string, AgentResult>();
    const completed = new Set<string>();
    const inProgress = new Set<string>();

    // Build execution order considering dependencies and priorities
    this.buildExecutionOrder();

    // Group steps by dependency level for potential parallel execution
    const dependencyLevels = this.groupStepsByDependencyLevel();

    for (let level = 0; level < dependencyLevels.length; level++) {
      const levelSteps = dependencyLevels[level];

      // Execute independent steps with controlled concurrency
      const levelResults = await this.executeConcurrently(
        levelSteps,
        async (step, stepIndex) => {
          try {
            // Double-check dependencies
            const missingDeps = step.dependencies.filter(
              (dep) => !completed.has(dep)
            );
            if (missingDeps.length > 0) {
              throw new DependencyError(step.agentName, missingDeps, stepIndex);
            }

            const agent = this.agents.get(step.agentName);
            if (!agent) {
              throw new WorkflowExecutionError(
                `Agent ${step.agentName} not found`,
                step.agentName,
                stepIndex
              );
            }

            inProgress.add(step.agentName);

            // Build contextual input with data sensitivity handling
            const contextualInput = this.buildContextualInput(step, results);

            const result = await agent.execute(contextualInput);

            inProgress.delete(step.agentName);
            completed.add(step.agentName);

            return { stepName: step.agentName, result };
          } catch (error) {
            inProgress.delete(step.agentName);

            if (error instanceof WorkflowExecutionError) {
              throw error;
            }

            throw new WorkflowExecutionError(
              `Execution failed for agent ${step.agentName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              step.agentName,
              stepIndex,
              error instanceof Error ? error : undefined
            );
          }
        }
      );

      // Store results
      for (const { stepName, result } of levelResults) {
        results.set(stepName, result);
      }
    }

    return results;
  }

  /**
   * Execute tasks with controlled concurrency to prevent resource exhaustion
   * @param items Array of items to process
   * @param processor Function to process each item
   * @returns Promise resolving to array of results
   */
  private async executeConcurrently<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);

    // Process items in batches with controlled concurrency
    for (let i = 0; i < items.length; i += this.maxConcurrency) {
      const batch = items.slice(i, i + this.maxConcurrency);
      const batchPromises = batch.map(async (item, batchIndex) => {
        const actualIndex = i + batchIndex;
        try {
          const result = await processor(item, actualIndex);
          results[actualIndex] = result;
          return result;
        } catch (error) {
          // Re-throw to maintain error handling in calling code
          throw error;
        }
      });

      // Wait for this batch to complete before starting the next
      await Promise.all(batchPromises);
    }

    return results;
  }

  /**
   * Build execution order considering dependencies
   */
  private buildExecutionOrder(): void {
    // Simple topological sort for dependency resolution
    const visited = new Set<string>();
    const visiting = new Set<string>();
    this.executionOrder = [];

    const visit = (stepId: string) => {
      if (visiting.has(stepId)) {
        throw new Error(
          `Circular dependency detected involving step ${stepId}`
        );
      }

      if (visited.has(stepId)) {
        return;
      }

      visiting.add(stepId);

      const step = this.workflowSteps.find((s) => s.id === stepId);
      if (step) {
        for (const dep of step.dependencies) {
          const depStep = this.workflowSteps.find((s) => s.agentName === dep);
          if (depStep) {
            visit(depStep.id);
          }
        }
      }

      visiting.delete(stepId);
      visited.add(stepId);
      this.executionOrder.push(stepId);
    };

    for (const step of this.workflowSteps) {
      visit(step.id);
    }
  }

  /**
   * Group steps by dependency level for parallel execution
   */
  private groupStepsByDependencyLevel(): Array<
    Array<(typeof this.workflowSteps)[number]>
  > {
    const levels: Array<Array<(typeof this.workflowSteps)[number]>> = [];
    const processedSteps = new Set<string>();

    while (processedSteps.size < this.workflowSteps.length) {
      const currentLevel: Array<(typeof this.workflowSteps)[number]> = [];

      for (const step of this.workflowSteps) {
        if (processedSteps.has(step.id)) continue;

        // Check if all dependencies are already processed
        const depsProcessed = step.dependencies.every(
          (dep) =>
            processedSteps.has(dep) ||
            this.workflowSteps.some(
              (s) => s.agentName === dep && processedSteps.has(s.id)
            )
        );

        if (depsProcessed || step.dependencies.length === 0) {
          currentLevel.push(step);
          processedSteps.add(step.id);
        }
      }

      if (currentLevel.length === 0) {
        throw new Error('Circular dependency detected in workflow');
      }

      // Sort by priority within level
      currentLevel.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      levels.push(currentLevel);
    }

    return levels;
  }

  /**
   * Sanitize workflow input to prevent data leakage
   */
  private sanitizeWorkflowInput(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Remove potential sensitive patterns
    return input
      .replace(/\b(?:password|secret|key|token)\s*[:=]\s*\S+/gi, '[REDACTED]')
      .replace(/<[^>]*>/g, '') // Remove HTML
      .trim();
  }

  /**
   * Build contextual input with data sensitivity handling
   */
  private buildContextualInput(
    step: (typeof this.workflowSteps)[number],
    results: Map<string, AgentResult>
  ): string {
    let contextualInput = step.input;

    for (const dep of step.dependencies) {
      const depResult = results.get(dep);
      if (depResult && depResult.success) {
        // Limit context size to prevent overwhelming the agent
        const contextSnippet =
          depResult.result.length > 1000
            ? depResult.result.substring(0, 1000) + '... [truncated]'
            : depResult.result;

        contextualInput += `\n\n--- Context from ${dep} ---\n${contextSnippet}`;
      }
    }

    return contextualInput;
  }

  /**
   * Get workflow statistics
   */
  getWorkflowStats(): {
    totalSteps: number;
    totalAgents: number;
    maxDependencyDepth: number;
    hasCircularDependencies: boolean;
  } {
    try {
      this.buildExecutionOrder();

      return {
        totalSteps: this.workflowSteps.length,
        totalAgents: this.agents.size,
        maxDependencyDepth: this.calculateMaxDependencyDepth(),
        hasCircularDependencies: false,
      };
    } catch (error) {
      return {
        totalSteps: this.workflowSteps.length,
        totalAgents: this.agents.size,
        maxDependencyDepth: -1,
        hasCircularDependencies: true,
      };
    }
  }

  private calculateMaxDependencyDepth(): number {
    let maxDepth = 0;

    const calculateDepth = (
      stepId: string,
      visited: Set<string> = new Set()
    ): number => {
      if (visited.has(stepId)) return 0;
      visited.add(stepId);

      const step = this.workflowSteps.find((s) => s.id === stepId);
      if (!step || step.dependencies.length === 0) return 0;

      const depDepths = step.dependencies.map((dep) => {
        const depStep = this.workflowSteps.find((s) => s.agentName === dep);
        return depStep ? calculateDepth(depStep.id, new Set(visited)) : 0;
      });

      return Math.max(...depDepths) + 1;
    };

    for (const step of this.workflowSteps) {
      maxDepth = Math.max(maxDepth, calculateDepth(step.id));
    }

    return maxDepth;
  }
}

// Export custom error types
export { WorkflowExecutionError, DependencyError };
