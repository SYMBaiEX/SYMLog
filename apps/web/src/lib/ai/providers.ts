import type { AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import {
  createProviderRegistry,
  customProvider,
  defaultSettingsMiddleware,
  type LanguageModelRequestMetadata,
  type LanguageModelResponseMetadata,
  type ProviderMetadata,
  wrapLanguageModel,
} from 'ai';
import { config } from '../config';
import {
  composeMiddleware,
  createCachingMiddleware,
  loggingMiddleware,
  performanceMiddleware,
  securityMiddleware,
} from './middleware';

// Create custom providers with model aliases and pre-configured settings
const customOpenAI = customProvider({
  languageModels: {
    // Fast model for quick responses
    fast: wrapLanguageModel({
      model: openai('gpt-4o-mini'),
      middleware: composeMiddleware(
        loggingMiddleware,
        performanceMiddleware,
        defaultSettingsMiddleware({
          settings: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        })
      ),
    }),

    // Coding specialist with low temperature
    code: wrapLanguageModel({
      model: openai('gpt-4.1-2025-04-14'),
      middleware: composeMiddleware(
        loggingMiddleware,
        performanceMiddleware,
        securityMiddleware,
        defaultSettingsMiddleware({
          settings: {
            temperature: 0.1,
            maxOutputTokens: 8192,
            stopSequences: ['```end', '// END'],
          },
        })
      ),
    }),

    // High-quality model for complex tasks
    premium: wrapLanguageModel({
      model: openai('gpt-4.1-nano'),
      middleware: composeMiddleware(
        loggingMiddleware,
        performanceMiddleware,
        securityMiddleware,
        defaultSettingsMiddleware({
          settings: {
            temperature: 0.3,
            maxOutputTokens: 4096,
            topP: 0.9,
          },
        })
      ),
    }),
  },
  fallbackProvider: openai,
});

const customAnthropic = customProvider({
  languageModels: {
    // Fast Haiku model
    fast: wrapLanguageModel({
      model: anthropic('claude-3-haiku-20240307'),
      middleware: composeMiddleware(
        loggingMiddleware,
        performanceMiddleware,
        createCachingMiddleware(),
        defaultSettingsMiddleware({
          settings: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        })
      ),
    }),

    // Sonnet for balanced quality/speed
    balanced: wrapLanguageModel({
      model: anthropic('claude-3-5-sonnet-20241022'),
      middleware: composeMiddleware(
        loggingMiddleware,
        performanceMiddleware,
        createCachingMiddleware(),
        defaultSettingsMiddleware({
          settings: {
            temperature: 0.5,
            maxOutputTokens: 4096,
          },
        })
      ),
    }),

    // Claude 3.7 with reasoning capabilities
    reasoning: wrapLanguageModel({
      model: anthropic('claude-3-7-sonnet-20250219'),
      middleware: composeMiddleware(
        loggingMiddleware,
        performanceMiddleware,
        defaultSettingsMiddleware({
          settings: {
            maxOutputTokens: 100_000,
            providerMetadata: {
              anthropic: {
                thinking: {
                  type: 'enabled',
                  budgetTokens: 32_000,
                },
              } satisfies AnthropicProviderOptions,
            },
          },
        })
      ),
    }),

    // Creative writing model
    creative: wrapLanguageModel({
      model: anthropic('claude-3-opus-20240229'),
      middleware: composeMiddleware(
        loggingMiddleware,
        performanceMiddleware,
        defaultSettingsMiddleware({
          settings: {
            temperature: 0.9,
            maxOutputTokens: 4096,
            topP: 0.95,
            frequencyPenalty: 0.5,
            presencePenalty: 0.5,
          },
        })
      ),
    }),
  },
  fallbackProvider: anthropic,
});

// Create enhanced provider registry with V2 specification compliance
export const registry = createProviderRegistry(
  {
    openai: customOpenAI,
    anthropic: customAnthropic,
  },
  { separator: ':' }
);

// Model configuration with metadata and fallback chain
export const getAIModel = (
  preferredModel?: string,
  metadata?: LanguageModelRequestMetadata
) => {
  // Model aliases for easy access
  const modelAliases: Record<string, string> = {
    // Primary models
    fast: 'openai:fast',
    balanced: 'anthropic:balanced',
    premium: 'openai:premium',

    // Specialized models
    code: 'openai:code',
    reasoning: 'anthropic:reasoning',
    creative: 'anthropic:creative',

    // Direct model access (backward compatibility)
    'gpt-4.1-nano': 'openai:premium',
    'claude-3-5-sonnet-20241022': 'anthropic:balanced',
    'gpt-4o-mini': 'openai:fast',
    'claude-3-haiku-20240307': 'anthropic:fast',
  };

  // Resolve model alias or use direct model ID
  const modelToUse = preferredModel
    ? modelAliases[preferredModel] || preferredModel
    : 'openai:premium';

  try {
    // Get model from registry
    const model = registry.languageModel(modelToUse);

    // Add request metadata if provided
    if (metadata) {
      // Note: AI SDK v5 doesn't have withMetadata method
      // Metadata is passed directly to generation functions
      return model;
    }

    return model;
  } catch (error) {
    console.warn(
      `Model ${modelToUse} not found, falling back to default`,
      error
    );
    return registry.languageModel('openai:premium');
  }
};

// Helper function to get model with metadata
export const getModelWithMetadata = (
  modelId: string,
  requestMetadata: LanguageModelRequestMetadata
) => {
  const model = getAIModel(modelId);
  // Metadata will be passed during generation
  return { model, metadata: requestMetadata };
};

// Response metadata collection for monitoring
export const collectResponseMetadata = (
  response: any
): LanguageModelResponseMetadata => {
  return {
    id: response.id || crypto.randomUUID(),
    modelId: response.modelId,
    usage: response.usage,
    finishReason: response.finishReason,
    custom: {
      timestamp: new Date().toISOString(),
      latency: response.latency,
      cached: response.cached,
      provider: response.provider,
    },
  };
};

// Rate limiting configuration
export const rateLimitConfig = {
  maxRequestsPerHour: config.get().rateLimitMaxRequests,
  maxTokensPerRequest: config.get().aiMaxTokensPerRequest,
};

// Provider metadata helpers
export const providerMetadata: Record<string, ProviderMetadata> = {
  openai: {
    provider: { name: 'openai' },
    headers: {
      'X-Custom-Header': 'SYMLog-AI',
    },
  },
  anthropic: {
    provider: { name: 'anthropic' },
    headers: {
      'X-Custom-Header': 'SYMLog-AI',
    },
  },
};

// System prompts for different contexts
export const systemPrompts = {
  default: `You are an advanced AI assistant integrated into the SYMLog platform with artifact creation capabilities.
You can create interactive artifacts including:
- Code snippets with syntax highlighting and execution capabilities
- Documents with rich formatting (markdown, HTML)
- Spreadsheets with sortable, filterable data
- Charts and visualizations
- Images and diagrams
- Structured data (JSON, CSV)

When users ask for code, documents, data, or visualizations, use the appropriate artifact tools to create interactive, editable artifacts.
You have access to information about the user's Web3 wallet and can help with various tasks.
Be concise, helpful, and accurate in your responses.`,

  technical: `You are a technical AI assistant specializing in Web3, blockchain, and software development with advanced artifact capabilities.
You can create:
- Executable code artifacts (JavaScript, TypeScript, Python, React components, Solidity)
- Technical documentation with proper formatting
- Data structures and API responses
- SQL queries and database schemas
- Architecture diagrams and flowcharts
- Smart contracts and DeFi protocols

Use artifact tools to create interactive code that users can run, edit, and learn from.
Provide detailed technical explanations alongside your artifacts.
Always consider security best practices in your recommendations.`,

  creative: `You are a creative AI assistant with multimedia artifact capabilities for the SYMLog platform.
You can create:
- Creative writing documents with rich formatting
- Data visualizations and charts
- Design mockups and wireframes
- Structured creative content (stories, poems, scripts)
- Interactive presentations
- NFT metadata and descriptions

Use artifact tools to bring creative ideas to life in interactive formats.
Think outside the box while remaining practical and actionable in your suggestions.`,
};
