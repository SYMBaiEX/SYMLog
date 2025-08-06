import { openai } from '@ai-sdk/openai';
import {
  extractReasoningMiddleware,
  generateText,
  type LanguageModel,
  type StreamTextResult,
  streamText,
  wrapLanguageModel,
} from 'ai';
import { loggingMiddleware } from '../core/middleware';
import { getAIModel } from '../core/providers';
import { createLogger } from '../../logger/unified-logger';

// Create AI reasoning logger
const logger = createLogger({ service: 'ai-reasoning' });

export interface ReasoningStep {
  text: string;
  index: number;
  timestamp: Date;
}

export interface ProblemAnalysis {
  understanding: string;
  components: string[];
  approaches: string[];
  evaluation: string;
  recommendation: string;
  challenges: string[];
}

export interface ReasoningResult {
  reasoning: Array<{ text: string }>;
  reasoningText: string;
  finalAnswer: string;
  steps: string[];
  confidence?: number;
  metadata?: {
    model: string;
    duration: number;
    tokenCount?: number;
  };
}

export interface ReasoningOptions {
  model?: string;
  temperature?: number;
  tagName?: string;
  separator?: string;
  startWithReasoning?: boolean;
  includeConfidence?: boolean;
}

/**
 * Reasoning engine for chain-of-thought prompting and analysis
 */
export class ReasoningEngine {
  private reasoningModel: LanguageModel;
  private options: ReasoningOptions;

  constructor(options: ReasoningOptions = {}) {
    this.options = {
      tagName: 'think',
      separator: '\n---\n',
      startWithReasoning: true,
      includeConfidence: true,
      ...options,
    };

    // Create reasoning model with middleware
    this.reasoningModel = wrapLanguageModel({
      model: getAIModel(options.model || 'gpt-4'),
      middleware: [
        loggingMiddleware,
        extractReasoningMiddleware({
          tagName: this.options.tagName!,
          separator: this.options.separator,
          startWithReasoning: this.options.startWithReasoning,
        }),
      ],
    });
  }

