import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import {
  customProvider,
  defaultSettingsMiddleware,
  extractReasoningMiddleware,
  type LanguageModel,
  type LanguageModelRequestMetadata,
  type LanguageModelResponseMetadata,
  // type LanguageModelV2Middleware, // Not exported in AI SDK v5
  simulateStreamingMiddleware,
  wrapLanguageModel,
} from 'ai';
// import { createLogger } from '../logger/unified-logger'; // TODO: Fix logger import

// Create AI middleware logger - temporary fix
const logger = {
  info: (...args: any[]) => console.log('[ai-middleware]', ...args),
  warn: (...args: any[]) => console.warn('[ai-middleware]', ...args),
  error: (...args: any[]) => console.error('[ai-middleware]', ...args),
  debug: (...args: any[]) => console.debug('[ai-middleware]', ...args),
};

// Define middleware types (not exported in AI SDK v5) - keep as any for compatibility
interface LanguageModelV2Middleware {
  wrapGenerate?: any;
  wrapStream?: any;
  transformParams?: any;
}

// Define middleware parameter types
interface TransformParamsOptions {
  params: any;
}

interface WrapGenerateOptions {
  doGenerate: () => Promise<any>;
  params?: any;
}

interface WrapStreamOptions {
  doStream: () => Promise<any>;
  params?: any;
}

// Define LanguageModelV2CallSettings locally since it's not exported from 'ai'
interface LanguageModelV2CallSettings {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  seed?: number;
}

/**
 * Logging middleware for debugging and monitoring
 */
