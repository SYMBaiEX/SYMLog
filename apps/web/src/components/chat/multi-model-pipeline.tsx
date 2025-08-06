'use client';

import {
  AlertCircle,
  ArrowRight,
  Brain,
  CheckCircle,
  Clock,
  Code,
  Eye,
  GitBranch,
  Pause,
  Play,
  Search,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';
import {
  type ModelConfig,
  modelOrchestrator,
} from '@/lib/ai/intelligence';
import { cn } from '@/lib/utils';

interface PipelineStep {
  model: string;
  role: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  input?: string;
  output?: string;
  duration?: number;
  error?: string;
}

interface MultiModelPipelineProps {
  taskType: 'research' | 'code-review' | 'content-creation';
  input: string;
  onComplete?: (result: any) => void;
  onCancel?: () => void;
  className?: string;
}

export function MultiModelPipeline({
  taskType,
  input,
  onComplete,
  onCancel,
  className,
}: MultiModelPipelineProps) {
  const [pipeline, setPipeline] = useState<PipelineStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    initializePipeline();
  }, [taskType, input]);

  const initializePipeline = async () => {
    const pipelineConfig = await modelOrchestrator.executeMultiModelPipeline({
      type: taskType,
      input,
      context: {},
    });

    const steps: PipelineStep[] = pipelineConfig.pipeline.map(
      (modelConfig, index) => ({
        model: modelConfig.id,
        role: getRoleForModel(modelConfig.id, taskType, index),
        status: 'pending',
      })
    );

    setPipeline(steps);
    setCurrentStep(0);
    setResults([]);
  };

  const getRoleForModel = (
    modelId: string,
    taskType: string,
    stepIndex: number
  ): string => {
    switch (taskType) {
      case 'research':
        if (stepIndex === 0) return 'Information Gathering';
        if (stepIndex === 1) return 'Deep Analysis';
        if (stepIndex === 2) return 'Synthesis & Summary';
        return 'Processing';

      case 'code-review':
        if (stepIndex === 0) return 'Technical Analysis';
        if (stepIndex === 1) return 'Logic Review';
        return 'Review';

      case 'content-creation':
        return 'Content Generation';

      default:
        return 'Processing';
    }
  };

  const getModelIcon = (model: string) => {
    if (model.includes('o3') || model.includes('o4')) return Brain;
    if (model.includes('coding')) return Code;
    if (model.includes('embedding')) return Search;
    if (model.includes('vision') || model.includes('4o')) return Eye;
    return Sparkles;
  };

  const getStatusIcon = (status: PipelineStep['status']) => {
    switch (status) {
      case 'pending':
        return Clock;
      case 'running':
        return Play;
      case 'completed':
        return CheckCircle;
      case 'error':
        return AlertCircle;
      default:
        return Clock;
    }
  };

  const getStatusColor = (status: PipelineStep['status']) => {
    switch (status) {
      case 'pending':
        return 'text-gray-400';
      case 'running':
        return 'text-blue-400';
      case 'completed':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const executeStep = async (stepIndex: number) => {
    const step = pipeline[stepIndex];
    if (!step) return;

    // Update step status to running
    setPipeline((prev) =>
      prev.map((s, i) => (i === stepIndex ? { ...s, status: 'running' } : s))
    );

    const startTime = Date.now();

    try {
      // Simulate API call to the selected model
      // In a real implementation, this would call the actual AI model
      const stepInput =
        stepIndex === 0 ? input : results[stepIndex - 1]?.output || input;

      // Mock processing time based on model complexity
      const processingTime =
        step.model.includes('o3') || step.model.includes('o4')
          ? 3000
          : step.model.includes('nano')
            ? 1000
            : 2000;

      await new Promise((resolve) => setTimeout(resolve, processingTime));

      const mockOutput = generateMockOutput(step.model, step.role, stepInput);
      const duration = Date.now() - startTime;

      // Update step with results
      setPipeline((prev) =>
        prev.map((s, i) =>
          i === stepIndex
            ? {
                ...s,
                status: 'completed',
                output: mockOutput,
                duration,
                input: stepInput,
              }
            : s
        )
      );

      // Store result
      const newResult = {
        stepIndex,
        model: step.model,
        output: mockOutput,
        duration,
      };
      setResults((prev) => [...prev, newResult]);

      return newResult;
    } catch (error: any) {
      // Update step with error
      setPipeline((prev) =>
        prev.map((s, i) =>
          i === stepIndex
            ? {
                ...s,
                status: 'error',
                error: error.message,
                duration: Date.now() - startTime,
              }
            : s
        )
      );
      throw error;
    }
  };

  const runPipeline = async () => {
    setIsRunning(true);
    setIsPaused(false);

    try {
      for (let i = currentStep; i < pipeline.length; i++) {
        if (isPaused) break;

        setCurrentStep(i);
        await executeStep(i);

        // Small delay between steps for UX
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (!isPaused) {
        // Pipeline completed successfully
        const finalResult = {
          type: taskType,
          steps: pipeline,
          results,
          totalDuration: pipeline.reduce(
            (sum, step) => sum + (step.duration || 0),
            0
          ),
        };
        onComplete?.(finalResult);
      }
    } catch (error) {
      console.error('Pipeline execution failed:', error);
    }

    setIsRunning(false);
  };

  const pausePipeline = () => {
    setIsPaused(true);
    setIsRunning(false);
  };

  const resumePipeline = () => {
    if (currentStep < pipeline.length) {
      runPipeline();
    }
  };

  const generateMockOutput = (
    model: string,
    role: string,
    input: string
  ): string => {
    // Generate contextual mock outputs based on model and role
    const outputs: Record<string, string> = {
      'Information Gathering': `Based on the query "${input.slice(0, 50)}...", I've identified key research areas and gathered relevant information from multiple sources.`,
      'Deep Analysis':
        'Performing comprehensive analysis of the gathered information, identifying patterns, relationships, and key insights.',
      'Synthesis & Summary':
        'Synthesizing all findings into a coherent summary with actionable recommendations and conclusions.',
      'Technical Analysis':
        'Analyzed code structure, identified potential issues, and evaluated adherence to best practices.',
      'Logic Review':
        'Reviewed algorithmic logic, identified edge cases, and verified correctness of implementation.',
      'Content Generation':
        'Generated high-quality content based on the requirements and context provided.',
    };

    return (
      outputs[role] || `Processed using ${model}: ${input.slice(0, 100)}...`
    );
  };

  const totalSteps = pipeline.length;
  const completedSteps = pipeline.filter(
    (s) => s.status === 'completed'
  ).length;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <GlassCard className={cn('p-6', className)}>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitBranch className="h-6 w-6 text-periwinkle" />
          <div>
            <h3 className="font-semibold text-lg">Multi-Model Pipeline</h3>
            <p className="text-muted-foreground text-sm">
              {taskType
                .replace('-', ' ')
                .replace(/\b\w/g, (l) => l.toUpperCase())}{' '}
              • {totalSteps} steps
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isRunning && completedSteps === 0 && (
            <GlassButton className="gap-2" onClick={runPipeline}>
              <Play className="h-4 w-4" />
              Start Pipeline
            </GlassButton>
          )}

          {isRunning && (
            <GlassButton
              className="gap-2"
              onClick={pausePipeline}
              variant="outline"
            >
              <Pause className="h-4 w-4" />
              Pause
            </GlassButton>
          )}

          {isPaused && (
            <GlassButton className="gap-2" onClick={resumePipeline}>
              <Play className="h-4 w-4" />
              Resume
            </GlassButton>
          )}

          {onCancel && (
            <GlassButton onClick={onCancel} variant="ghost">
              Cancel
            </GlassButton>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="mb-2 flex justify-between text-sm">
          <span>Progress</span>
          <span>
            {completedSteps}/{totalSteps} steps completed
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/10">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-periwinkle/60 to-periwinkle transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Pipeline steps */}
      <div className="space-y-4">
        {pipeline.map((step, index) => {
          const Icon = getModelIcon(step.model);
          const StatusIcon = getStatusIcon(step.status);
          const isActive = index === currentStep && isRunning;

          return (
            <div className="relative" key={index}>
              {index < pipeline.length - 1 && (
                <div className="absolute top-12 left-6 h-8 w-0.5 bg-white/10" />
              )}

              <div
                className={cn(
                  'flex items-start gap-4 rounded-lg p-4 transition-all',
                  isActive && 'border border-periwinkle/20 bg-periwinkle/10',
                  step.status === 'completed' &&
                    'border border-green-500/20 bg-green-500/5',
                  step.status === 'error' &&
                    'border border-red-500/20 bg-red-500/5'
                )}
              >
                <div
                  className={cn(
                    'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full',
                    step.status === 'pending' && 'bg-white/5',
                    step.status === 'running' && 'animate-pulse bg-blue-500/20',
                    step.status === 'completed' && 'bg-green-500/20',
                    step.status === 'error' && 'bg-red-500/20'
                  )}
                >
                  <Icon className="h-5 w-5 text-periwinkle" />
                </div>

                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <h4 className="font-medium">{step.role}</h4>
                    <Badge className="text-xs" variant="outline">
                      {step.model
                        .replace(/^gpt-/, 'GPT-')
                        .replace(/^o(\d)/, 'o$1')}
                    </Badge>
                    <StatusIcon
                      className={cn('h-4 w-4', getStatusColor(step.status))}
                    />
                    {step.duration && (
                      <span className="text-muted-foreground text-xs">
                        {step.duration}ms
                      </span>
                    )}
                  </div>

                  {step.output && (
                    <div className="rounded-lg bg-white/5 p-3 text-muted-foreground text-sm">
                      {step.output}
                    </div>
                  )}

                  {step.error && (
                    <div className="rounded-lg bg-red-500/10 p-3 text-red-400 text-sm">
                      Error: {step.error}
                    </div>
                  )}
                </div>

                {index < pipeline.length - 1 && step.status === 'completed' && (
                  <ArrowRight className="mt-4 h-4 w-4 flex-shrink-0 text-green-400" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Results summary */}
      {completedSteps === totalSteps && totalSteps > 0 && (
        <div className="mt-6 rounded-lg border border-green-500/20 bg-green-500/10 p-4">
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <h4 className="font-medium text-green-400">Pipeline Completed</h4>
          </div>
          <div className="text-muted-foreground text-sm">
            Successfully processed {totalSteps} steps in{' '}
            {pipeline.reduce((sum, step) => sum + (step.duration || 0), 0)}ms
            total duration.
          </div>
        </div>
      )}
    </GlassCard>
  );
}
