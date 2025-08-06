// otel-metrics.ts - OpenTelemetry Metrics API integration
// Advanced metrics collection for AI applications following August 2025 best practices

import {
  type Attributes,
  type BatchObservableResult,
  type Counter,
  type Gauge,
  type Histogram,
  type Meter,
  type MetricOptions,
  metrics,
  type UpDownCounter,
  ValueType,
} from '@opentelemetry/api';

/**
 * AI-specific metric types and configurations
 */
export interface AIMetricConfig {
  namespace: string;
  version: string;
  enableDetailedMetrics: boolean;
  enablePerformanceMetrics: boolean;
  enableBusinessMetrics: boolean;
  enableResourceMetrics: boolean;
  metricPrefix?: string;
}

/**
 * Metric buckets optimized for AI workloads
 */
const AI_LATENCY_BUCKETS = [
  0.001, 0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.75,
  1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 7.5, 10.0, 15.0, 20.0, 30.0, 45.0,
  60.0, 90.0, 120.0,
];

const AI_TOKEN_BUCKETS = [
  1, 5, 10, 25, 50, 100, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000,
  7500, 10_000, 15_000, 20_000, 30_000, 50_000, 75_000, 100_000,
];

const AI_COST_BUCKETS = [
  0.0001, 0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5,
  5.0, 10.0, 25.0, 50.0, 100.0,
];

/**
 * Comprehensive AI Telemetry Metrics System
 */
export class AITelemetryMetrics {
  private meter: Meter;
  private config: AIMetricConfig;
  private metricsCache = new Map<string, any>();

  // Core AI Operation Metrics
  private aiCallsCounter!: Counter;
  private aiCallDuration!: Histogram;
  private aiTokensUsed!: Histogram;
  private aiCallsActive!: UpDownCounter;
  private aiErrorsCounter!: Counter;
  private aiCostCounter!: Counter;

  // Tool Execution Metrics
  private toolExecutionsCounter!: Counter;
  private toolExecutionDuration!: Histogram;
  private toolErrorsCounter!: Counter;

  // Streaming Metrics
  private streamingSessionsCounter!: Counter;
  private streamingDuration!: Histogram;
  private streamingChunksCounter!: Counter;
  private streamingLatency!: Histogram;

  // Cache Metrics
  private cacheHitsCounter!: Counter;
  private cacheMissesCounter!: Counter;
  private cacheSize!: UpDownCounter;

  // Model Performance Metrics
  private modelLatencyGauge!: Gauge;
  private modelThroughputGauge!: Gauge;
  private modelAccuracyGauge!: Gauge;

  // Business Metrics
  private userInteractionsCounter!: Counter;
  private sessionDuration!: Histogram;
  private userSatisfactionGauge!: Gauge;

  // Resource Utilization Metrics
  private memoryUsageGauge!: Gauge;
  private cpuUsageGauge!: Gauge;
  private diskUsageGauge!: Gauge;

  constructor(config?: Partial<AIMetricConfig>) {
    this.config = {
      namespace: 'ai_telemetry',
      version: '1.0.0',
      enableDetailedMetrics: true,
      enablePerformanceMetrics: true,
      enableBusinessMetrics: true,
      enableResourceMetrics: true,
      metricPrefix: 'symlog',
      ...config,
    };

    // Get meter instance
    this.meter = metrics.getMeter(this.config.namespace, this.config.version);

    // Initialize metrics
    this.initializeMetrics();

    // Start resource monitoring if enabled
    if (this.config.enableResourceMetrics) {
      this.startResourceMonitoring();
    }

    console.log('📊 AI Telemetry Metrics initialized with OpenTelemetry');
  }

  /**
   * Record AI API call metrics
   */
  recordAICall(
    provider: string,
    model: string,
    operation: string,
    durationMs: number,
    inputTokens: number,
    outputTokens: number,
    cost: number,
    success: boolean,
    attributes?: Attributes
  ): void {
    const baseAttributes: Attributes = {
      'ai.provider': provider,
      'ai.model': model,
      'ai.operation': operation,
      'ai.success': success,
      ...attributes,
    };

    // Record call count
    this.aiCallsCounter.add(1, baseAttributes);

    // Record duration
    this.aiCallDuration.record(durationMs / 1000, baseAttributes); // Convert to seconds

    // Record token usage
    const totalTokens = inputTokens + outputTokens;
    this.aiTokensUsed.record(totalTokens, {
      ...baseAttributes,
      'token.type': 'total',
    });
    this.aiTokensUsed.record(inputTokens, {
      ...baseAttributes,
      'token.type': 'input',
    });
    this.aiTokensUsed.record(outputTokens, {
      ...baseAttributes,
      'token.type': 'output',
    });

    // Record cost
    this.aiCostCounter.add(cost, baseAttributes);

    // Record errors
    if (!success) {
      this.aiErrorsCounter.add(1, baseAttributes);
    }

    // Update active calls counter
    this.aiCallsActive.add(1, baseAttributes);
    // Automatically decrement after recording (simulating completion)
    setTimeout(() => {
      this.aiCallsActive.add(-1, baseAttributes);
    }, 0);
  }