export const loggingMiddleware: LanguageModelV2Middleware = {
  transformParams: async ({ params }: TransformParamsOptions) => {
    logger.info('AI Request', {
      model: params.model,
      promptTokens: params.prompt?.length,
      temperature: params.temperature,
    });
    return params;
  },
  wrapGenerate: async ({ doGenerate }: WrapGenerateOptions) => {
    const start = Date.now();
    try {
      const result = await doGenerate();
      logger.info('AI Response', {
        duration: Date.now() - start,
        usage: result.usage,
        finishReason: result.finishReason,
      });
      return result;
    } catch (error) {
      logger.error('AI Error', {
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  },
  wrapStream: async ({ doStream }: WrapStreamOptions) => {
    const start = Date.now();
    let tokenCount = 0;

    const { stream, ...rest } = await doStream();

    // Wrap the stream to count tokens
    const wrappedStream = (async function* () {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'text-delta') {
            tokenCount++;
          }
          yield chunk;
        }
        logger.info('AI Stream Complete', {
          duration: Date.now() - start,
          tokenCount,
        });
      } catch (error) {
        logger.error('AI Stream Error', {
          duration: Date.now() - start,
          tokenCount,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    })();

    return { stream: wrappedStream, ...rest };
  },
};

/**
 * Performance monitoring middleware
 */
export const performanceMiddleware: LanguageModelV2Middleware = {
  transformParams: async ({ params }: TransformParamsOptions) => {
    // Add performance tracking headers
    return {
      ...params,
      headers: {
        ...params.headers,
        'X-Request-ID': crypto.randomUUID(),
        'X-Request-Time': Date.now().toString(),
      },
    };
  },
  wrapGenerate: async ({ doGenerate }: WrapGenerateOptions) => {
    const metrics = {
      startTime: Date.now(),
      firstTokenTime: 0,
      endTime: 0,
    };

    const result = await doGenerate();
    metrics.endTime = Date.now();

    // Send metrics to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // await sendMetrics('ai.generation', metrics)
    }

    return result;
  },
};

/**
 * Security middleware for input/output sanitization
 */
export const securityMiddleware: LanguageModelV2Middleware = {
  transformParams: async ({ params }: TransformParamsOptions) => {
    // Enhanced prompt sanitization to prevent injection attacks
    if (params.prompt && typeof params.prompt === 'string') {
      let sanitized = params.prompt;

      // Remove HTML/script tags
      sanitized = sanitized
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
        .replace(/<object[^>]*>.*?<\/object>/gi, '')
        .replace(/<embed[^>]*>/gi, '');

      // Common prompt injection patterns
      const injectionPatterns = [
        /\b(ignore|disregard|forget)\s+(all\s+)?previous\s+(instructions?|commands?|prompts?)\b/gi,
        /\b(system|admin|root)\s*(prompt|message|command)\s*:/gi,
        /\bact\s+as\s+(if|though)\s+you\s+(are|were)\b/gi,
        /\bpretend\s+to\s+be\b/gi,
        /\byou\s+are\s+now\s+in\s+(a\s+)?new\s+mode\b/gi,
        /\brole\s*play\s*as\b/gi,
        /\bDAN\s+mode\b/gi,
        /\bjailbreak\b/gi,
        /\bbypass\s+(your\s+)?safety\b/gi,
        /\bremove\s+(all\s+)?restrictions?\b/gi,
      ];

      for (const pattern of injectionPatterns) {
        sanitized = sanitized.replace(pattern, '[INJECTION ATTEMPT BLOCKED]');
      }

      // Escape special characters that could be used for prompt manipulation
      sanitized = sanitized
        .replace(/\\n{3,}/g, '\\n\\n') // Limit consecutive newlines
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control characters

      // Log suspicious activity
      if (sanitized !== params.prompt) {
        logger.warn('Prompt sanitization applied', {
          original: params.prompt.substring(0, 100),
          sanitized: sanitized.substring(0, 100),
        });
      }

      return { ...params, prompt: sanitized };
    }

    // Sanitize system prompts as well
    if (params.system && typeof params.system === 'string') {
      const sanitizedSystem = params.system
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

      return { ...params, system: sanitizedSystem };
    }

    return params;
  },
  wrapGenerate: async ({ doGenerate, params }: WrapGenerateOptions) => {
    try {
      const result = await doGenerate();

      // Optional: Sanitize output as well
      if (result.text && typeof result.text === 'string') {
        // Remove any potential sensitive data patterns
        result.text = result.text
          .replace(
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
            '[EMAIL REDACTED]'
          )
          .replace(
            /\b(?:\+?1[-.]?)?\(?[0-9]{3}\)?[-.]?[0-9]{3}[-.]?[0-9]{4}\b/g,
            '[PHONE REDACTED]'
          )
          .replace(/\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/g, '[SSN REDACTED]');
      }

      return result;
    } catch (error) {
      // Log security-related errors
      logger.error('Generation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
};

/**
 * Caching middleware for response caching
 */
export function createCachingMiddleware(
  cache: Map<string, any> = new Map(),
  ttl: number = 5 * 60 * 1000 // 5 minutes
): LanguageModelV2Middleware {
  return {
    wrapGenerate: async ({ doGenerate, params }: WrapGenerateOptions) => {
      // Create cache key from params
      const cacheKey = JSON.stringify({
        model: params.model,
        prompt: params.prompt,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
      });

      // Check cache
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < ttl) {
        logger.info('Cache Hit', { cacheKey: cacheKey.substring(0, 50) });
        return cached.result;
      }

      // Generate and cache
      const result = await doGenerate();
      cache.set(cacheKey, {
        result,
        timestamp: Date.now(),
      });

      return result;
    },
  };
}

/**
 * Create enhanced provider with specialized models
 */
export const createEnhancedProvider = () => {
  return customProvider({
    languageModels: {
      // High-quality model with reasoning extraction
      'premium-reasoning': wrapLanguageModel({
        model: openai('gpt-4'),
        middleware: [
          loggingMiddleware,
          performanceMiddleware,
          defaultSettingsMiddleware({
            settings: {
              temperature: 0.3,
              maxOutputTokens: 4096,
              topP: 0.9,
            },
          }),
          extractReasoningMiddleware({
            tagName: 'think',
            startWithReasoning: true,
            separator: '\n---\n',
          }),
        ],
      }),

      // Fast model with streaming simulation
      'fast-streaming': wrapLanguageModel({
        model: openai('gpt-4o-mini'),
        middleware: [
          loggingMiddleware,
          simulateStreamingMiddleware(),
          defaultSettingsMiddleware({
            settings: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            },
          }),
        ],
      }),

      // Cost-optimized model with caching
      'budget-optimized': wrapLanguageModel({
        model: anthropic('claude-3-haiku-20240307'),
        middleware: [
          loggingMiddleware,
          createCachingMiddleware(),
          defaultSettingsMiddleware({
            settings: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            },
          }),
        ],
      }),

      // Secure model with input sanitization
      'secure-chat': wrapLanguageModel({
        model: openai('gpt-4'),
        middleware: [
          securityMiddleware,
          loggingMiddleware,
          defaultSettingsMiddleware({
            settings: {
              temperature: 0.5,
              maxOutputTokens: 2048,
            },
          }),
        ],
      }),

      // Code specialist with low temperature
      'code-specialist': wrapLanguageModel({
        model: openai('gpt-4'),
        middleware: [
          loggingMiddleware,
          defaultSettingsMiddleware({
            settings: {
              temperature: 0.1,
              maxOutputTokens: 8192,
              stopSequences: ['```end', '// END'],
            },
          }),
        ],
      }),

      // Creative writer with high temperature
      'creative-writer': wrapLanguageModel({
        model: anthropic('claude-3-opus-20240229'),
        middleware: [
          loggingMiddleware,
          defaultSettingsMiddleware({
            settings: {
              temperature: 0.9,
              maxOutputTokens: 4096,
              topP: 0.95,
              frequencyPenalty: 0.5,
              presencePenalty: 0.5,
            },
          }),
        ],
      }),

      // Blockchain expert with domain knowledge
      'blockchain-expert': wrapLanguageModel({
        model: openai('gpt-4'),
        middleware: [
          loggingMiddleware,
          performanceMiddleware,
          defaultSettingsMiddleware({
            settings: {
              temperature: 0.3,
              maxOutputTokens: 4096,
            },
          }),
          // Custom middleware for blockchain context
          {
            transformParams: async ({ params }: TransformParamsOptions) => {
              // Add blockchain-specific context
              const blockchainContext = `
You are a blockchain and Web3 expert with deep knowledge of:
- Solana, Ethereum, and other blockchains
- Smart contracts and DeFi protocols
- Wallet integration and security
- Token standards and NFTs
`;
              return {
                ...params,
                system: params.system
                  ? `${params.system}\n\n${blockchainContext}`
                  : blockchainContext,
              };
            },
          },
        ],
      }),
    },
    fallbackProvider: openai,
  });
};

/**
 * Compose multiple middleware into one
 */
export function composeMiddleware(
  ...middlewares: LanguageModelV2Middleware[]
): LanguageModelV2Middleware {
  return {
    transformParams: async (options: { params: any }) => {
      let params = options.params;
      for (const middleware of middlewares) {
        if (middleware.transformParams) {
          params = await middleware.transformParams({ ...options, params });
        }
      }
      return params;
    },
    wrapGenerate: async (options: { doGenerate: () => any }) => {
      let doGenerate = options.doGenerate;

      // Apply middleware in reverse order (last one is innermost)
      for (const middleware of [...middlewares].reverse()) {
        if (middleware.wrapGenerate) {
          const currentDoGenerate = doGenerate;
          doGenerate = () =>
            middleware.wrapGenerate!({
              ...options,
              doGenerate: currentDoGenerate,
            });
        }
      }

      return doGenerate();
    },
    wrapStream: async (options: { doStream: () => any }) => {
      let doStream = options.doStream;

      // Apply middleware in reverse order
      for (const middleware of [...middlewares].reverse()) {
        if (middleware.wrapStream) {
          const currentDoStream = doStream;
          doStream = () =>
            middleware.wrapStream!({
              ...options,
              doStream: currentDoStream,
            });
        }
      }

      return doStream();
    },
  };
}

/**
 * Create a rate limiting middleware
 */
export function createRateLimitMiddleware(
  maxRequests = 10,
  windowMs = 60_000 // 1 minute
): LanguageModelV2Middleware {
  const requests = new Map<string, number[]>();

  return {
    transformParams: async ({ params }: TransformParamsOptions) => {
      const key = params.userId || 'anonymous';
      const now = Date.now();
      const userRequests = requests.get(key) || [];

      // Remove old requests outside the window
      const validRequests = userRequests.filter(
        (time) => now - time < windowMs
      );

      if (validRequests.length >= maxRequests) {
        throw new Error(
          `Rate limit exceeded: ${maxRequests} requests per ${windowMs}ms`
        );
      }

      validRequests.push(now);
      requests.set(key, validRequests);

      return params;
    },
  };
}

/**
 * Create a retry middleware with exponential backoff
 */
export function createRetryMiddleware(
  maxRetries = 3,
  initialDelay = 1000
): LanguageModelV2Middleware {
  return {
    wrapGenerate: async ({ doGenerate }: WrapGenerateOptions) => {
      let lastError: Error | undefined;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await doGenerate();
        } catch (error) {
          lastError = error as Error;
          logger.warn('Retry attempt failed', {
            attempt: attempt + 1,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          if (attempt < maxRetries) {
            const delay = initialDelay * 2 ** attempt;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      throw lastError || new Error('All retry attempts failed');
    },
  };
}

// Export the enhanced provider instance
export const enhancedProvider = createEnhancedProvider();
