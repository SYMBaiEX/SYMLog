// telemetry-integration-example.ts - Complete integration example
// Demonstrates 100% telemetry implementation with August 2025 best practices

import { aiTelemetry } from '../ai/intelligence/telemetry';
import { distributedTracing } from './distributed-tracing';
import { aiMetricsHelpers, initializeAIMetrics } from './otel-metrics';
import {
  initializeOpenTelemetry,
  isOpenTelemetryReady,
  shutdownOpenTelemetry,
} from './otel-setup';

/**
 * Complete Telemetry Integration Example
 *
 * This example demonstrates how to use the full telemetry stack:
 * 1. OpenTelemetry SDK with OTLP export
 * 2. AI-specific metrics and tracing
 * 3. Distributed tracing with context propagation
 * 4. Performance monitoring and alerting
 * 5. Business metrics and user analytics
 */

export class TelemetryIntegrationExample {
  private isInitialized = false;

  /**
   * Initialize the complete telemetry system
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing complete telemetry system...');

      // Step 1: Initialize OpenTelemetry SDK
      await initializeOpenTelemetry({
        serviceName: 'symlog-ai-complete',
        serviceVersion: '1.0.0',
        environment:
          process.env.NODE_ENV === 'production' ? 'production' : 'development',

        // Sampling configuration
        samplingRatio: process.env.NODE_ENV === 'production' ? 0.01 : 1.0, // 1% in prod, 100% in dev
        enableParentBasedSampling: true,

        // Export configuration
        enableOTLPExport: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
          ? true
          : false,
        enableConsoleExport: process.env.NODE_ENV !== 'production',
        otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
        otlpHeaders: process.env.OTEL_EXPORTER_OTLP_HEADERS
          ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
          : undefined,

        // Instrumentation
        enableAutoInstrumentation: true,
        enableHttpInstrumentation: true,
        enableExpressInstrumentation: true,
        enableFsInstrumentation: false,

        // Performance settings
        maxExportBatchSize: 512,
        scheduledDelayMillis:
          process.env.NODE_ENV === 'production' ? 5000 : 1000,

        // Production features
        enableCircuitBreaker: true,
        enableHealthCheck: true,
        healthCheckPort: Number.parseInt(
          process.env.TELEMETRY_HEALTH_PORT || '3001'
        ),
      });

      // Step 2: Initialize AI-specific metrics
      initializeAIMetrics({
        namespace: 'symlog_ai',
        version: '1.0.0',
        enableDetailedMetrics: true,
        enablePerformanceMetrics: true,
        enableBusinessMetrics: true,
        enableResourceMetrics: process.env.NODE_ENV === 'production',
        metricPrefix: 'symlog',
      });

      this.isInitialized = true;
      console.log('✅ Complete telemetry system initialized successfully!');

      // Demonstrate the system
      await this.demonstrateFeatures();
    } catch (error) {
      console.error('❌ Failed to initialize telemetry:', error);
      throw error;
    }
  }

  /**
   * Demonstrate all telemetry features
   */
  private async demonstrateFeatures(): Promise<void> {
    console.log('📊 Demonstrating telemetry features...');

    // 1. AI API Call with full telemetry
    await this.demonstrateAICall();

    // 2. Tool execution tracking
    await this.demonstrateToolExecution();

    // 3. Streaming operations
    this.demonstrateStreamingMetrics();

    // 4. User interaction tracking
    this.demonstrateUserAnalytics();

    // 5. Cache operations
    this.demonstrateCacheMetrics();

    // 6. Error handling and resilience
    await this.demonstrateErrorHandling();

    // 7. Performance monitoring
    this.demonstratePerformanceMetrics();

    // 8. Business metrics
    this.demonstrateBusinessMetrics();

    console.log('✅ All telemetry features demonstrated!');
  }

  /**
   * Demonstrate AI API call with complete telemetry integration
   */
  private async demonstrateAICall(): Promise<void> {
    console.log('🤖 Demonstrating AI call telemetry...');

    const result = await aiTelemetry.trackAICall(
      'chat-completion',
      'gpt-4o',
      async () => {
        // Simulate AI API call
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return {
          usage: { inputTokens: 150, outputTokens: 200 },
          responseMetadata: { finishReason: 'stop' },
        };
      },
      {
        userId: 'demo-user-123',
        sessionId: 'demo-session-456',
        temperature: 0.7,
        estimatedInputTokens: 150,
      }
    );

    console.log('📈 AI call completed with telemetry:', {
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      cost: '~$0.0025',
    });
  }