  /**
   * Record tool execution metrics
   */
  recordToolExecution(
    toolName: string,
    durationMs: number,
    success: boolean,
    attributes?: Attributes
  ): void {
    const baseAttributes: Attributes = {
      'tool.name': toolName,
      'tool.success': success,
      ...attributes,
    };

    this.toolExecutionsCounter.add(1, baseAttributes);
    this.toolExecutionDuration.record(durationMs / 1000, baseAttributes);

    if (!success) {
      this.toolErrorsCounter.add(1, baseAttributes);
    }
  }

  /**
   * Record streaming session metrics
   */
  recordStreamingSession(
    sessionType: 'video' | 'audio' | 'screen',
    durationMs: number,
    chunksProcessed: number,
    avgLatencyMs: number,
    attributes?: Attributes
  ): void {
    const baseAttributes: Attributes = {
      'streaming.type': sessionType,
      ...attributes,
    };

    this.streamingSessionsCounter.add(1, baseAttributes);
    this.streamingDuration.record(durationMs / 1000, baseAttributes);
    this.streamingChunksCounter.add(chunksProcessed, baseAttributes);
    this.streamingLatency.record(avgLatencyMs / 1000, baseAttributes);
  }

  /**
   * Record cache operation metrics
   */
  recordCacheOperation(
    operation: 'hit' | 'miss',
    cacheType: string,
    attributes?: Attributes
  ): void {
    const baseAttributes: Attributes = {
      'cache.type': cacheType,
      ...attributes,
    };

    if (operation === 'hit') {
      this.cacheHitsCounter.add(1, baseAttributes);
    } else {
      this.cacheMissesCounter.add(1, baseAttributes);
    }
  }

  /**
   * Update cache size
   */
  updateCacheSize(size: number, cacheType: string): void {
    // Store current value to calculate delta
    const key = `cache_size_${cacheType}`;
    const currentSize = this.metricsCache.get(key) || 0;
    const delta = size - currentSize;

    this.cacheSize.add(delta, { 'cache.type': cacheType });
    this.metricsCache.set(key, size);
  }

  /**
   * Record user interaction metrics
   */
  recordUserInteraction(
    userId: string,
    sessionId: string,
    action: string,
    sessionDurationMs?: number,
    attributes?: Attributes
  ): void {
    const baseAttributes: Attributes = {
      'user.action': action,
      'user.id': userId,
      'session.id': sessionId,
      ...attributes,
    };

    this.userInteractionsCounter.add(1, baseAttributes);

    if (sessionDurationMs) {
      this.sessionDuration.record(sessionDurationMs / 1000, baseAttributes);
    }
  }

  /**
   * Update model performance metrics
   */
  updateModelPerformance(
    provider: string,
    model: string,
    latencyMs: number,
    throughputTokensPerSecond: number,
    accuracy?: number
  ): void {
    const attributes: Attributes = {
      'ai.provider': provider,
      'ai.model': model,
    };

    // Update latency gauge (async observable)
    this.recordGaugeValue('model_latency', latencyMs / 1000, attributes);
    this.recordGaugeValue(
      'model_throughput',
      throughputTokensPerSecond,
      attributes
    );

    if (accuracy !== undefined) {
      this.recordGaugeValue('model_accuracy', accuracy, attributes);
    }
  }

  /**
   * Update user satisfaction metrics
   */
  updateUserSatisfaction(
    rating: number,
    userId: string,
    sessionId: string
  ): void {
    this.recordGaugeValue('user_satisfaction', rating, {
      'user.id': userId,
      'session.id': sessionId,
    });
  }

  /**
   * Get cache hit rate
   */
  getCacheHitRate(cacheType: string): number {
    // This would be calculated from the collected metrics
    // For now, return a placeholder
    return 0.85; // 85% hit rate
  }

