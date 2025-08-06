import {
  createAI,
  createStreamableUI,
  createStreamableValue,
  getAIState,
  getMutableAIState,
  streamUI,
} from '@ai-sdk/rsc';
import type { CoreMessage, Tool } from 'ai';
import type { ReactNode } from 'react';
import { z } from 'zod';
import {
  type PrepareStepFunction,
  usePrepareStep,
} from '../../hooks/use-prepare-step';
import { getAIModel } from '../core/providers';
import { enhancedArtifactTools } from '../tools/enhanced-tools';

// AI State types for server-side state management
export interface AIState {
  messages: CoreMessage[];
  artifacts: Array<{
    id: string;
    type: string;
    content: any;
    createdAt: number;
  }>;
  workflow: Array<{
    step: string;
    status: 'pending' | 'completed' | 'failed';
    result?: any;
  }>;
  context: {
    userId?: string;
    sessionId: string;
    preferences?: Record<string, any>;
  };
}

// UI State types for client-side
export interface UIState {
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: ReactNode;
    timestamp: number;
  }>;
}

// Component interfaces (these would be actual React components)
interface ChatMessageProps {
  content: string;
  streaming?: boolean;
  role?: 'user' | 'assistant';
}

interface ArtifactViewerProps {
  type: string;
  content: any;
  editable?: boolean;
  onEdit?: (newContent: any) => void;
}

interface WorkflowStepProps {
  step: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
}

interface StreamingIndicatorProps {
  message: string;
  progress?: number;
}

// Placeholder components
const ChatMessage = ({
  content,
  streaming,
  role,
}: ChatMessageProps): ReactNode => {
  return null!; // Actual implementation would render the message
};

const ArtifactViewer = ({
  type,
  content,
  editable,
  onEdit,
}: ArtifactViewerProps): ReactNode => {
  return null!; // Actual implementation would render the artifact
};

const WorkflowStep = ({
  step,
  status,
  result,
}: WorkflowStepProps): ReactNode => {
  return null!; // Actual implementation would render the workflow step
};

const StreamingIndicator = ({
  message,
  progress,
}: StreamingIndicatorProps): ReactNode => {
  return null!; // Actual implementation would render the indicator
};

/**
 * Server Actions with streaming UI
 */
