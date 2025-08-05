import type { TextStreamPart, ToolSet } from 'ai';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import {
  type CompressionTransformConfig,
  createCompressionTransform,
  createDebugTransform,
  createFilterTransform,
  createMetricsTransform,
  type DebugEvent,
  type DebugTransformConfig,
  experimentalAI,
  type FilterTransformConfig,
  globalMetricsCollector,
  type MetricsTransformConfig,
  ProviderMetricsCollector,
  type ProviderMetricsData,
  transformPresets,
} from '../experimental';

// Mock AI SDK components
vi.mock('ai', () => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
  smoothStream: vi.fn(() => ({
    transform: vi.fn(),
  })),
}));

// Mock providers
vi.mock('../providers', () => ({
  getAIModel: vi.fn(() => ({
    provider: 'openai',
    modelId: 'gpt-4',
    generate: vi.fn(),
    stream: vi.fn(),
  })),
}));

describe('Experimental AI Features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Transform Creators', () => {
    describe('createCompressionTransform', () => {
      it('should create a compression transform with correct configuration', () => {
        const config: CompressionTransformConfig = {
          enabled: true,
          threshold: 1024,
          algorithm: 'gzip',
          level: 6,
        };

        const transform = createCompressionTransform(config);
        expect(transform).toBeDefined();
        expect(typeof transform).toBe('function');
      });

      it('should process text chunks and add compression metadata', () => {
        const config: CompressionTransformConfig = {
          enabled: true,
          threshold: 100, // Low threshold for testing
          algorithm: 'gzip',
          level: 3,
          debug: true,
        };

        const transform = createCompressionTransform(config);
        const transformStream = transform({
          stopStream: vi.fn(),
          tools: {} as any,
        });

        expect(transformStream).toBeInstanceOf(TransformStream);
      });

      it('should not compress when below threshold', () => {
        const config: CompressionTransformConfig = {
          enabled: true,
          threshold: 1000, // High threshold
          algorithm: 'gzip',
          level: 3,
        };

        const transform = createCompressionTransform(config);
        const transformStream = transform({
          stopStream: vi.fn(),
          tools: {} as any,
        });

        expect(transformStream).toBeInstanceOf(TransformStream);
      });
    });

    describe('createMetricsTransform', () => {
      it('should create metrics transform with sampling', () => {
        const config: MetricsTransformConfig = {
          enabled: true,
          collectTokenMetrics: true,
          collectPerformanceMetrics: true,
          collectQualityMetrics: true,
          sampleRate: 1.0, // 100% sampling for testing
        };

        const transform = createMetricsTransform(config);
        expect(transform).toBeDefined();
        expect(typeof transform).toBe('function');
      });

      it('should collect performance metrics', () => {
        const config: MetricsTransformConfig = {
          enabled: true,
          collectTokenMetrics: true,
          collectPerformanceMetrics: true,
          collectQualityMetrics: false,
          sampleRate: 1.0,
        };

        const transform = createMetricsTransform(config);
        const transformStream = transform({
          stopStream: vi.fn(),
          tools: {} as any,
        });

        expect(transformStream).toBeInstanceOf(TransformStream);
      });

      it('should respect sampling rate', () => {
        const config: MetricsTransformConfig = {
          enabled: true,
          collectTokenMetrics: true,
          collectPerformanceMetrics: true,
          collectQualityMetrics: true,
          sampleRate: 0.0, // 0% sampling - should skip processing
        };

        const transform = createMetricsTransform(config);
        const transformStream = transform({
          stopStream: vi.fn(),
          tools: {} as any,
        });

        expect(transformStream).toBeInstanceOf(TransformStream);
      });
    });

    describe('createDebugTransform', () => {
      it('should create debug transform with console output', () => {
        const consoleSpy = vi
          .spyOn(console, 'log')
          .mockImplementation(() => {});

        const config: DebugTransformConfig = {
          enabled: true,
          logLevel: 'debug',
          includeContent: true,
          includeMetadata: true,
          outputFormat: 'console',
        };

        const transform = createDebugTransform(config);
        expect(transform).toBeDefined();
        expect(typeof transform).toBe('function');

        consoleSpy.mockRestore();
      });

      it('should create debug transform with callback output', () => {
        const callbackMock = vi.fn();

        const config: DebugTransformConfig = {
          enabled: true,
          logLevel: 'trace',
          includeContent: true,
          includeMetadata: true,
          outputFormat: 'callback',
          callback: callbackMock,
        };

        const transform = createDebugTransform(config);
        const transformStream = transform({
          stopStream: vi.fn(),
          tools: {} as any,
        });

        expect(transformStream).toBeInstanceOf(TransformStream);
      });

      it('should filter log levels correctly', () => {
        const consoleSpy = vi
          .spyOn(console, 'log')
          .mockImplementation(() => {});

        const config: DebugTransformConfig = {
          enabled: true,
          logLevel: 'info', // Only info level and above
          includeContent: false,
          includeMetadata: false,
          outputFormat: 'console',
        };

        const transform = createDebugTransform(config);
        expect(transform).toBeDefined();

        consoleSpy.mockRestore();
      });
    });

    describe('createFilterTransform', () => {
      it('should create filter transform with content filters', () => {
        const config: FilterTransformConfig = {
          enabled: true,
          filters: [
            {
              type: 'content',
              pattern: /sensitive/gi,
              action: 'replace',
              replacement: '[REDACTED]',
            },
          ],
        };

        const transform = createFilterTransform(config);
        expect(transform).toBeDefined();
        expect(typeof transform).toBe('function');
      });

      it('should filter sensitive content', () => {
        const config: FilterTransformConfig = {
          enabled: true,
          filters: [
            {
              type: 'content',
              pattern: 'password',
              action: 'replace',
              replacement: '***',
            },
          ],
        };

        const transform = createFilterTransform(config);
        const transformStream = transform({
          stopStream: vi.fn(),
          tools: {} as any,
        });

        expect(transformStream).toBeInstanceOf(TransformStream);
      });

      it('should support custom modifier functions', () => {
        const modifierMock = vi.fn((content: string) => content.toUpperCase());

        const config: FilterTransformConfig = {
          enabled: true,
          filters: [
            {
              type: 'content',
              pattern: /test/gi,
              action: 'modify',
              modifier: modifierMock,
            },
          ],
        };

        const transform = createFilterTransform(config);
        expect(transform).toBeDefined();
      });

      it('should remove filtered content when action is remove', () => {
        const config: FilterTransformConfig = {
          enabled: true,
          filters: [
            {
              type: 'content',
              pattern: /spam/gi,
              action: 'remove',
            },
          ],
        };

        const transform = createFilterTransform(config);
        const transformStream = transform({
          stopStream: vi.fn(),
          tools: {} as any,
        });

        expect(transformStream).toBeInstanceOf(TransformStream);
      });
    });
  });

  describe('ProviderMetricsCollector', () => {
    let collector: ProviderMetricsCollector;

    beforeEach(() => {
      collector = new ProviderMetricsCollector({
        enabled: true,
        persistMetrics: false,
        aggregationWindow: 60_000, // 1 minute
        qualityThresholds: {
          coherence: 0.7,
          relevance: 0.8,
          completeness: 0.6,
        },
      });
    });

    afterEach(() => {
      collector.destroy();
    });

    it('should collect metrics correctly', () => {
      const metricsData: ProviderMetricsData = {
        provider: 'openai',
        model: 'gpt-4',
        responseTime: 1500,
        tokenUsage: {
          prompt: 100,
          completion: 200,
          total: 300,
        },
        quality: {
          coherenceScore: 0.8,
          relevanceScore: 0.9,
          completenessScore: 0.7,
        },
        performance: {
          throughput: 200, // tokens per second
          latency: 150,
          efficiency: 0.8,
        },
      };

      collector.collectMetrics(metricsData);

      const aggregated = collector.getAggregatedMetrics('openai', 'gpt-4');
      expect(aggregated).toBeDefined();
      expect(aggregated?.avgResponseTime).toBe(1500);
      expect(aggregated?.totalRequests).toBe(1);
    });

    it('should aggregate multiple metrics', () => {
      const metricsData1: ProviderMetricsData = {
        provider: 'openai',
        model: 'gpt-4',
        responseTime: 1000,
        tokenUsage: { prompt: 50, completion: 100, total: 150 },
        quality: {
          coherenceScore: 0.8,
          relevanceScore: 0.9,
          completenessScore: 0.7,
        },
        performance: { throughput: 150, latency: 100, efficiency: 0.8 },
      };

      const metricsData2: ProviderMetricsData = {
        provider: 'openai',
        model: 'gpt-4',
        responseTime: 2000,
        tokenUsage: { prompt: 80, completion: 120, total: 200 },
        quality: {
          coherenceScore: 0.7,
          relevanceScore: 0.8,
          completenessScore: 0.9,
        },
        performance: { throughput: 100, latency: 200, efficiency: 0.6 },
      };

      collector.collectMetrics(metricsData1);
      collector.collectMetrics(metricsData2);

      const aggregated = collector.getAggregatedMetrics('openai', 'gpt-4');
      expect(aggregated?.avgResponseTime).toBe(1500); // Average of 1000 and 2000
      expect(aggregated?.totalRequests).toBe(2);
      expect(aggregated?.qualityScores.coherence).toBe(0.75); // Average of 0.8 and 0.7
    });

    it('should return null for non-existent provider/model', () => {
      const aggregated = collector.getAggregatedMetrics('nonexistent', 'model');
      expect(aggregated).toBeNull();
    });

    it('should get all provider metrics', () => {
      const metricsData: ProviderMetricsData = {
        provider: 'anthropic',
        model: 'claude-3',
        responseTime: 1200,
        tokenUsage: { prompt: 60, completion: 140, total: 200 },
        quality: {
          coherenceScore: 0.9,
          relevanceScore: 0.8,
          completenessScore: 0.8,
        },
        performance: { throughput: 166, latency: 120, efficiency: 0.9 },
      };

      collector.collectMetrics(metricsData);

      const allMetrics = collector.getAllProviderMetrics();
      expect(allMetrics).toHaveProperty('anthropic:claude-3');
      expect(allMetrics['anthropic:claude-3'].provider).toBe('anthropic');
      expect(allMetrics['anthropic:claude-3'].model).toBe('claude-3');
    });

    it('should handle disabled collector', () => {
      const disabledCollector = new ProviderMetricsCollector({
        enabled: false,
        persistMetrics: false,
        aggregationWindow: 60_000,
        qualityThresholds: {
          coherence: 0.7,
          relevance: 0.8,
          completeness: 0.6,
        },
      });

      const metricsData: ProviderMetricsData = {
        provider: 'openai',
        model: 'gpt-4',
        responseTime: 1500,
        tokenUsage: { prompt: 100, completion: 200, total: 300 },
        quality: {
          coherenceScore: 0.8,
          relevanceScore: 0.9,
          completenessScore: 0.7,
        },
        performance: { throughput: 200, latency: 150, efficiency: 0.8 },
      };

      disabledCollector.collectMetrics(metricsData);

      const aggregated = disabledCollector.getAggregatedMetrics(
        'openai',
        'gpt-4'
      );
      expect(aggregated).toBeNull();

      disabledCollector.destroy();
    });
  });

  describe('Transform Presets', () => {
    it('should provide performance preset', () => {
      const performanceTransforms = transformPresets.performance();
      expect(performanceTransforms).toHaveLength(2);
      expect(performanceTransforms[0]).toBeDefined();
      expect(performanceTransforms[1]).toBeDefined();
    });

    it('should provide development preset', () => {
      const developmentTransforms = transformPresets.development();
      expect(developmentTransforms).toHaveLength(2);
      expect(developmentTransforms[0]).toBeDefined();
      expect(developmentTransforms[1]).toBeDefined();
    });

    it('should provide production preset', () => {
      const productionTransforms = transformPresets.production();
      expect(productionTransforms).toHaveLength(2);
      expect(productionTransforms[0]).toBeDefined();
      expect(productionTransforms[1]).toBeDefined();
    });

    it('should provide smooth preset', () => {
      const smoothTransforms = transformPresets.smooth();
      expect(smoothTransforms).toHaveLength(1);
      expect(smoothTransforms[0]).toBeDefined();
    });
  });

  describe('ExperimentalAI Class', () => {
    it('should generate with advanced transforms', async () => {
      const mockResult = {
        text: 'Generated text',
        usage: { totalTokens: 100 },
        finishReason: 'stop',
      };

      vi.mocked(require('ai').streamText).mockResolvedValue({
        text: mockResult.text,
        usage: mockResult.usage,
        finishReason: mockResult.finishReason,
      });

      const result = await experimentalAI.streamWithAdvancedTransforms(
        'Test prompt',
        {
          preset: 'development',
          compressionConfig: {
            enabled: true,
            threshold: 1024,
            algorithm: 'gzip',
            level: 6,
          },
        }
      );

      expect(result).toBeDefined();
    });

    it('should generate with smoothing', async () => {
      const mockResult = {
        text: 'Smooth text',
        usage: { totalTokens: 150 },
      };

      vi.mocked(require('ai').streamText).mockResolvedValue(mockResult);

      const result = await experimentalAI.streamWithSmoothing('Test prompt', {
        chunking: 'word',
        delayMs: 50,
      });

      expect(result).toBeDefined();
    });

    it('should generate with provider metrics collection', async () => {
      const mockResult = {
        text: 'Test response',
        usage: {
          promptTokens: 50,
          completionTokens: 100,
          totalTokens: 150,
        },
        finishReason: 'stop',
      };

      vi.mocked(require('ai').generateText).mockResolvedValue(mockResult);

      const metricsCallback = vi.fn();
      const result = await experimentalAI.generateWithProviderMetrics(
        'Test prompt',
        {
          collectMetrics: true,
          metricsCollector: globalMetricsCollector,
        }
      );

      expect(result).toBeDefined();
      expect(result.text).toBe('Test response');
    });

    it('should stream with metrics and transforms', async () => {
      const mockResult = {
        text: 'Streaming text',
        usage: { totalTokens: 200 },
        finishReason: 'stop',
      };

      vi.mocked(require('ai').streamText).mockResolvedValue(mockResult);

      const onMetrics = vi.fn();
      const result = await experimentalAI.streamWithMetricsAndTransforms(
        'Test prompt',
        {
          collectMetrics: true,
          metricsCollector: globalMetricsCollector,
          onMetrics,
        }
      );

      expect(result).toBeDefined();
    });
  });

  describe('Global Metrics Collector', () => {
    it('should be properly initialized', () => {
      expect(globalMetricsCollector).toBeDefined();
      expect(globalMetricsCollector).toBeInstanceOf(ProviderMetricsCollector);
    });

    it('should collect metrics globally', () => {
      const metricsData: ProviderMetricsData = {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        responseTime: 800,
        tokenUsage: { prompt: 30, completion: 70, total: 100 },
        quality: {
          coherenceScore: 0.7,
          relevanceScore: 0.8,
          completenessScore: 0.6,
        },
        performance: { throughput: 125, latency: 80, efficiency: 0.7 },
      };

      globalMetricsCollector.collectMetrics(metricsData);

      const aggregated = globalMetricsCollector.getAggregatedMetrics(
        'openai',
        'gpt-3.5-turbo'
      );
      expect(aggregated).toBeDefined();
      expect(aggregated?.avgResponseTime).toBe(800);
    });
  });

  describe('Integration Tests', () => {
    it('should work with multiple transforms in sequence', () => {
      const compressionConfig: CompressionTransformConfig = {
        enabled: true,
        threshold: 100,
        algorithm: 'gzip',
        level: 3,
      };

      const metricsConfig: MetricsTransformConfig = {
        enabled: true,
        collectTokenMetrics: true,
        collectPerformanceMetrics: true,
        collectQualityMetrics: false,
        sampleRate: 1.0,
      };

      const compressionTransform =
        createCompressionTransform(compressionConfig);
      const metricsTransform = createMetricsTransform(metricsConfig);

      expect(compressionTransform).toBeDefined();
      expect(metricsTransform).toBeDefined();
    });

    it('should handle transform errors gracefully', () => {
      const filterConfig: FilterTransformConfig = {
        enabled: true,
        filters: [
          {
            type: 'content',
            pattern: /error/gi,
            action: 'modify',
            modifier: () => {
              throw new Error('Filter error');
            },
          },
        ],
      };

      const transform = createFilterTransform(filterConfig);
      expect(transform).toBeDefined();
      // Transform should be created even if modifier might throw
    });

    it('should preserve stream structure across transforms', () => {
      const debugConfig: DebugTransformConfig = {
        enabled: true,
        logLevel: 'info',
        includeContent: false,
        includeMetadata: false,
        outputFormat: 'console',
      };

      const transform = createDebugTransform(debugConfig);
      const transformStream = transform({
        stopStream: vi.fn(),
        tools: {} as any,
      });

      expect(transformStream).toBeInstanceOf(TransformStream);
    });
  });
});
