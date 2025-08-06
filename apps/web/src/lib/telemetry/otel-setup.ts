// otel-setup.ts - OpenTelemetry SDK initialization
// Implements August 2025 best practices for production-ready telemetry

import { context, metrics, propagation, trace } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from '@opentelemetry/core';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { FsInstrumentation } from '@opentelemetry/instrumentation-fs';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { B3InjectEncoding, B3Propagator } from '@opentelemetry/propagator-b3';
import { JaegerPropagator } from '@opentelemetry/propagator-jaeger';
// @ts-expect-error - Resource import conflicts with verbatimModuleSyntax
import { Resource } from '@opentelemetry/resources';
import {
  ConsoleMetricExporter,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  ParentBasedSampler,
  SimpleSpanProcessor,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-node';
import {
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  SEMRESATTRS_HOST_NAME,
  SEMRESATTRS_OS_TYPE,
  SEMRESATTRS_PROCESS_PID,
  SEMRESATTRS_SERVICE_INSTANCE_ID,
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

/**
 * OpenTelemetry configuration options
 */
export interface OTelConfig {
  serviceName: string;
  serviceVersion: string;
  environment: 'development' | 'staging' | 'production';

  // Sampling configuration
  samplingRatio: number;
  enableParentBasedSampling: boolean;

  // Export configuration
  enableOTLPExport: boolean;
  enableConsoleExport: boolean;
  otlpEndpoint?: string;
  otlpHeaders?: Record<string, string>;

  // Instrumentation configuration
  enableAutoInstrumentation: boolean;
  enableHttpInstrumentation: boolean;
  enableExpressInstrumentation: boolean;
  enableFsInstrumentation: boolean;

  // Context propagation
  enableW3CTraceContext: boolean;
  enableB3Propagation: boolean;
  enableJaegerPropagation: boolean;
  enableBaggage: boolean;

  // Performance settings
  exportTimeoutMillis: number;
  maxExportBatchSize: number;
  maxQueueSize: number;
  scheduledDelayMillis: number;

  // Circuit breaker settings
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;

  // Health check settings
  enableHealthCheck: boolean;
  healthCheckPort: number;
}

/**
 * Default OpenTelemetry configuration following August 2025 best practices
 */
const DEFAULT_OTEL_CONFIG: OTelConfig = {
  serviceName: 'symlog-ai-app',
  serviceVersion: '1.0.0',
  environment: 'development',

  // Optimized sampling for AI workloads
  samplingRatio: 0.1, // 10% sampling for development, 1-5% for production
  enableParentBasedSampling: true,

  // Export configuration
  enableOTLPExport: false, // Disabled by default for development
  enableConsoleExport: true,
  otlpEndpoint:
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    'http://localhost:4318/v1/traces',

  // Auto-instrumentation for comprehensive coverage
  enableAutoInstrumentation: true,
  enableHttpInstrumentation: true,
  enableExpressInstrumentation: true,
  enableFsInstrumentation: false, // Can be noisy for AI applications

  // Multi-format context propagation for interoperability
  enableW3CTraceContext: true,
  enableB3Propagation: true,
  enableJaegerPropagation: false,
  enableBaggage: true,

  // Performance-optimized export settings
  exportTimeoutMillis: 10_000, // 10 seconds
  maxExportBatchSize: 512,
  maxQueueSize: 2048,
  scheduledDelayMillis: 1000, // 1 second batching

  // Production reliability features
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 30_000, // 30 seconds

  // Health monitoring
  enableHealthCheck: true,
  healthCheckPort: 3001,
};

/**
 * OpenTelemetry initialization and management service
 */
export class OpenTelemetryManager {
  private sdk?: NodeSDK;
  private config: OTelConfig;
  private circuitBreakerState: 'closed' | 'open' | 'half-open' = 'closed';
  private circuitBreakerFailures = 0;
  private circuitBreakerLastFailure = 0;
  private isInitialized = false;
  private healthCheckServer?: any;

  constructor(config?: Partial<OTelConfig>) {
    this.config = {
      ...DEFAULT_OTEL_CONFIG,
      ...config,
      // Override with environment variables
      serviceName:
        process.env.OTEL_SERVICE_NAME || DEFAULT_OTEL_CONFIG.serviceName,
      serviceVersion:
        process.env.OTEL_SERVICE_VERSION || DEFAULT_OTEL_CONFIG.serviceVersion,
      environment:
        (process.env.NODE_ENV as any) || DEFAULT_OTEL_CONFIG.environment,
    };

    // Adjust config based on environment
    this.adjustConfigForEnvironment();
  }

  /**
   * Initialize OpenTelemetry with comprehensive configuration
   */
  async initialize(): Promise<void> {
    try {
      console.log(
        '🚀 Initializing OpenTelemetry SDK with August 2025 best practices...'
      );

      // Create resource with comprehensive metadata
      const resource = this.createResource();

      // Configure context manager for Node.js async hooks
      const contextManager = new AsyncLocalStorageContextManager();
      context.setGlobalContextManager(contextManager);

      // Configure context propagation
      this.configurePropagation();

      // Create span processors
      const spanProcessors = this.createSpanProcessors();

      // Create metric readers
      const metricReaders = this.createMetricReaders();

      // Create sampler
      const sampler = this.createSampler();

      // Create instrumentations
      const instrumentations = this.createInstrumentations();

      // Initialize the SDK
      this.sdk = new NodeSDK({
        resource,
        sampler,
        spanProcessors,
        metricReader: metricReaders[0], // NodeSDK expects single reader
        instrumentations,
        contextManager,
      });

      // Start the SDK
      await this.sdk.start();

      // Start health check server if enabled
      if (this.config.enableHealthCheck) {
        this.startHealthCheckServer();
      }

      this.isInitialized = true;

      console.log('✅ OpenTelemetry SDK initialized successfully');
      console.log(`📊 Service: ${this.config.serviceName}`);
      console.log(`🌍 Environment: ${this.config.environment}`);
      console.log(`📈 Sampling: ${this.config.samplingRatio * 100}%`);
      console.log(
        `🔄 OTLP Export: ${this.config.enableOTLPExport ? 'Enabled' : 'Disabled'}`
      );
    } catch (error) {
      console.error('❌ Failed to initialize OpenTelemetry:', error);
      this.handleCircuitBreakerFailure();
      throw new Error(
        `OpenTelemetry initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Graceful shutdown of OpenTelemetry
   */
  async shutdown(): Promise<void> {
    try {
      console.log('🛑 Shutting down OpenTelemetry SDK...');

      if (this.healthCheckServer) {
        this.healthCheckServer.close();
      }

      if (this.sdk) {
        await this.sdk.shutdown();
      }

      this.isInitialized = false;
      console.log('✅ OpenTelemetry SDK shutdown complete');
    } catch (error) {
      console.error('❌ Error during OpenTelemetry shutdown:', error);
    }
  }

  /**
   * Check if OpenTelemetry is properly initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.circuitBreakerState !== 'open';
  }

  /**
   * Get current telemetry configuration
   */
  getConfig(): OTelConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (requires restart)
   */
  updateConfig(newConfig: Partial<OTelConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log(
      '⚠️ Configuration updated. Restart required for changes to take effect.'
    );
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): {
    state: 'open' | 'half-open' | 'closed';
    failures: number;
    lastFailure: number;
  } {
    return {
      state: this.circuitBreakerState,
      failures: this.circuitBreakerFailures,
      lastFailure: this.circuitBreakerLastFailure,
    };
  }

  // Private methods

  private adjustConfigForEnvironment(): void {
    if (this.config.environment === 'production') {
      // Production optimizations
      this.config.samplingRatio = Math.min(this.config.samplingRatio, 0.05); // Max 5% in prod
      this.config.enableConsoleExport = false;
      this.config.enableOTLPExport = true;
      this.config.enableFsInstrumentation = false; // Reduce noise
      this.config.maxExportBatchSize = 1024;
      this.config.scheduledDelayMillis = 5000; // 5 second batching for efficiency
    } else if (this.config.environment === 'staging') {
      // Staging configuration
      this.config.samplingRatio = Math.min(this.config.samplingRatio, 0.2); // Max 20% in staging
      this.config.enableConsoleExport = false;
      this.config.enableOTLPExport = true;
    }
    // Development keeps default settings for full observability
  }

  private createResource(): Resource {
    const resourceAttributes = {
      [SEMRESATTRS_SERVICE_NAME]: this.config.serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: this.config.serviceVersion,
      [SEMRESATTRS_SERVICE_INSTANCE_ID]: `${this.config.serviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: this.config.environment,
      [SEMRESATTRS_HOST_NAME]: process.env.HOSTNAME || 'localhost',
      [SEMRESATTRS_OS_TYPE]: process.platform,
      [SEMRESATTRS_PROCESS_PID]: process.pid,

      // AI-specific resource attributes
      'ai.system.type': 'multimodal',
      'ai.framework': 'vercel-ai-sdk',
      'ai.model.providers': 'openai,anthropic',
      'telemetry.sdk.language': 'nodejs',
      'telemetry.sdk.version': '1.0.0',
    };

    // @ts-expect-error - Resource constructor conflicts with verbatimModuleSyntax
    return new Resource(resourceAttributes);
  }

  private configurePropagation(): void {
    const propagators: any[] = [];

    if (this.config.enableW3CTraceContext) {
      propagators.push(new W3CTraceContextPropagator());
    }

    if (this.config.enableBaggage) {
      propagators.push(new W3CBaggagePropagator());
    }

    if (this.config.enableB3Propagation) {
      propagators.push(
        new B3Propagator({
          injectEncoding: B3InjectEncoding.MULTI_HEADER,
        })
      );
    }

    if (this.config.enableJaegerPropagation) {
      propagators.push(new JaegerPropagator());
    }

    // Set composite propagator
    propagation.setGlobalPropagator(
      new CompositePropagator({
        propagators,
      })
    );
  }

  private createSampler() {
    const baseSampler = new TraceIdRatioBasedSampler(this.config.samplingRatio);

    if (this.config.enableParentBasedSampling) {
      return new ParentBasedSampler({
        root: baseSampler,
      });
    }

    return baseSampler;
  }

  private createSpanProcessors() {
    const processors: any[] = [];

    // Console exporter for development
    if (this.config.enableConsoleExport) {
      processors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
    }

    // OTLP exporter for production
    if (this.config.enableOTLPExport && this.config.otlpEndpoint) {
      const otlpExporter = new OTLPTraceExporter({
        url: this.config.otlpEndpoint,
        headers: this.config.otlpHeaders || {},
      });

      processors.push(
        new BatchSpanProcessor(otlpExporter, {
          maxExportBatchSize: this.config.maxExportBatchSize,
          maxQueueSize: this.config.maxQueueSize,
          scheduledDelayMillis: this.config.scheduledDelayMillis,
          exportTimeoutMillis: this.config.exportTimeoutMillis,
        })
      );
    }

    return processors;
  }

  private createMetricReaders() {
    const readers: any[] = [];

    // Console metrics for development
    if (this.config.enableConsoleExport) {
      readers.push(
        new PeriodicExportingMetricReader({
          exporter: new ConsoleMetricExporter(),
          exportIntervalMillis: 10_000, // 10 seconds
        })
      );
    }

    // OTLP metrics for production
    if (this.config.enableOTLPExport && this.config.otlpEndpoint) {
      const metricsEndpoint = this.config.otlpEndpoint.replace(
        '/traces',
        '/metrics'
      );

      readers.push(
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({
            url: metricsEndpoint,
            headers: this.config.otlpHeaders || {},
          }),
          exportIntervalMillis: 30_000, // 30 seconds for metrics
        })
      );
    }

    return readers;
  }

  private createInstrumentations() {
    const instrumentations: any[] = [];

    if (this.config.enableAutoInstrumentation) {
      instrumentations.push(
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: this.config.enableFsInstrumentation,
          },
        })
      );
    } else {
      // Manual instrumentation selection
      if (this.config.enableHttpInstrumentation) {
        instrumentations.push(new HttpInstrumentation());
      }

      if (this.config.enableExpressInstrumentation) {
        instrumentations.push(new ExpressInstrumentation());
      }

      if (this.config.enableFsInstrumentation) {
        instrumentations.push(new FsInstrumentation());
      }
    }

    return instrumentations;
  }

  private handleCircuitBreakerFailure(): void {
    if (!this.config.enableCircuitBreaker) return;

    this.circuitBreakerFailures++;
    this.circuitBreakerLastFailure = Date.now();

    if (this.circuitBreakerFailures >= this.config.circuitBreakerThreshold) {
      this.circuitBreakerState = 'open';
      console.warn(
        `🚨 Circuit breaker OPEN - ${this.circuitBreakerFailures} consecutive failures`
      );

      // Set timeout to try half-open state
      setTimeout(() => {
        this.circuitBreakerState = 'half-open';
        console.log('🔄 Circuit breaker HALF-OPEN - attempting recovery');
      }, this.config.circuitBreakerTimeout);
    }
  }

  private startHealthCheckServer(): void {
    try {
      const http = require('http');

      this.healthCheckServer = http.createServer((req: any, res: any) => {
        if (req.url === '/health') {
          const health = {
            status: this.isReady() ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            service: this.config.serviceName,
            version: this.config.serviceVersion,
            environment: this.config.environment,
            telemetry: {
              initialized: this.isInitialized,
              circuitBreaker: this.getCircuitBreakerStatus(),
            },
          };

          res.writeHead(this.isReady() ? 200 : 503, {
            'Content-Type': 'application/json',
          });
          res.end(JSON.stringify(health, null, 2));
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });

      this.healthCheckServer.listen(this.config.healthCheckPort, () => {
        console.log(
          `🏥 Health check server listening on port ${this.config.healthCheckPort}`
        );
      });
    } catch (error) {
      console.warn('⚠️ Failed to start health check server:', error);
    }
  }
}