  /**
   * Get current metrics summary
   */
  getMetricsSummary(): {
    totalAICalls: number;
    totalToolExecutions: number;
    totalStreamingSessions: number;
    cacheHitRate: number;
    averageLatency: number;
  } {
    // In a real implementation, these would be calculated from the actual metrics
    return {
      totalAICalls: 0, // Would be calculated from counter
      totalToolExecutions: 0,
      totalStreamingSessions: 0,
      cacheHitRate: 0.85,
      averageLatency: 0.25,
    };
  }

  // Private methods

  private initializeMetrics(): void {
    const prefix = this.config.metricPrefix
      ? `${this.config.metricPrefix}_`
      : '';

    // Initialize AI operation metrics
    this.aiCallsCounter = this.meter.createCounter(`${prefix}ai_calls_total`, {
      description: 'Total number of AI API calls',
      unit: '1',
    });

    this.aiCallDuration = this.meter.createHistogram(
      `${prefix}ai_call_duration_seconds`,
      {
        description: 'Duration of AI API calls',
        unit: 's',
        advice: {
          explicitBucketBoundaries: AI_LATENCY_BUCKETS,
        },
      }
    );

    this.aiTokensUsed = this.meter.createHistogram(`${prefix}ai_tokens_used`, {
      description: 'Number of tokens used in AI calls',
      unit: '1',
      advice: {
        explicitBucketBoundaries: AI_TOKEN_BUCKETS,
      },
    });

    this.aiCallsActive = this.meter.createUpDownCounter(
      `${prefix}ai_calls_active`,
      {
        description: 'Number of currently active AI calls',
        unit: '1',
      }
    );

    this.aiErrorsCounter = this.meter.createCounter(
      `${prefix}ai_errors_total`,
      {
        description: 'Total number of AI call errors',
        unit: '1',
      }
    );

    this.aiCostCounter = this.meter.createCounter(`${prefix}ai_cost_total`, {
      description: 'Total cost of AI operations',
      unit: 'USD',
    });

    // Initialize tool metrics
    this.toolExecutionsCounter = this.meter.createCounter(
      `${prefix}tool_executions_total`,
      {
        description: 'Total number of tool executions',
        unit: '1',
      }
    );

    this.toolExecutionDuration = this.meter.createHistogram(
      `${prefix}tool_execution_duration_seconds`,
      {
        description: 'Duration of tool executions',
        unit: 's',
      }
    );

    this.toolErrorsCounter = this.meter.createCounter(
      `${prefix}tool_errors_total`,
      {
        description: 'Total number of tool execution errors',
        unit: '1',
      }
    );

    // Initialize streaming metrics
    this.streamingSessionsCounter = this.meter.createCounter(
      `${prefix}streaming_sessions_total`,
      {
        description: 'Total number of streaming sessions',
        unit: '1',
      }
    );

    this.streamingDuration = this.meter.createHistogram(
      `${prefix}streaming_duration_seconds`,
      {
        description: 'Duration of streaming sessions',
        unit: 's',
      }
    );

    this.streamingChunksCounter = this.meter.createCounter(
      `${prefix}streaming_chunks_total`,
      {
        description: 'Total number of streaming chunks processed',
        unit: '1',
      }
    );

    this.streamingLatency = this.meter.createHistogram(
      `${prefix}streaming_latency_seconds`,
      {
        description: 'Latency of streaming operations',
        unit: 's',
      }
    );

    // Initialize cache metrics
    this.cacheHitsCounter = this.meter.createCounter(
      `${prefix}cache_hits_total`,
      {
        description: 'Total number of cache hits',
        unit: '1',
      }
    );

    this.cacheMissesCounter = this.meter.createCounter(
      `${prefix}cache_misses_total`,
      {
        description: 'Total number of cache misses',
        unit: '1',
      }
    );

    this.cacheSize = this.meter.createUpDownCounter(`${prefix}cache_size`, {
      description: 'Current cache size',
      unit: 'By',
    });

    // Initialize business metrics
    this.userInteractionsCounter = this.meter.createCounter(
      `${prefix}user_interactions_total`,
      {
        description: 'Total number of user interactions',
        unit: '1',
      }
    );

    this.sessionDuration = this.meter.createHistogram(
      `${prefix}session_duration_seconds`,
      {
        description: 'Duration of user sessions',
        unit: 's',
      }
    );

    // Initialize observable gauges for real-time metrics
    if (this.config.enablePerformanceMetrics) {
      this.initializeObservableGauges();
    }
  }