export async function streamingChat(
  message: string,
  options: {
    prepareStep?: PrepareStepFunction<any>;
    enableIntelligentStepping?: boolean;
  } = {}
) {
  'use server';

  const aiState = getMutableAIState();
  const streamableUI = createStreamableUI();

  // Add user message to state
  aiState.update((state: AIState) => ({
    ...state,
    messages: [...state.messages, { role: 'user', content: message }],
  }));

  // Initial streaming indicator
  streamableUI.update(<StreamingIndicator message="Thinking..." />);

  // Create intelligent prepareStep function if enabled
  const prepareStepFunction =
    options.prepareStep ??
    (options.enableIntelligentStepping
      ? ({ steps, stepNumber, model, messages }) => {
          // Analyze conversation complexity
          const isComplexTask = messages.some(
            (m) =>
              typeof m.content === 'string' &&
              (m.content.includes('code') ||
                m.content.includes('analyze') ||
                m.content.length > 200)
          );

          // Adjust based on step
          if (stepNumber === 0 && isComplexTask) {
            return {
              temperature: 0.3,
              maxTokens: 4096,
              system:
                'You are an expert assistant. Provide detailed, structured responses with examples when relevant.',
            };
          }

          if (stepNumber > 2) {
            return {
              temperature: 0.7,
              maxTokens: 2048,
              system:
                'Continue the conversation naturally, building on previous context.',
            };
          }

          return;
        }
      : undefined);

  try {
    const result = await streamUI({
      model: getAIModel(),
      messages: aiState.get().messages,
      text: ({ content, done }: { content: string; done: boolean }) => {
        if (done) {
          // Update AI state
          aiState.update((state: AIState) => ({
            ...state,
            messages: [...state.messages, { role: 'assistant', content }],
          }));

          // Final message
          const finalUI = <ChatMessage content={content} role="assistant" />;
          streamableUI.done(finalUI);
          return finalUI;
        }
        // Streaming message
        const streamingUI = (
          <ChatMessage content={content} role="assistant" streaming />
        );
        streamableUI.update(streamingUI);
        return streamingUI;
      },
      tools: {
        createArtifact: {
          description: 'Create an interactive artifact',
          inputSchema: z.object({
            type: z.enum(['code', 'document', 'chart', 'data']),
            title: z.string(),
            content: z.any(),
            language: z.string().optional(),
          }),
          async *generate({
            type,
            title,
            content,
            language,
          }: {
            type: string;
            title: string;
            content: any;
            language?: string;
          }) {
            // Show creation progress
            streamableUI.update(
              <div>
                <ChatMessage
                  content={`Creating ${type}: ${title}...`}
                  role="assistant"
                />
                <StreamingIndicator
                  message="Generating artifact..."
                  progress={50}
                />
              </div>
            );

            yield <StreamingIndicator message="Creating artifact..." />;

            // Create the artifact
            const artifactId = `artifact_${Date.now()}`;
            const artifact = {
              id: artifactId,
              type,
              content,
              createdAt: Date.now(),
              metadata: { title, language },
            };

            // Update AI state
            aiState.update((state: AIState) => ({
              ...state,
              artifacts: [...state.artifacts, artifact],
            }));

            yield <StreamingIndicator message="Finalizing artifact..." />;

            // Show the artifact
            streamableUI.done(
              <div>
                <ChatMessage
                  content={`Created ${type}: ${title}`}
                  role="assistant"
                />
                <ArtifactViewer
                  content={content}
                  editable
                  onEdit={(newContent) => {
                    // Handle artifact editing
                    aiState.update((state: AIState) => ({
                      ...state,
                      artifacts: state.artifacts.map(
                        (a: AIState['artifacts'][0]) =>
                          a.id === artifactId
                            ? { ...a, content: newContent }
                            : a
                      ),
                    }));
                  }}
                  type={type}
                />
              </div>
            );

            const finalResult = (
              <div>
                <ChatMessage
                  content={`Created ${type}: ${title}`}
                  role="assistant"
                />
                <ArtifactViewer
                  content={content}
                  editable
                  onEdit={(newContent) => {
                    aiState.update((state: AIState) => ({
                      ...state,
                      artifacts: state.artifacts.map(
                        (a: AIState['artifacts'][0]) =>
                          a.id === artifactId
                            ? { ...a, content: newContent }
                            : a
                      ),
                    }));
                  }}
                  type={type}
                />
              </div>
            );

            return finalResult;
          },
        },
        runWorkflow: {
          description: 'Execute a multi-step workflow',
          inputSchema: z.object({
            steps: z.array(
              z.object({
                name: z.string(),
                action: z.string(),
                params: z.any().optional(),
              })
            ),
          }),
          async *generate({
            steps,
          }: {
            steps: Array<{ name: string; action: string; params?: any }>;
          }) {
            const workflowUI = createStreamableUI();

            // Show workflow UI
            streamableUI.update(
              <div>
                <ChatMessage content="Executing workflow..." role="assistant" />
                {workflowUI.value}
              </div>
            );

            // Execute each step
            for (const [index, step] of steps.entries()) {
              // Update workflow state
              aiState.update((state: AIState) => ({
                ...state,
                workflow: [
                  ...state.workflow.slice(0, index),
                  { step: step.name, status: 'pending' },
                  ...state.workflow.slice(index + 1),
                ],
              }));

              // Show step UI
              workflowUI.update(
                <div>
                  {steps.map(
                    (
                      s: { name: string; action: string; params?: any },
                      i: number
                    ) => (
                      <WorkflowStep
                        key={i}
                        status={
                          i === index
                            ? 'running'
                            : i < index
                              ? 'completed'
                              : 'pending'
                        }
                        step={s.name}
                      />
                    )
                  )}
                </div>
              );

              yield (
                <StreamingIndicator message={`Executing step: ${step.name}`} />
              );

              // Simulate step execution
              await new Promise((resolve) => setTimeout(resolve, 1000));

              // Update step as completed
              aiState.update((state: AIState) => ({
                ...state,
                workflow: state.workflow.map(
                  (w: AIState['workflow'][0], i: number) =>
                    i === index
                      ? {
                          ...w,
                          status: 'completed',
                          result: `Step ${index + 1} completed`,
                        }
                      : w
                ),
              }));

              yield (
                <StreamingIndicator message={`Completed step: ${step.name}`} />
              );
            }

            // Final workflow UI
            workflowUI.done(
              <div>
                {steps.map(
                  (
                    s: { name: string; action: string; params?: any },
                    i: number
                  ) => (
                    <WorkflowStep
                      key={i}
                      result={aiState.get().workflow[i]?.result}
                      status="completed"
                      step={s.name}
                    />
                  )
                )}
              </div>
            );

            streamableUI.done(
              <div>
                <ChatMessage
                  content="Workflow completed successfully!"
                  role="assistant"
                />
                {workflowUI.value}
              </div>
            );

            const workflowResult = (
              <div>
                <ChatMessage
                  content="Workflow completed successfully!"
                  role="assistant"
                />
                {workflowUI.value}
              </div>
            );

            return workflowResult;
          },
        },
      },
    });

    return streamableUI.value;
  } catch (error) {
    streamableUI.done(
      <ChatMessage
        content={`Error: ${error instanceof Error ? error.message : 'Unknown error'}`}
        role="assistant"
      />
    );
    throw error;
  }
}

/**
 * Streaming workflow execution
 */
