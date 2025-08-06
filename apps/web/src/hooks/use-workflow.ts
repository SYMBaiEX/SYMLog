'use client';

import { generateText, streamText } from 'ai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getAIModel } from '@/lib/ai/core';
import {
  enhancedArtifactTools,
  executeToolWorkflow,
} from '@/lib/ai/tools';

export interface WorkflowStep {
  id: string;
  type: 'text' | 'tool' | 'decision' | 'parallel';
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: any;
  error?: string;
  duration?: number;
  toolName?: string;
  toolParams?: any;
  condition?: (context: WorkflowContext) => boolean;
  children?: WorkflowStep[]; // For parallel steps
}

export interface WorkflowContext {
  previousResults: any[];
  variables: Record<string, any>;
  currentStepIndex: number;
  abortSignal?: AbortSignal;
}

export interface WorkflowOptions {
  model?: string;
  maxSteps?: number;
  timeout?: number;
  onStepStart?: (step: WorkflowStep) => void;
  onStepComplete?: (step: WorkflowStep, result: any) => void;
  onStepError?: (step: WorkflowStep, error: Error) => void;
  stopCondition?: (context: WorkflowContext) => boolean;
}

/**
 * Hook for executing multi-step AI workflows
 */
export function useWorkflow(options: WorkflowOptions = {}) {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [context, setContext] = useState<WorkflowContext>({
    previousResults: [],
    variables: {},
    currentStepIndex: -1,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  /**
   * Execute a single workflow step
   */
  const executeStep = useCallback(
    async (step: WorkflowStep, stepContext: WorkflowContext): Promise<any> => {
      const startTime = Date.now();

      try {
        // Update step status
        setSteps((prev) =>
          prev.map((s) =>
            s.id === step.id ? { ...s, status: 'running' as const } : s
          )
        );

        options.onStepStart?.(step);

        let result: any;

        switch (step.type) {
          case 'text': {
            // Generate text using AI
            const textResult = await generateText({
              model: getAIModel(options.model),
              prompt: step.description,
              abortSignal: stepContext.abortSignal,
            });
            result = textResult.text;
            break;
          }

          case 'tool': {
            // Execute tool
            if (!step.toolName) {
              throw new Error('Tool name is required for tool steps');
            }

            const tool =
              enhancedArtifactTools[
                step.toolName as keyof typeof enhancedArtifactTools
              ];
            if (!tool) {
              throw new Error(`Tool ${step.toolName} not found`);
            }

            if (!tool.execute) {
              throw new Error(
                `Tool ${step.toolName} does not have an execute method`
              );
            }

            result = await tool.execute(step.toolParams || {}, {
              toolCallId: `${step.id}-${Date.now()}`,
              messages: [],
            });
            break;
          }

          case 'decision': {
            // Check condition and potentially skip
            if (step.condition && !step.condition(stepContext)) {
              setSteps((prev) =>
                prev.map((s) =>
                  s.id === step.id ? { ...s, status: 'skipped' as const } : s
                )
              );
              return { skipped: true, reason: 'Condition not met' };
            }

            // Generate decision
            const decisionResult = await generateText({
              model: getAIModel(options.model),
              prompt: `${step.description}\n\nContext: ${JSON.stringify(stepContext.previousResults.slice(-3))}`,
              abortSignal: stepContext.abortSignal,
            });
            result = decisionResult.text;
            break;
          }

          case 'parallel': {
            // Execute child steps in parallel
            if (!step.children || step.children.length === 0) {
              throw new Error('Parallel step must have children');
            }

            const parallelPromises = step.children.map((childStep) =>
              executeStep(childStep, stepContext)
            );

            const parallelResults = await Promise.allSettled(parallelPromises);
            result = parallelResults.map((r, i) => ({
              step: step.children![i].id,
              success: r.status === 'fulfilled',
              result: r.status === 'fulfilled' ? r.value : undefined,
              error: r.status === 'rejected' ? r.reason : undefined,
            }));
            break;
          }

          default:
            throw new Error(`Unknown step type: ${step.type}`);
        }

        const duration = Date.now() - startTime;

        // Update step with result
        setSteps((prev) =>
          prev.map((s) =>
            s.id === step.id
              ? { ...s, status: 'completed' as const, result, duration }
              : s
          )
        );

        options.onStepComplete?.(step, result);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        // Update step with error
        setSteps((prev) =>
          prev.map((s) =>
            s.id === step.id
              ? {
                  ...s,
                  status: 'failed' as const,
                  error: errorMessage,
                  duration,
                }
              : s
          )
        );

        options.onStepError?.(step, error as Error);
        throw error;
      }
    },
    [options]
  );

  /**
   * Execute the entire workflow
   */
  const executeWorkflow = useCallback(
    async (
      workflowSteps: WorkflowStep[],
      initialContext?: Partial<WorkflowContext>
    ) => {
      // Reset state
      setSteps(workflowSteps);
      setCurrentStep(0);
      setIsRunning(true);
      startTimeRef.current = Date.now();

      // Create abort controller
      abortControllerRef.current = new AbortController();

      // Initialize context
      const workflowContext: WorkflowContext = {
        previousResults: [],
        variables: initialContext?.variables || {},
        currentStepIndex: 0,
        abortSignal: abortControllerRef.current.signal,
      };

      setContext(workflowContext);

      try {
        const results: any[] = [];
        const maxSteps = options.maxSteps || workflowSteps.length;

        for (let i = 0; i < Math.min(workflowSteps.length, maxSteps); i++) {
          // Check abort signal
          if (abortControllerRef.current.signal.aborted) {
            throw new Error('Workflow aborted');
          }

          // Check stop condition
          if (options.stopCondition?.(workflowContext)) {
            toast.info('Workflow stopped by condition');
            break;
          }

          // Update current step
          setCurrentStep(i);
          workflowContext.currentStepIndex = i;

          const step = workflowSteps[i];

          try {
            const result = await executeStep(step, workflowContext);
            results.push(result);
            workflowContext.previousResults.push(result);
          } catch (error) {
            toast.error(
              `Step ${i + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );

            // Decide whether to continue or stop on error
            if (step.type === 'tool' || step.type === 'decision') {
              // Critical steps - stop workflow
              throw error;
            }
            // Non-critical steps - continue
            results.push({
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        toast.success('Workflow completed successfully');
        return {
          success: true,
          results,
          duration: Date.now() - startTimeRef.current,
          stepsCompleted: results.length,
        };
      } catch (error) {
        toast.error(
          `Workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTimeRef.current,
          stepsCompleted: context.previousResults.length,
        };
      } finally {
        setIsRunning(false);
        setCurrentStep(-1);
      }
    },
    [executeStep, options]
  );

  /**
   * Abort the running workflow
   */
  const abort = useCallback(() => {
    if (abortControllerRef.current && isRunning) {
      abortControllerRef.current.abort();
      toast.info('Workflow aborted');
    }
  }, [isRunning]);

  /**
   * Reset workflow state
   */
  const reset = useCallback(() => {
    setSteps([]);
    setCurrentStep(-1);
    setIsRunning(false);
    setContext({
      previousResults: [],
      variables: {},
      currentStepIndex: -1,
    });
    abortControllerRef.current = null;
  }, []);

  /**
   * Update context variables
   */
  const updateVariable = useCallback((key: string, value: any) => {
    setContext((prev) => ({
      ...prev,
      variables: {
        ...prev.variables,
        [key]: value,
      },
    }));
  }, []);

  /**
   * Create a workflow from a simple prompt
   */
  const createWorkflowFromPrompt = useCallback(
    async (prompt: string) => {
      try {
        const result = await generateText({
          model: getAIModel(options.model),
          prompt: `Create a workflow for: ${prompt}\n\nReturn a JSON array of workflow steps with the following structure:
        {
          "id": "unique_id",
          "type": "text" | "tool" | "decision",
          "description": "Step description",
          "toolName": "optional - for tool steps",
          "toolParams": {} // optional - for tool steps
        }`,
          // maxTokens: 1000, // Remove unsupported option
        });

        const steps = JSON.parse(result.text) as WorkflowStep[];
        return steps.map((step) => ({
          ...step,
          status: 'pending' as const,
        }));
      } catch (error) {
        toast.error('Failed to create workflow from prompt');
        throw error;
      }
    },
    [options.model]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // State
    steps,
    currentStep,
    isRunning,
    context,

    // Actions
    executeWorkflow,
    abort,
    reset,
    updateVariable,
    createWorkflowFromPrompt,

    // Computed
    progress:
      steps.length > 0
        ? (steps.filter((s) => s.status === 'completed').length /
            steps.length) *
          100
        : 0,
    completedSteps: steps.filter((s) => s.status === 'completed').length,
    failedSteps: steps.filter((s) => s.status === 'failed').length,
    currentStepData: currentStep >= 0 ? steps[currentStep] : null,
    isComplete:
      steps.length > 0 &&
      steps.every(
        (s) =>
          s.status === 'completed' ||
          s.status === 'failed' ||
          s.status === 'skipped'
      ),
    totalDuration: isRunning
      ? Date.now() - startTimeRef.current
      : steps.reduce((sum, step) => sum + (step.duration || 0), 0),
  };
}

/**
 * Pre-built workflow templates
 */
export const workflowTemplates = {
  codeGeneration: (description: string): WorkflowStep[] => [
    {
      id: 'understand',
      type: 'text',
      description: `Understand the requirements: ${description}`,
      status: 'pending',
    },
    {
      id: 'design',
      type: 'text',
      description: 'Create a technical design and identify components needed',
      status: 'pending',
    },
    {
      id: 'generate',
      type: 'tool',
      description: 'Generate the code',
      toolName: 'createCodeArtifact',
      status: 'pending',
    },
    {
      id: 'validate',
      type: 'tool',
      description: 'Validate the generated code',
      toolName: 'createCodeArtifact',
      toolParams: { validation: true },
      status: 'pending',
    },
    {
      id: 'document',
      type: 'tool',
      description: 'Generate documentation',
      toolName: 'createDocumentArtifact',
      status: 'pending',
    },
  ],

  dataAnalysis: (dataDescription: string): WorkflowStep[] => [
    {
      id: 'understand_data',
      type: 'text',
      description: `Analyze the data structure and requirements: ${dataDescription}`,
      status: 'pending',
    },
    {
      id: 'prepare_data',
      type: 'parallel',
      description: 'Prepare data and generate visualizations',
      status: 'pending',
      children: [
        {
          id: 'clean_data',
          type: 'text',
          description: 'Clean and transform the data',
          status: 'pending',
        },
        {
          id: 'create_chart',
          type: 'tool',
          description: 'Create visualization',
          toolName: 'createChartArtifact',
          status: 'pending',
        },
      ],
    },
    {
      id: 'insights',
      type: 'text',
      description: 'Generate insights and recommendations',
      status: 'pending',
    },
    {
      id: 'report',
      type: 'tool',
      description: 'Create final report',
      toolName: 'createDocumentArtifact',
      status: 'pending',
    },
  ],

  contentCreation: (topic: string): WorkflowStep[] => [
    {
      id: 'research',
      type: 'text',
      description: `Research the topic: ${topic}`,
      status: 'pending',
    },
    {
      id: 'outline',
      type: 'text',
      description: 'Create content outline and structure',
      status: 'pending',
    },
    {
      id: 'draft',
      type: 'tool',
      description: 'Write the first draft',
      toolName: 'createDocumentArtifact',
      status: 'pending',
    },
    {
      id: 'enhance',
      type: 'decision',
      description: 'Decide if content needs enhancement',
      condition: (ctx) => ctx.previousResults.length > 2,
      status: 'pending',
    },
    {
      id: 'finalize',
      type: 'tool',
      description: 'Create final version with formatting',
      toolName: 'createDocumentArtifact',
      toolParams: { autoFormat: true, generateToc: true },
      status: 'pending',
    },
  ],
};