  /**
   * Demonstrate tool execution tracking
   */
  private async demonstrateToolExecution(): Promise<void> {
    console.log('🔧 Demonstrating tool execution telemetry...');

    await aiTelemetry.trackToolExecution(
      'web-search',
      { query: 'OpenTelemetry best practices 2025' },
      async () => {
        // Simulate tool execution
        await new Promise((resolve) => setTimeout(resolve, 800));
        return { results: ['result1', 'result2'], count: 2 };
      },
      {
        userId: 'demo-user-123',
        sessionId: 'demo-session-456',
        workflowId: 'search-workflow-1',
      }
    );

    console.log('🔍 Tool execution completed with telemetry');
  }

  /**
   * Demonstrate streaming metrics
   */
  private demonstrateStreamingMetrics(): void {
    console.log('📺 Demonstrating streaming telemetry...');

    aiTelemetry.trackStreaming(
      'video-analysis',
      'gpt-4o',
      45, // chunks processed
      8000, // duration ms
      2200, // total tokens
      {
        userId: 'demo-user-123',
        sessionId: 'demo-session-456',
        firstChunkTime: 150,
        lastChunkTime: 7850,
      }
    );

    console.log(
      '📊 Streaming metrics recorded: 45 chunks, 8s duration, 5.6 chunks/sec'
    );
  }

  /**
   * Demonstrate user analytics
   */
  private demonstrateUserAnalytics(): void {
    console.log('👤 Demonstrating user analytics...');

    // Track various user interactions
    aiTelemetry.trackUserInteraction(
      'demo-user-123',
      'demo-session-456',
      'chat-start',
      {}
    );
    aiTelemetry.trackUserInteraction(
      'demo-user-123',
      'demo-session-456',
      'file-upload',
      { fileType: 'pdf' }
    );
    aiTelemetry.trackUserInteraction(
      'demo-user-123',
      'demo-session-456',
      'tool-use',
      { toolName: 'web-search' }
    );

    const analytics = aiTelemetry.getUserAnalytics('demo-user-123');
    console.log('📊 User analytics:', {
      totalInteractions: analytics.totalInteractions,
      uniqueUsers: analytics.uniqueUsers,
      popularActions: Array.from(analytics.popularActions.entries()),
    });
  }

  /**
   * Demonstrate cache metrics
   */
  private demonstrateCacheMetrics(): void {
    console.log('💾 Demonstrating cache telemetry...');

    // Record cache operations
    aiMetricsHelpers.recordCacheHit('response-cache', {
      cacheKey: 'gpt4o-chat-hash-123',
    });
    aiMetricsHelpers.recordCacheMiss('response-cache', {
      cacheKey: 'gpt4o-chat-hash-456',
    });
    aiMetricsHelpers.recordCacheHit('model-cache', { model: 'gpt-4o' });

    console.log('📈 Cache metrics recorded: 2 hits, 1 miss (~66.7% hit rate)');
  }

