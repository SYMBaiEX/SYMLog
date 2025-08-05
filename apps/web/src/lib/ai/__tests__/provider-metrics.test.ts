import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  globalMetricsCollector,
  ProviderMetricsCollector,
  type ProviderMetricsCollectorConfig,
  type ProviderMetricsData,
} from '../experimental';

describe('Provider Metrics System', () => {
  let collector: ProviderMetricsCollector;
  let mockConfig: ProviderMetricsCollectorConfig;

  beforeEach(() => {
    mockConfig = {
      enabled: true,
      persistMetrics: false,
      aggregationWindow: 60_000, // 1 minute
      qualityThresholds: {
        coherence: 0.7,
        relevance: 0.8,
        completeness: 0.6,
      },
    };
    collector = new ProviderMetricsCollector(mockConfig);
  });

  afterEach(() => {
    collector.destroy();
  });

  describe('ProviderMetricsCollector', () => {
    describe('Configuration', () => {
      it('should initialize with correct configuration', () => {
        expect(collector).toBeDefined();
        expect(collector).toBeInstanceOf(ProviderMetricsCollector);
      });

      it('should handle disabled configuration', () => {
        const disabledConfig: ProviderMetricsCollectorConfig = {
          ...mockConfig,
          enabled: false,
        };

        const disabledCollector = new ProviderMetricsCollector(disabledConfig);

        const metricsData: ProviderMetricsData = {
          provider: 'openai',
          model: 'gpt-4',
          responseTime: 1000,
          tokenUsage: { prompt: 100, completion: 200, total: 300 },
          quality: {
            coherenceScore: 0.8,
            relevanceScore: 0.9,
            completenessScore: 0.7,
          },
          performance: { throughput: 300, latency: 100, efficiency: 0.8 },
        };

        disabledCollector.collectMetrics(metricsData);

        const result = disabledCollector.getAggregatedMetrics(
          'openai',
          'gpt-4'
        );
        expect(result).toBeNull();

        disabledCollector.destroy();
      });

      it('should start aggregation when window is configured', () => {
        const configWithAggregation: ProviderMetricsCollectorConfig = {
          ...mockConfig,
          persistMetrics: true,
          aggregationWindow: 1000, // 1 second for testing
        };

        const collectorWithAggregation = new ProviderMetricsCollector(
          configWithAggregation
        );
        expect(collectorWithAggregation).toBeDefined();

        collectorWithAggregation.destroy();
      });
    });

    describe('Metrics Collection', () => {
      it('should collect single metric', () => {
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
            throughput: 200,
            latency: 150,
            efficiency: 0.8,
          },
        };

        collector.collectMetrics(metricsData);

        const aggregated = collector.getAggregatedMetrics('openai', 'gpt-4');
        expect(aggregated).toBeDefined();
        expect(aggregated?.avgResponseTime).toBe(1500);
        expect(aggregated?.avgThroughput).toBe(200);
        expect(aggregated?.avgLatency).toBe(150);
        expect(aggregated?.totalRequests).toBe(1);
        expect(aggregated?.qualityScores.coherence).toBe(0.8);
        expect(aggregated?.qualityScores.relevance).toBe(0.9);
        expect(aggregated?.qualityScores.completeness).toBe(0.7);
      });

      it('should collect multiple metrics for same provider/model', () => {
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
            coherenceScore: 0.6,
            relevanceScore: 0.7,
            completenessScore: 0.9,
          },
          performance: { throughput: 100, latency: 200, efficiency: 0.6 },
        };

        collector.collectMetrics(metricsData1);
        collector.collectMetrics(metricsData2);

        const aggregated = collector.getAggregatedMetrics('openai', 'gpt-4');
        expect(aggregated).toBeDefined();
        expect(aggregated?.avgResponseTime).toBe(1500); // (1000 + 2000) / 2
        expect(aggregated?.avgThroughput).toBe(125); // (150 + 100) / 2
        expect(aggregated?.avgLatency).toBe(150); // (100 + 200) / 2
        expect(aggregated?.totalRequests).toBe(2);
        expect(aggregated?.qualityScores.coherence).toBe(0.7); // (0.8 + 0.6) / 2
        expect(aggregated?.qualityScores.relevance).toBe(0.8); // (0.9 + 0.7) / 2
        expect(aggregated?.qualityScores.completeness).toBe(0.8); // (0.7 + 0.9) / 2
      });

      it('should collect metrics for different providers/models', () => {
        const openaiMetrics: ProviderMetricsData = {
          provider: 'openai',
          model: 'gpt-4',
          responseTime: 1000,
          tokenUsage: { prompt: 100, completion: 200, total: 300 },
          quality: {
            coherenceScore: 0.8,
            relevanceScore: 0.9,
            completenessScore: 0.7,
          },
          performance: { throughput: 300, latency: 100, efficiency: 0.8 },
        };

        const anthropicMetrics: ProviderMetricsData = {
          provider: 'anthropic',
          model: 'claude-3',
          responseTime: 1200,
          tokenUsage: { prompt: 120, completion: 180, total: 300 },
          quality: {
            coherenceScore: 0.9,
            relevanceScore: 0.8,
            completenessScore: 0.8,
          },
          performance: { throughput: 250, latency: 120, efficiency: 0.9 },
        };

        collector.collectMetrics(openaiMetrics);
        collector.collectMetrics(anthropicMetrics);

        const openaiAggregated = collector.getAggregatedMetrics(
          'openai',
          'gpt-4'
        );
        const anthropicAggregated = collector.getAggregatedMetrics(
          'anthropic',
          'claude-3'
        );

        expect(openaiAggregated?.avgResponseTime).toBe(1000);
        expect(anthropicAggregated?.avgResponseTime).toBe(1200);
        expect(openaiAggregated?.totalRequests).toBe(1);
        expect(anthropicAggregated?.totalRequests).toBe(1);
      });

      it('should handle metrics with safety information', () => {
        const metricsWithSafety: ProviderMetricsData = {
          provider: 'google',
          model: 'gemini-pro',
          responseTime: 1100,
          tokenUsage: { prompt: 80, completion: 160, total: 240 },
          quality: {
            coherenceScore: 0.7,
            relevanceScore: 0.8,
            completenessScore: 0.6,
          },
          performance: { throughput: 218, latency: 110, efficiency: 0.7 },
          safety: {
            ratings: {
              harassment: 0.1,
              hateSpeech: 0.05,
              sexuallyExplicit: 0.02,
              dangerousContent: 0.03,
            },
            blocked: false,
          },
        };

        collector.collectMetrics(metricsWithSafety);

        const aggregated = collector.getAggregatedMetrics(
          'google',
          'gemini-pro'
        );
        expect(aggregated).toBeDefined();
        expect(aggregated?.avgResponseTime).toBe(1100);
        expect(aggregated?.totalRequests).toBe(1);
      });
    });

    describe('Aggregation', () => {
      it('should return null for non-existent provider/model', () => {
        const result = collector.getAggregatedMetrics('nonexistent', 'model');
        expect(result).toBeNull();
      });

      it('should return correct aggregated data structure', () => {
        const metricsData: ProviderMetricsData = {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          responseTime: 800,
          tokenUsage: { prompt: 60, completion: 140, total: 200 },
          quality: {
            coherenceScore: 0.7,
            relevanceScore: 0.8,
            completenessScore: 0.6,
          },
          performance: { throughput: 250, latency: 80, efficiency: 0.7 },
        };

        collector.collectMetrics(metricsData);

        const aggregated = collector.getAggregatedMetrics(
          'openai',
          'gpt-3.5-turbo'
        );

        expect(aggregated).toMatchObject({
          avgResponseTime: 800,
          avgThroughput: 250,
          avgLatency: 80,
          qualityScores: {
            coherence: 0.7,
            relevance: 0.8,
            completeness: 0.6,
          },
          totalRequests: 1,
        });
      });

      it('should get all provider metrics', () => {
        const metrics1: ProviderMetricsData = {
          provider: 'openai',
          model: 'gpt-4',
          responseTime: 1000,
          tokenUsage: { prompt: 100, completion: 200, total: 300 },
          quality: {
            coherenceScore: 0.8,
            relevanceScore: 0.9,
            completenessScore: 0.7,
          },
          performance: { throughput: 300, latency: 100, efficiency: 0.8 },
        };

        const metrics2: ProviderMetricsData = {
          provider: 'anthropic',
          model: 'claude-3',
          responseTime: 1200,
          tokenUsage: { prompt: 120, completion: 180, total: 300 },
          quality: {
            coherenceScore: 0.9,
            relevanceScore: 0.8,
            completenessScore: 0.8,
          },
          performance: { throughput: 250, latency: 120, efficiency: 0.9 },
        };

        collector.collectMetrics(metrics1);
        collector.collectMetrics(metrics2);

        const allMetrics = collector.getAllProviderMetrics();

        expect(allMetrics).toHaveProperty('openai:gpt-4');
        expect(allMetrics).toHaveProperty('anthropic:claude-3');

        expect(allMetrics['openai:gpt-4']).toMatchObject({
          provider: 'openai',
          model: 'gpt-4',
          avgResponseTime: 1000,
          totalRequests: 1,
        });

        expect(allMetrics['anthropic:claude-3']).toMatchObject({
          provider: 'anthropic',
          model: 'claude-3',
          avgResponseTime: 1200,
          totalRequests: 1,
        });
      });

      it('should handle empty metrics collection', () => {
        const allMetrics = collector.getAllProviderMetrics();
        expect(allMetrics).toEqual({});
      });
    });

    describe('Windowing and Cleanup', () => {
      it('should clean up old metrics outside aggregation window', () => {
        // Create collector with very short window for testing
        const shortWindowCollector = new ProviderMetricsCollector({
          ...mockConfig,
          aggregationWindow: 100, // 100ms
        });

        const metricsData: ProviderMetricsData = {
          provider: 'openai',
          model: 'gpt-4',
          responseTime: Date.now() - 200, // Old timestamp
          tokenUsage: { prompt: 100, completion: 200, total: 300 },
          quality: {
            coherenceScore: 0.8,
            relevanceScore: 0.9,
            completenessScore: 0.7,
          },
          performance: { throughput: 300, latency: 100, efficiency: 0.8 },
        };

        shortWindowCollector.collectMetrics(metricsData);

        // Wait for cleanup (would happen on next collectMetrics call)
        const newMetrics: ProviderMetricsData = {
          ...metricsData,
          responseTime: Date.now(), // Current timestamp
        };

        shortWindowCollector.collectMetrics(newMetrics);

        const aggregated = shortWindowCollector.getAggregatedMetrics(
          'openai',
          'gpt-4'
        );
        // Should only have the recent metric
        expect(aggregated?.totalRequests).toBe(1);

        shortWindowCollector.destroy();
      });
    });

    describe('Aggregation Timer', () => {
      it('should handle aggregation with persistence enabled', (done) => {
        const consoleSpy = vi
          .spyOn(console, 'log')
          .mockImplementation(() => {});

        const persistentCollector = new ProviderMetricsCollector({
          ...mockConfig,
          persistMetrics: true,
          aggregationWindow: 100, // 100ms for quick testing
        });

        const metricsData: ProviderMetricsData = {
          provider: 'openai',
          model: 'gpt-4',
          responseTime: 1000,
          tokenUsage: { prompt: 100, completion: 200, total: 300 },
          quality: {
            coherenceScore: 0.8,
            relevanceScore: 0.9,
            completenessScore: 0.7,
          },
          performance: { throughput: 300, latency: 100, efficiency: 0.8 },
        };

        persistentCollector.collectMetrics(metricsData);

        // Wait for aggregation to run
        setTimeout(() => {
          expect(consoleSpy).toHaveBeenCalledWith(
            '[MetricsCollector] Aggregated metrics:',
            expect.any(Object)
          );

          consoleSpy.mockRestore();
          persistentCollector.destroy();
          done();
        }, 150);
      });
    });
  });

  describe('Global Metrics Collector', () => {
    it('should be initialized and available', () => {
      expect(globalMetricsCollector).toBeDefined();
      expect(globalMetricsCollector).toBeInstanceOf(ProviderMetricsCollector);
    });

    it('should collect metrics in global instance', () => {
      const metricsData: ProviderMetricsData = {
        provider: 'openai',
        model: 'gpt-4-turbo',
        responseTime: 900,
        tokenUsage: { prompt: 80, completion: 160, total: 240 },
        quality: {
          coherenceScore: 0.85,
          relevanceScore: 0.9,
          completenessScore: 0.8,
        },
        performance: { throughput: 267, latency: 90, efficiency: 0.85 },
      };

      globalMetricsCollector.collectMetrics(metricsData);

      const aggregated = globalMetricsCollector.getAggregatedMetrics(
        'openai',
        'gpt-4-turbo'
      );
      expect(aggregated).toBeDefined();
      expect(aggregated?.avgResponseTime).toBe(900);
      expect(aggregated?.totalRequests).toBe(1);
    });

    it('should accumulate metrics across different calls', () => {
      const provider = 'test-provider';
      const model = 'test-model';

      const metricsData1: ProviderMetricsData = {
        provider,
        model,
        responseTime: 1000,
        tokenUsage: { prompt: 50, completion: 100, total: 150 },
        quality: {
          coherenceScore: 0.7,
          relevanceScore: 0.8,
          completenessScore: 0.6,
        },
        performance: { throughput: 150, latency: 100, efficiency: 0.7 },
      };

      const metricsData2: ProviderMetricsData = {
        provider,
        model,
        responseTime: 1500,
        tokenUsage: { prompt: 70, completion: 130, total: 200 },
        quality: {
          coherenceScore: 0.9,
          relevanceScore: 0.85,
          completenessScore: 0.8,
        },
        performance: { throughput: 133, latency: 150, efficiency: 0.9 },
      };

      globalMetricsCollector.collectMetrics(metricsData1);
      globalMetricsCollector.collectMetrics(metricsData2);

      const aggregated = globalMetricsCollector.getAggregatedMetrics(
        provider,
        model
      );
      expect(aggregated?.totalRequests).toBe(2);
      expect(aggregated?.avgResponseTime).toBe(1250); // (1000 + 1500) / 2
      expect(aggregated?.qualityScores.coherence).toBe(0.8); // (0.7 + 0.9) / 2
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed metrics data gracefully', () => {
      const incompleteMetrics = {
        provider: 'openai',
        model: 'gpt-4',
        responseTime: 1000,
        // Missing required fields
      } as any;

      expect(() => {
        collector.collectMetrics(incompleteMetrics);
      }).not.toThrow();
    });

    it('should handle null/undefined quality scores', () => {
      const metricsWithNullQuality: ProviderMetricsData = {
        provider: 'openai',
        model: 'gpt-4',
        responseTime: 1000,
        tokenUsage: { prompt: 100, completion: 200, total: 300 },
        quality: {
          coherenceScore: Number.NaN,
          relevanceScore: 0.8,
          completenessScore: undefined as any,
        },
        performance: { throughput: 300, latency: 100, efficiency: 0.8 },
      };

      expect(() => {
        collector.collectMetrics(metricsWithNullQuality);
      }).not.toThrow();

      const aggregated = collector.getAggregatedMetrics('openai', 'gpt-4');
      expect(aggregated).toBeDefined();
    });

    it('should handle destroy called multiple times', () => {
      expect(() => {
        collector.destroy();
        collector.destroy();
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle large numbers of metrics efficiently', () => {
      const startTime = Date.now();

      // Add 1000 metrics
      for (let i = 0; i < 1000; i++) {
        const metricsData: ProviderMetricsData = {
          provider: 'openai',
          model: 'gpt-4',
          responseTime: 1000 + Math.random() * 500,
          tokenUsage: {
            prompt: 50 + Math.floor(Math.random() * 50),
            completion: 100 + Math.floor(Math.random() * 100),
            total: 150 + Math.floor(Math.random() * 150),
          },
          quality: {
            coherenceScore: Math.random(),
            relevanceScore: Math.random(),
            completenessScore: Math.random(),
          },
          performance: {
            throughput: 100 + Math.random() * 200,
            latency: 50 + Math.random() * 100,
            efficiency: Math.random(),
          },
        };
        collector.collectMetrics(metricsData);
      }

      const aggregated = collector.getAggregatedMetrics('openai', 'gpt-4');
      const endTime = Date.now();

      expect(aggregated?.totalRequests).toBe(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