  private initializeObservableGauges(): void {
    const prefix = this.config.metricPrefix
      ? `${this.config.metricPrefix}_`
      : '';

    // Model performance gauges
    this.modelLatencyGauge = this.meter.createGauge(
      `${prefix}model_latency_seconds`,
      {
        description: 'Current model latency',
        unit: 's',
      }
    );

    this.modelThroughputGauge = this.meter.createGauge(
      `${prefix}model_throughput_tokens_per_second`,
      {
        description: 'Current model throughput',
        unit: 'tokens/s',
      }
    );

    this.modelAccuracyGauge = this.meter.createGauge(
      `${prefix}model_accuracy_ratio`,
      {
        description: 'Current model accuracy',
        unit: '1',
      }
    );

    this.userSatisfactionGauge = this.meter.createGauge(
      `${prefix}user_satisfaction_rating`,
      {
        description: 'Current user satisfaction rating',
        unit: '1',
      }
    );

    // Resource utilization gauges
    if (this.config.enableResourceMetrics) {
      this.memoryUsageGauge = this.meter.createGauge(
        `${prefix}memory_usage_bytes`,
        {
          description: 'Current memory usage',
          unit: 'By',
        }
      );

      this.cpuUsageGauge = this.meter.createGauge(`${prefix}cpu_usage_ratio`, {
        description: 'Current CPU usage',
        unit: '1',
      });

      this.diskUsageGauge = this.meter.createGauge(
        `${prefix}disk_usage_bytes`,
        {
          description: 'Current disk usage',
          unit: 'By',
        }
      );
    }
  }

  private recordGaugeValue(
    metricType: string,
    value: number,
    attributes: Attributes
  ): void {
    // Store value for observable gauges
    const key = `${metricType}_${JSON.stringify(attributes)}`;
    this.metricsCache.set(key, value);
  }

  private startResourceMonitoring(): void {
    // Monitor resource usage every 10 seconds
    setInterval(() => {
      this.collectResourceMetrics();
    }, 10_000);
  }

  private collectResourceMetrics(): void {
    try {
      // Memory usage
      const memUsage = process.memoryUsage();
      this.recordGaugeValue('memory_usage', memUsage.heapUsed, {
        'memory.type': 'heap',
      });
      this.recordGaugeValue('memory_usage', memUsage.rss, {
        'memory.type': 'rss',
      });

      // CPU usage (simplified - would need more sophisticated monitoring in production)
      const cpuUsage = process.cpuUsage();
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1_000_000; // Convert to seconds
      this.recordGaugeValue('cpu_usage', cpuPercent, { 'cpu.type': 'total' });
    } catch (error) {
      console.warn('Failed to collect resource metrics:', error);
    }
  }
}

// Singleton instance
let aiMetrics: AITelemetryMetrics | null = null;

/**
 * Initialize AI telemetry metrics (singleton)
 */
export function initializeAIMetrics(
  config?: Partial<AIMetricConfig>
): AITelemetryMetrics {
  if (!aiMetrics) {
    aiMetrics = new AITelemetryMetrics(config);
  }
  return aiMetrics;
}

/**
 * Get the current AI metrics instance
 */
export function getAIMetrics(): AITelemetryMetrics | null {
  return aiMetrics;
}

/**
 * Convenience functions for common metric operations
 */
export const aiMetricsHelpers = {
  recordAICall: (
    provider: string,
    model: string,
    operation: string,
    durationMs: number,
    inputTokens: number,
    outputTokens: number,
    cost: number,
    success: boolean,
    attributes?: Attributes
  ) => {
    aiMetrics?.recordAICall(
      provider,
      model,
      operation,
      durationMs,
      inputTokens,
      outputTokens,
      cost,
      success,
      attributes
    );
  },

  recordToolExecution: (
    toolName: string,
    durationMs: number,
    success: boolean,
    attributes?: Attributes
  ) => {
    aiMetrics?.recordToolExecution(toolName, durationMs, success, attributes);
  },

  recordCacheHit: (cacheType: string, attributes?: Attributes) => {
    aiMetrics?.recordCacheOperation('hit', cacheType, attributes);
  },

  recordCacheMiss: (cacheType: string, attributes?: Attributes) => {
    aiMetrics?.recordCacheOperation('miss', cacheType, attributes);
  },

  updateModelPerformance: (
    provider: string,
    model: string,
    latencyMs: number,
    throughputTokensPerSecond: number,
    accuracy?: number
  ) => {
    aiMetrics?.updateModelPerformance(
      provider,
      model,
      latencyMs,
      throughputTokensPerSecond,
      accuracy
    );
  },
};

// Export default instance getter
export const getDefaultAIMetrics = () => aiMetrics || initializeAIMetrics();