// Singleton instance
let otelManager: OpenTelemetryManager | null = null;

/**
 * Initialize OpenTelemetry (singleton pattern)
 */
export async function initializeOpenTelemetry(
  config?: Partial<OTelConfig>
): Promise<OpenTelemetryManager> {
  if (!otelManager) {
    otelManager = new OpenTelemetryManager(config);
    await otelManager.initialize();
  }
  return otelManager;
}

/**
 * Get the current OpenTelemetry manager instance
 */
export function getOpenTelemetryManager(): OpenTelemetryManager | null {
  return otelManager;
}

/**
 * Shutdown OpenTelemetry
 */
export async function shutdownOpenTelemetry(): Promise<void> {
  if (otelManager) {
    await otelManager.shutdown();
    otelManager = null;
  }
}

/**
 * Check if OpenTelemetry is ready
 */
export function isOpenTelemetryReady(): boolean {
  return otelManager?.isReady() ?? false;
}

// Export convenience functions
export const otel = {
  initialize: initializeOpenTelemetry,
  shutdown: shutdownOpenTelemetry,
  isReady: isOpenTelemetryReady,
  getManager: getOpenTelemetryManager,
};

// Environment-specific configurations
export const OTelConfigs = {
  development: {
    samplingRatio: 1.0, // 100% sampling for development
    enableConsoleExport: true,
    enableOTLPExport: false,
  } as Partial<OTelConfig>,

  staging: {
    samplingRatio: 0.2, // 20% sampling for staging
    enableConsoleExport: false,
    enableOTLPExport: true,
  } as Partial<OTelConfig>,

  production: {
    samplingRatio: 0.01, // 1% sampling for production
    enableConsoleExport: false,
    enableOTLPExport: true,
    enableFsInstrumentation: false,
  } as Partial<OTelConfig>,
};