  /**
   * Generate text with reasoning extraction
   */
  async generateWithReasoning(
    prompt: string,
    systemPrompt?: string
  ): Promise<ReasoningResult> {
    const start = Date.now();

    // Enhance prompt for reasoning
    const enhancedPrompt = this.options.startWithReasoning
      ? `${prompt}\n\nThink step by step about this problem before providing your answer.`
      : prompt;

    const enhancedSystem =
      systemPrompt ||
      `You are a helpful assistant that thinks through problems step by step.
When you need to reason about something, wrap your thinking process in <${this.options.tagName}> tags.
After reasoning, provide a clear and concise answer.`;

    try {
      const result = await generateText({
        model: this.reasoningModel,
        system: enhancedSystem,
        prompt: enhancedPrompt,
        temperature: this.options.temperature,
      });

      // Extract confidence if requested
      let confidence: number | undefined;
      if (this.options.includeConfidence && result.text) {
        confidence = this.extractConfidence(result.text);
      }

      return {
        reasoning: result.reasoning || [],
        reasoningText: result.reasoningText || '',
        finalAnswer: result.text,
        steps: result.reasoning?.map((r) => r.text) || [],
        confidence,
        metadata: {
          model: this.options.model || 'gpt-4',
          duration: Date.now() - start,
          tokenCount: result.usage?.totalTokens,
        },
      };
    } catch (error) {
      logger.error('Reasoning generation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to generate reasoning: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Stream text with reasoning extraction
   */
  async streamReasoning(
    prompt: string,
    systemPrompt?: string,
    onReasoningStep?: (step: ReasoningStep) => void
  ) {
    const enhancedPrompt = this.options.startWithReasoning
      ? `${prompt}\n\nThink step by step about this problem before providing your answer.`
      : prompt;

    const enhancedSystem =
      systemPrompt ||
      `You are a helpful assistant that thinks through problems step by step.
When you need to reason about something, wrap your thinking process in <${this.options.tagName}> tags.
After reasoning, provide a clear and concise answer.`;

    let stepIndex = 0;

    return streamText({
      model: this.reasoningModel,
      system: enhancedSystem,
      prompt: enhancedPrompt,
      temperature: this.options.temperature,
      onStepFinish: async ({ reasoning }) => {
        // Process reasoning steps in real-time
        if (reasoning && reasoning.length > stepIndex) {
          for (let i = stepIndex; i < reasoning.length; i++) {
            const step: ReasoningStep = {
              text: reasoning[i].text,
              index: i,
              timestamp: new Date(),
            };

            logger.info('Reasoning Step', {
              stepNumber: i + 1,
              text: step.text,
            });

            if (onReasoningStep) {
              onReasoningStep(step);
            }
          }
          stepIndex = reasoning.length;
        }
      },
    });
  }

  /**
   * Analyze a problem with structured reasoning
   */
  async analyzeProblem(
    problem: string,
    context?: string
  ): Promise<ReasoningResult & { analysis: ProblemAnalysis }> {
    const analysisPrompt = `Problem: ${problem}
${context ? `\nContext: ${context}` : ''}

Please analyze this problem using the following structure:
1. Problem understanding and clarification
2. Key components and constraints
3. Possible approaches
4. Evaluation of each approach
5. Recommended solution
6. Potential challenges and mitigations`;

    const result = await this.generateWithReasoning(analysisPrompt);

    // Parse structured analysis from the final answer
    const analysis = this.parseStructuredAnalysis(result.finalAnswer);

    return {
      ...result,
      analysis,
    };
  }

  /**
   * Debug code with reasoning
   */
  async debugCode(
    code: string,
    error?: string,
    language = 'typescript'
  ): Promise<ReasoningResult & { fixes: string[] }> {
    const debugPrompt = `Debug the following ${language} code:

\`\`\`${language}
${code}
\`\`\`

${error ? `Error message: ${error}` : 'Identify any issues in this code.'}

Think through:
1. What the code is trying to do
2. What might be causing the issue
3. Step-by-step debugging process
4. Proposed fixes`;

    const result = await this.generateWithReasoning(debugPrompt);

    // Extract code fixes from the answer
    const fixes = this.extractCodeBlocks(result.finalAnswer);

    return {
      ...result,
      fixes,
    };
  }

  /**
   * Make a decision with reasoning
   */
  async makeDecision(
    options: string[],
    criteria: string[],
    context?: string
  ): Promise<
    ReasoningResult & { decision: string; scores: Record<string, number> }
  > {
    const decisionPrompt = `Make a decision between these options:
${options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}

Evaluation criteria:
${criteria.map((crit, i) => `- ${crit}`).join('\n')}

${context ? `Additional context: ${context}` : ''}

Think through each option against each criterion, then make a recommendation.`;

    const result = await this.generateWithReasoning(decisionPrompt);

    // Extract decision and scores
    const decision = this.extractDecision(result.finalAnswer, options);
    const scores = this.extractScores(result.finalAnswer, options);

    return {
      ...result,
      decision,
      scores,
    };
  }

  /**
   * Extract confidence level from text
   */
  private extractConfidence(text: string): number | undefined {
    // Look for confidence indicators
    const confidencePatterns = [
      /confidence:?\s*(\d+)%/i,
      /(\d+)%\s*confident/i,
      /certainty:?\s*(\d+)%/i,
      /confidence level:?\s*(\d+)/i,
    ];

    for (const pattern of confidencePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return Number.parseInt(match[1]) / 100;
      }
    }

    // Look for qualitative indicators
    if (/very confident|high confidence|certain/i.test(text)) return 0.9;
    if (/confident|likely|probable/i.test(text)) return 0.7;
    if (/somewhat confident|possibly|perhaps/i.test(text)) return 0.5;
    if (/uncertain|unsure|low confidence/i.test(text)) return 0.3;

    return;
  }

  /**
   * Parse structured analysis from text
   */
  private parseStructuredAnalysis(text: string): ProblemAnalysis {
    const sections = {
      understanding: '',
      components: [],
      approaches: [],
      evaluation: '',
      recommendation: '',
      challenges: [],
    };

    // Simple parsing based on numbered sections
    const lines = text.split('\n');
    let currentSection = '';

    for (const line of lines) {
      if (line.match(/^1\./)) currentSection = 'understanding';
      else if (line.match(/^2\./)) currentSection = 'components';
      else if (line.match(/^3\./)) currentSection = 'approaches';
      else if (line.match(/^4\./)) currentSection = 'evaluation';
      else if (line.match(/^5\./)) currentSection = 'recommendation';
      else if (line.match(/^6\./)) currentSection = 'challenges';

      if (currentSection && !line.match(/^\d\./)) {
        const trimmed = line.trim();
        if (trimmed) {
          if (
            Array.isArray(sections[currentSection as keyof typeof sections])
          ) {
            (
              sections[currentSection as keyof typeof sections] as string[]
            ).push(trimmed);
          } else {
            (sections[currentSection as keyof typeof sections] as string) =
              (sections[currentSection as keyof typeof sections] as string) +
              ' ' +
              trimmed;
          }
        }
      }
    }

    return sections;
  }

  /**
   * Extract code blocks from text
   */
  private extractCodeBlocks(text: string): string[] {
    const codeBlocks: string[] = [];
    const regex = /```[\w]*\n([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      codeBlocks.push(match[1].trim());
    }

    return codeBlocks;
  }

  /**
   * Extract decision from text
   */
  private extractDecision(text: string, options: string[]): string {
    // Look for explicit recommendation
    const recommendPattern = /recommend|suggest|choose|select/i;
    const lines = text.split('\n');

    for (const line of lines) {
      if (recommendPattern.test(line)) {
        for (const option of options) {
          if (line.toLowerCase().includes(option.toLowerCase())) {
            return option;
          }
        }
      }
    }

    // Default to first mentioned option
    return options[0];
  }

  /**
   * Extract scores from text
   */
  private extractScores(
    text: string,
    options: string[]
  ): Record<string, number> {
    const scores: Record<string, number> = {};

    for (const option of options) {
      scores[option] = 0.5; // Default score

      // Look for numeric scores
      const scorePattern = new RegExp(
        `${option}.*?(\\d+)(?:/10|%|\\s*points)`,
        'i'
      );
      const match = text.match(scorePattern);
      if (match && match[1]) {
        const score = Number.parseInt(match[1]);
        scores[option] = score > 10 ? score / 100 : score / 10;
      }
    }

    return scores;
  }
}

/**
 * Create a reasoning prompt template
 */
export function createReasoningPrompt(
  task: string,
  requirements: string[],
  constraints?: string[]
): string {
  return `Task: ${task}

Requirements:
${requirements.map((req, i) => `${i + 1}. ${req}`).join('\n')}

${constraints ? `Constraints:\n${constraints.map((con, i) => `- ${con}`).join('\n')}` : ''}

Please think through this step-by-step:
1. Understand the requirements
2. Consider different approaches
3. Evaluate trade-offs
4. Provide a solution
5. Explain your reasoning`;
}

/**
 * Reasoning templates for common tasks
 */
export const reasoningTemplates = {
  codeReview: (code: string, language: string) => `
Review this ${language} code for:
1. Correctness and bugs
2. Performance issues
3. Security vulnerabilities
4. Code quality and best practices
5. Suggestions for improvement

Code:
\`\`\`${language}
${code}
\`\`\`

Think through each aspect systematically.`,

  systemDesign: (requirements: string) => `
Design a system with these requirements:
${requirements}

Consider:
1. Architecture and components
2. Data flow and storage
3. Scalability and performance
4. Security and reliability
5. Trade-offs and alternatives

Think through the design decisions step by step.`,

  optimization: (code: string, metric: string) => `
Optimize this code for ${metric}:

\`\`\`
${code}
\`\`\`

Analyze:
1. Current performance characteristics
2. Bottlenecks and inefficiencies
3. Optimization strategies
4. Trade-offs of each approach
5. Recommended optimizations

Think through the optimization process systematically.`,
};

// Export singleton instance with default configuration
export const reasoningEngine = new ReasoningEngine();