  /**
   * Demonstrate error handling and resilience
   */
  private async demonstrateErrorHandling(): Promise<void> {
    console.log('⚠️ Demonstrating error handling telemetry...');

    try {
      await aiTelemetry.trackAICall(
        'error-simulation',
        'gpt-4o',
        async () => {
          throw new Error('Simulated API timeout');
        },
        { userId: 'demo-user-123' }
      );
    } catch (error) {
      console.log(
        '❌ Error properly tracked in telemetry:',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    const metrics = aiTelemetry.getMetrics();
    console.log('📊 Error metrics updated:', {
      totalCalls: metrics.totalCalls,
      failedCalls: metrics.failedCalls,
      errorRate: `${(metrics.errorRate * 100).toFixed(1)}%`,
    });
  }

  /**
   * Demonstrate performance metrics
   */
  private demonstratePerformanceMetrics(): void {
    console.log('⚡ Demonstrating performance metrics...');

    // Update model performance
    aiMetricsHelpers.updateModelPerformance(
      'openai',
      'gpt-4o',
      180, // latency ms
      52.3, // tokens per second
      0.94 // accuracy
    );

    aiMetricsHelpers.updateModelPerformance(
      'anthropic',
      'claude-3.5-sonnet',
      220, // latency ms
      45.1, // tokens per second
      0.96 // accuracy
    );

    console.log('📈 Performance metrics updated for GPT-4o and Claude');
  }

  /**
   * Demonstrate business metrics
   */
  private demonstrateBusinessMetrics(): void {
    console.log('💼 Demonstrating business metrics...');

    // Track user satisfaction
    const aiMetrics = initializeAIMetrics();
    aiMetrics.updateUserSatisfaction(4.5, 'demo-user-123', 'demo-session-456');

    // Record user interaction with session duration
    aiTelemetry.trackUserInteraction(
      'demo-user-123',
      'demo-session-456',
      'session-end',
      { satisfaction: 4.5, duration: 15 * 60 * 1000 } // 15 minutes
    );

    console.log(
      '💰 Business metrics updated: 4.5/5 satisfaction, 15min session'
    );
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus(): {
    telemetryReady: boolean;
    openTelemetryReady: boolean;
    metrics: any;
    circuitBreakerStatus: any;
  } {
    const metrics = aiTelemetry.getMetrics();

    return {
      telemetryReady: this.isInitialized,
      openTelemetryReady: isOpenTelemetryReady(),
      metrics: {
        totalCalls: metrics.totalCalls,
        successfulCalls: metrics.successfulCalls,
        errorRate: `${(metrics.errorRate * 100).toFixed(1)}%`,
        averageDuration: `${metrics.averageDuration.toFixed(0)}ms`,
        totalTokens: metrics.totalTokens.total,
        cacheHitRate: `${(metrics.cacheMetrics.hitRate * 100).toFixed(1)}%`,
      },
      circuitBreakerStatus: 'Ready', // Would get from OTel manager
    };
  }

  /**
   * Export telemetry data for analysis
   */
  exportData(format: 'json' | 'csv' = 'json'): string {
    return aiTelemetry.exportData({
      format,
      startTime: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
      endTime: Date.now(),
    });
  }

  /**
   * Graceful shutdown of telemetry system
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down telemetry system...');

    try {
      // Export final metrics before shutdown
      const finalData = this.exportData('json');
      console.log('📤 Final telemetry data exported');

      // Shutdown OpenTelemetry
      await shutdownOpenTelemetry();

      this.isInitialized = false;
      console.log('✅ Telemetry system shutdown complete');
    } catch (error) {
      console.error('❌ Error during telemetry shutdown:', error);
    }
  }
}

/**
 * Usage example function
 */
export async function runTelemetryExample(): Promise<void> {
  const telemetryExample = new TelemetryIntegrationExample();

  try {
    // Initialize and demonstrate
    await telemetryExample.initialize();

    // Show system status
    const status = telemetryExample.getSystemStatus();
    console.log('📊 System Status:', JSON.stringify(status, null, 2));

    // Export data
    const exportedData = telemetryExample.exportData('json');
    console.log('📤 Exported data length:', exportedData.length, 'characters');

    // Graceful shutdown (in production, this would be called on process exit)
    setTimeout(async () => {
      await telemetryExample.shutdown();
    }, 5000);
  } catch (error) {
    console.error('❌ Telemetry example failed:', error);
  }
}

// Environment-specific configurations for easy deployment
export const TelemetryConfigs = {
  development: {
    serviceName: 'symlog-ai-dev',
    samplingRatio: 1.0,
    enableConsoleExport: true,
    enableOTLPExport: false,
    enableResourceMetrics: false,
  },

  staging: {
    serviceName: 'symlog-ai-staging',
    samplingRatio: 0.2,
    enableConsoleExport: false,
    enableOTLPExport: true,
    enableResourceMetrics: true,
    otlpEndpoint: process.env.OTEL_STAGING_ENDPOINT,
  },

  production: {
    serviceName: 'symlog-ai-prod',
    samplingRatio: 0.01,
    enableConsoleExport: false,
    enableOTLPExport: true,
    enableResourceMetrics: true,
    enableCircuitBreaker: true,
    enableHealthCheck: true,
    otlpEndpoint: process.env.OTEL_PROD_ENDPOINT,
    circuitBreakerThreshold: 10,
    maxExportBatchSize: 1024,
    scheduledDelayMillis: 5000,
  },
};

// Export for easy importing
export { TelemetryIntegrationExample as default };