export async function streamingWorkflow(workflowName: string, steps: any[]) {
  'use server';

  const aiState = getMutableAIState();
  const progressStream = createStreamableValue<number>();
  const statusStream = createStreamableValue<string>();
  const resultsStream = createStreamableValue<any[]>();

  // Initialize workflow in state
  aiState.update((state: AIState) => ({
    ...state,
    workflow: steps.map(
      (step: { name: string; action: string; params?: any }) => ({
        step: step.name,
        status: 'pending' as const,
      })
    ),
  }));

  // Execute workflow
  const executeWorkflow = async () => {
    const results: any[] = [];

    for (const [index, step] of steps.entries()) {
      const progress = ((index + 1) / steps.length) * 100;

      progressStream.update(progress);
      statusStream.update(`Executing: ${step.name}`);

      // Update step status
      aiState.update((state: AIState) => ({
        ...state,
        workflow: state.workflow.map((w: AIState['workflow'][0], i: number) =>
          i === index ? { ...w, status: 'pending' } : w
        ),
      }));

      try {
        // Execute step (simulation)
        const result = await new Promise((resolve) =>
          setTimeout(() => resolve(`Result of ${step.name}`), 1000)
        );

        results.push({ step: step.name, result, success: true });
        resultsStream.update(results);

        // Update step as completed
        aiState.update((state: AIState) => ({
          ...state,
          workflow: state.workflow.map(
            (w: AIState['workflow'][0], i: number) =>
              i === index ? { ...w, status: 'completed', result } : w
          ),
        }));
      } catch (error) {
        results.push({
          step: step.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false,
        });

        aiState.update((state: AIState) => ({
          ...state,
          workflow: state.workflow.map(
            (w: AIState['workflow'][0], i: number) =>
              i === index ? { ...w, status: 'failed' } : w
          ),
        }));
      }
    }

    progressStream.done();
    statusStream.done();
    resultsStream.done();

    return results;
  };

  executeWorkflow();

  return {
    progress: progressStream.value,
    status: statusStream.value,
    results: resultsStream.value,
  };
}

/**
 * Generate artifact with streaming updates
 */
export async function generateArtifact(
  type: 'code' | 'document' | 'chart' | 'data',
  requirements: string
) {
  'use server';

  const aiState = getMutableAIState();
  const artifactStream = createStreamableUI();
  const metadataStream = createStreamableValue<any>();

  // Show initial state
  artifactStream.update(
    <StreamingIndicator message={`Generating ${type}...`} progress={10} />
  );

  try {
    // Generate content based on type
    const result = await streamUI({
      model: getAIModel(),
      prompt: `Generate a ${type} artifact based on: ${requirements}`,
      text: ({ content, done }: { content: string; done: boolean }) => {
        if (done) {
          return (
            <StreamingIndicator message={`Generated ${type}`} progress={100} />
          );
        }
        const progressUI = (
          <StreamingIndicator message={`Generating ${type}...`} progress={50} />
        );
        artifactStream.update(progressUI);
        return progressUI;
      },
      tools: {
        createSpecificArtifact: {
          description: `Create ${type} artifact`,
          inputSchema: z.object({
            title: z.string(),
            content: z.any(),
            metadata: z.any().optional(),
          }),
          async *generate({
            title,
            content,
            metadata,
          }: {
            title: string;
            content: any;
            metadata?: any;
          }) {
            yield <StreamingIndicator message="Generating artifact..." />;

            const artifactId = `artifact_${Date.now()}`;
            const artifact = {
              id: artifactId,
              type,
              content,
              createdAt: Date.now(),
              metadata: { ...metadata, title },
            };

            // Update AI state
            aiState.update((state: AIState) => ({
              ...state,
              artifacts: [...state.artifacts, artifact],
            }));

            // Update metadata stream
            metadataStream.update(artifact.metadata);

            // Show final artifact
            artifactStream.done(
              <ArtifactViewer content={content} editable type={type} />
            );

            metadataStream.done();

            const artifactResult = (
              <ArtifactViewer content={content} editable type={type} />
            );

            return artifactResult;
          },
        },
      },
    });

    return {
      ui: artifactStream.value,
      metadata: metadataStream.value,
    };
  } catch (error) {
    artifactStream.done(
      <div>
        Error generating artifact:{' '}
        {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
    metadataStream.error(error as Error);
    throw error;
  }
}

/**
 * AI Provider for client-server state synchronization
 */
export const AIProvider = createAI<AIState, UIState>({
  actions: {
    streamingChat,
    streamingWorkflow,
    generateArtifact,
  },
  initialAIState: {
    messages: [],
    artifacts: [],
    workflow: [],
    context: {
      sessionId: crypto.randomUUID(),
    },
  },
  initialUIState: {
    messages: [],
  },
  onSetAIState: async ({ state, done }: { state: AIState; done: boolean }) => {
    'use server';

    // Save state to database when done
    if (done) {
      // await saveAIState(state)
      console.log('AI State saved:', state);
    }
  },
  onGetUIState: async () => {
    'use server';

    const aiState = getAIState();

    // Convert AI state to UI state
    const uiState: UIState = {
      messages: aiState.messages.map((message: CoreMessage, index: number) => ({
        id: `msg_${index}`,
        role: message.role as 'user' | 'assistant',
        content: (
          <ChatMessage
            content={message.content as string}
            role={message.role as any}
          />
        ),
        timestamp: Date.now(),
      })),
    };

    return uiState;
  },
});

// Helper functions for state management
export function useAIState() {
  return getAIState();
}

export function useMutableAIState() {
  return getMutableAIState();
}

// Types are already exported in their interface declarations above
