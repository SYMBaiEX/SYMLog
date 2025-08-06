import { z } from 'zod';

// Define configuration schema
const configSchema = z.object({
  // API Keys
  openaiApiKey: z.string().min(1, 'OpenAI API key is required'),
  anthropicApiKey: z.string().min(1, 'Anthropic API key is required'),
  crossmintClientKey: z.string().min(1, 'Crossmint client key is required'),
  crossmintApiKey: z.string().optional(),
  googleApiKey: z.string().optional(),
  mistralApiKey: z.string().optional(),

  // Database
  postgresUrl: z.string().url('Invalid database URL'),

  // Redis
  redisUrl: z.string().url('Invalid Redis URL').optional(),

  // Security
  jwtSecret: z.string().min(32, 'JWT secret must be at least 32 characters'),
  csrfSecret: z.string().min(32, 'CSRF secret must be at least 32 characters'),

  // Rate Limiting
  rateLimitWindowMs: z.number().default(60_000), // 1 minute
  rateLimitMaxRequests: z.number().default(100),

  // AI Settings
  aiMaxTokensPerRequest: z.number().default(2000),
  aiMaxTokensPerDay: z.number().default(1_000_000),
  aiTimeout: z.number().default(120_000), // 2 minutes

  // Environment
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  isProduction: z.boolean(),

  // URLs
  nextPublicAppUrl: z.string().url('Invalid app URL'),

  // Feature Flags
  enableSolanaWallet: z.boolean().default(true),
  enableCrossmintAuth: z.boolean().default(true),
  enableSecurityLogging: z.boolean().default(true),

  // Monitoring
  sentryDsn: z.string().optional(),
  logLevel: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
});

export type Config = z.infer<typeof configSchema>;

class ConfigService {
  private static instance: ConfigService;
  private config: Config | null = null;

  private constructor() {}

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  initialize(): Config {
    if (this.config) {
      return this.config;
    }

    try {
      const rawConfig = {
        // API Keys
        openaiApiKey: process.env.OPENAI_API_KEY ?? '',
        anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
        crossmintClientKey: process.env.CROSSMINT_CLIENT_KEY ?? '',
        crossmintApiKey: process.env.CROSSMINT_API_KEY,
        googleApiKey: process.env.GOOGLE_API_KEY,
        mistralApiKey: process.env.MISTRAL_API_KEY,

        // Database
        postgresUrl: process.env.POSTGRES_URL ?? '',

        // Redis
        redisUrl: process.env.REDIS_URL,

        // Security
        jwtSecret: process.env.JWT_SECRET ?? '',
        csrfSecret: process.env.CSRF_SECRET ?? '',

        // Rate Limiting
        rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS
          ? Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS)
          : 60_000,
        rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS
          ? Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS)
          : 100,

        // AI Settings
        aiMaxTokensPerRequest: process.env.AI_MAX_TOKENS_PER_REQUEST
          ? Number.parseInt(process.env.AI_MAX_TOKENS_PER_REQUEST)
          : 2000,
        aiMaxTokensPerDay: process.env.AI_MAX_TOKENS_PER_DAY
          ? Number.parseInt(process.env.AI_MAX_TOKENS_PER_DAY)
          : 1_000_000,
        aiTimeout: process.env.AI_TIMEOUT
          ? Number.parseInt(process.env.AI_TIMEOUT)
          : 120_000,

        // Environment
        nodeEnv: (process.env.NODE_ENV ?? 'development') as
          | 'development'
          | 'production'
          | 'test',
        isProduction: process.env.NODE_ENV === 'production',

        // URLs
        nextPublicAppUrl:
          process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',

        // Feature Flags
        enableSolanaWallet: process.env.ENABLE_SOLANA_WALLET !== 'false',
        enableCrossmintAuth: process.env.ENABLE_CROSSMINT_AUTH !== 'false',
        enableSecurityLogging: process.env.ENABLE_SECURITY_LOGGING !== 'false',

        // Monitoring
        sentryDsn: process.env.SENTRY_DSN,
        logLevel: (process.env.LOG_LEVEL ?? 'info') as Config['logLevel'],
      };

      // Validate configuration
      this.config = configSchema.parse(rawConfig);

      // Freeze config to prevent runtime modifications
      Object.freeze(this.config);

      return this.config;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Configuration validation failed:', error.issues);
        throw new Error(
          `Invalid configuration: ${error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        );
      }
      throw error;
    }
  }

  get(): Config {
    if (!this.config) {
      throw new Error(
        'Configuration not initialized. Call initialize() first.'
      );
    }
    return this.config;
  }

  // Convenience getters for common values
  getOpenAIKey(): string {
    return this.get().openaiApiKey;
  }

  getAnthropicKey(): string {
    return this.get().anthropicApiKey;
  }

  getDatabaseUrl(): string {
    return this.get().postgresUrl;
  }

  getJWTSecret(): string {
    return this.get().jwtSecret;
  }

  getCSRFSecret(): string {
    return this.get().csrfSecret;
  }

  isProduction(): boolean {
    return this.get().isProduction;
  }

  isDevelopment(): boolean {
    return this.get().nodeEnv === 'development';
  }

  isTest(): boolean {
    return this.get().nodeEnv === 'test';
  }

  // Feature flag checkers
  isSolanaWalletEnabled(): boolean {
    return this.get().enableSolanaWallet;
  }

  isCrossmintAuthEnabled(): boolean {
    return this.get().enableCrossmintAuth;
  }

  isSecurityLoggingEnabled(): boolean {
    return this.get().enableSecurityLogging;
  }
}

// Export singleton instance
export const config = ConfigService.getInstance();

// Initialize on first import in non-test environments
if (process.env.NODE_ENV !== 'test') {
  config.initialize();
}
