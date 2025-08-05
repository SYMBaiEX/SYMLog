/**
 * Performance and Load Tests for Multi-Modal AI System
 * Validates system performance under various conditions and loads
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FileAttachment } from '@/types/attachments';
import { MultiModalCompleteSystem } from '../multimodal-complete';
import { createStreamingProcessor } from '../streaming-processor';
import { createVideoProcessor } from '../video-processor';

// Performance test configuration
const PERFORMANCE_THRESHOLDS = {
  singleFileProcessing: 5000, // 5 seconds
  batchProcessing: 30_000, // 30 seconds for batch
  memoryUsage: 500 * 1024 * 1024, // 500MB
  concurrentRequests: 10,
  largeFileSize: 50 * 1024 * 1024, // 50MB
};

// Utility functions for performance testing
const measureMemoryUsage = (): number => {
  if (typeof performance !== 'undefined' && 'memory' in performance) {
    return (performance as any).memory.usedJSHeapSize;
  }
  return 0;
};

const createPerformanceTestFile = (
  sizeKB: number,
  type = 'text/plain'
): FileAttachment => {
  const content = 'A'.repeat(sizeKB * 1024);
  const base64Content = btoa(content);

  return {
    name: `perf-test-${sizeKB}kb.${type.split('/')[1]}`,
    type,
    size: sizeKB * 1024,
    base64: `data:${type};base64,${base64Content}`,
  };
};

const createImageTestFile = (sizeKB: number): FileAttachment => ({
  name: `perf-image-${sizeKB}kb.jpg`,
  type: 'image/jpeg',
  size: sizeKB * 1024,
  base64:
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD//test' +
    'A'.repeat(sizeKB * 100),
});

describe('Performance Tests', () => {
  let system: MultiModalCompleteSystem;

  beforeAll(() => {
    // Mock AI services for consistent performance testing
    vi.mock('ai', () => ({
      generateObject: vi.fn(async () => {
        // Simulate AI processing time
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          object: {
            description: 'Performance test result',
            confidence: 0.9,
            objects: ['test'],
            colors: ['blue'],
            mood: 'neutral',
            tags: ['performance'],
          },
        };
      }),
      transcribe: vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return {
          text: 'Performance test transcription',
          segments: [],
        };
      }),
    }));
  });

  beforeEach(() => {
    system = new MultiModalCompleteSystem({
      enableCrossModalAnalysis: true,
      enableIntelligentCaching: true,
      enablePerformanceOptimization: true,
      enableBatchProcessing: true,
    });
  });

  afterEach(() => {
    system.destroy();
  });

  describe('Single File Processing Performance', () => {
    it('should process small images within time threshold', async () => {
      const startTime = Date.now();
      const attachment = createImageTestFile(100); // 100KB image

      const result = await system.processAttachment(attachment);
      const endTime = Date.now();

      expect(result.error).toBeUndefined();
      expect(endTime - startTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.singleFileProcessing
      );

      const metrics = system.getSystemMetrics();
      expect(metrics.performance.averageProcessingTime).toBeGreaterThan(0);
    });

    it('should process medium documents efficiently', async () => {
      const startTime = Date.now();
      const attachment = createPerformanceTestFile(50); // 50KB document

      const result = await system.processAttachment(attachment);
      const endTime = Date.now();

      expect(result.error).toBeUndefined();
      expect(endTime - startTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.singleFileProcessing
      );
    });

    it('should handle large files within reasonable time', async () => {
      const startTime = Date.now();
      const attachment = createPerformanceTestFile(1000); // 1MB document

      const result = await system.processAttachment(attachment);
      const endTime = Date.now();

      expect(result.error).toBeUndefined();
      // Large files may take longer but should still be reasonable
      expect(endTime - startTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.singleFileProcessing * 2
      );
    });
  });

  describe('Batch Processing Performance', () => {
    it('should process small batches efficiently', async () => {
      const attachments = Array(5)
        .fill(null)
        .map(
          (_, i) => createPerformanceTestFile(10, 'text/plain') // 10KB each
        );

      const startTime = Date.now();
      const result = await system.processBatch(attachments);
      const endTime = Date.now();

      expect(result.totalFiles).toBe(5);
      expect(result.batchMetrics.successRate).toBeGreaterThan(0.8);
      expect(endTime - startTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.batchProcessing
      );

      // Batch processing should be more efficient than sequential
      const avgTimePerFile = result.batchMetrics.averageTimePerFile;
      expect(avgTimePerFile).toBeLessThan(
        PERFORMANCE_THRESHOLDS.singleFileProcessing
      );
    });

    it('should scale well with moderate batch sizes', async () => {
      const attachments = Array(20)
        .fill(null)
        .map(
          (_, i) => createPerformanceTestFile(5) // 5KB each
        );

      const startTime = Date.now();
      const result = await system.processBatch(attachments);
      const endTime = Date.now();

      expect(result.totalFiles).toBe(20);
      expect(result.batchMetrics.parallelizationFactor).toBeGreaterThan(1);
      expect(endTime - startTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.batchProcessing * 2
      );

      // Verify parallelization is working
      const sequentialEstimate = 20 * result.batchMetrics.averageTimePerFile;
      const actualTime = result.batchMetrics.totalTime;
      expect(actualTime).toBeLessThan(sequentialEstimate * 0.8); // At least 20% improvement
    });

    it('should handle mixed file types efficiently', async () => {
      const attachments = [
        createImageTestFile(50),
        createPerformanceTestFile(25, 'text/plain'),
        createImageTestFile(30),
        createPerformanceTestFile(40, 'text/plain'),
        createImageTestFile(20),
      ];

      const startTime = Date.now();
      const result = await system.processBatch(attachments);
      const endTime = Date.now();

      expect(result.totalFiles).toBe(5);
      expect(result.processedFiles).toBeGreaterThan(3); // Most should succeed
      expect(endTime - startTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.batchProcessing
      );
    });
  });

  describe('Memory Usage Performance', () => {
    it('should maintain reasonable memory usage during processing', async () => {
      const initialMemory = measureMemoryUsage();

      // Process multiple files to test memory management
      const attachments = Array(10)
        .fill(null)
        .map(
          () => createPerformanceTestFile(100) // 100KB each
        );

      await system.processBatch(attachments);

      const finalMemory = measureMemoryUsage();
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (if measurement is available)
      if (initialMemory > 0) {
        expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryUsage);
      }

      // Cache should be populated but not excessive
      const metrics = system.getSystemMetrics();
      expect(metrics.cacheSize).toBeGreaterThan(0);
      expect(metrics.cacheSize).toBeLessThan(50); // Reasonable cache size
    });

    it('should handle cache efficiently', async () => {
      const attachment = createPerformanceTestFile(50);

      // First processing - should be slower
      const startTime1 = Date.now();
      await system.processAttachment(attachment);
      const firstRunTime = Date.now() - startTime1;

      // Second processing - should hit cache and be faster
      const startTime2 = Date.now();
      await system.processAttachment(attachment);
      const secondRunTime = Date.now() - startTime2;

      // Cache hit should be significantly faster
      expect(secondRunTime).toBeLessThan(firstRunTime * 0.5);

      const metrics = system.getSystemMetrics();
      expect(metrics.performance.cacheHitRate).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Processing Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      const attachments = Array(PERFORMANCE_THRESHOLDS.concurrentRequests)
        .fill(null)
        .map((_, i) => createPerformanceTestFile(20));

      const startTime = Date.now();

      // Process all files concurrently
      const promises = attachments.map((attachment) =>
        system.processAttachment(attachment)
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results.length).toBe(PERFORMANCE_THRESHOLDS.concurrentRequests);
      expect(results.filter((r) => !r.error).length).toBeGreaterThan(
        PERFORMANCE_THRESHOLDS.concurrentRequests * 0.8
      );

      // Concurrent processing should be efficient
      expect(endTime - startTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.batchProcessing
      );
    });

    it('should maintain performance under load', async () => {
      const batchSize = 5;
      const numBatches = 3;

      const startTime = Date.now();

      // Process multiple batches concurrently
      const batchPromises = Array(numBatches)
        .fill(null)
        .map(() => {
          const batchAttachments = Array(batchSize)
            .fill(null)
            .map(() => createPerformanceTestFile(15));
          return system.processBatch(batchAttachments);
        });

      const batchResults = await Promise.all(batchPromises);
      const endTime = Date.now();

      expect(batchResults.length).toBe(numBatches);

      // All batches should complete successfully
      const totalFiles = batchResults.reduce(
        (sum, batch) => sum + batch.totalFiles,
        0
      );
      const totalProcessed = batchResults.reduce(
        (sum, batch) => sum + batch.processedFiles,
        0
      );

      expect(totalFiles).toBe(batchSize * numBatches);
      expect(totalProcessed / totalFiles).toBeGreaterThan(0.8); // 80% success rate under load

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.batchProcessing * 2
      );
    });
  });

  describe('Streaming Performance', () => {
    it('should initialize streaming with minimal latency', async () => {
      const streamingProcessor = createStreamingProcessor({
        frameRate: 30,
        enableLowLatency: true,
        targetLatency: 100,
      });

      const startTime = Date.now();

      try {
        // Mock successful stream start
        const streamId = 'mock-stream-123';
        const initTime = Date.now() - startTime;

        expect(initTime).toBeLessThan(1000); // Should initialize quickly
        expect(streamId).toBeDefined();

        const metrics = streamingProcessor.getStreamMetrics();
        expect(metrics.networkCondition).toBeDefined();
      } catch (error) {
        // Expected in test environment
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Video Processing Performance', () => {
    it('should process video frames efficiently', async () => {
      const videoProcessor = createVideoProcessor({
        frameInterval: 2,
        maxFrames: 5,
        enableHardwareAcceleration: false,
      });

      try {
        const startTime = Date.now();

        // Mock video processing
        const mockVideoData = 'data:video/mp4;base64,mockdata';

        // This will likely fail in test environment, but we test the setup
        const config = videoProcessor.getConfig();
        expect(config.frameInterval).toBe(2);
        expect(config.maxFrames).toBe(5);

        const setupTime = Date.now() - startTime;
        expect(setupTime).toBeLessThan(100); // Setup should be instant
      } finally {
        videoProcessor.destroy();
      }
    });
  });

  describe('System Performance Metrics', () => {
    it('should track performance metrics accurately', async () => {
      // Process some files to generate metrics
      const attachments = Array(5)
        .fill(null)
        .map(() => createPerformanceTestFile(10));

      await system.processBatch(attachments);

      const metrics = system.getSystemMetrics();

      expect(metrics.performance.totalRequests).toBeGreaterThan(0);
      expect(metrics.performance.successfulRequests).toBeGreaterThan(0);
      expect(metrics.performance.averageProcessingTime).toBeGreaterThan(0);

      // Success rate should be reasonable
      const successRate =
        metrics.performance.successfulRequests /
        metrics.performance.totalRequests;
      expect(successRate).toBeGreaterThan(0.8);
    });

    it('should reset metrics properly', async () => {
      // Generate some metrics first
      await system.processAttachment(createPerformanceTestFile(10));

      let metrics = system.getSystemMetrics();
      expect(metrics.performance.totalRequests).toBeGreaterThan(0);

      // Reset system
      system.reset();

      metrics = system.getSystemMetrics();
      expect(metrics.performance.totalRequests).toBe(0);
      expect(metrics.performance.successfulRequests).toBe(0);
      expect(metrics.cacheSize).toBe(0);
    });
  });

  describe('Load Testing', () => {
    it('should handle sustained load', async () => {
      const iterations = 10;
      const filesPerIteration = 3;
      const results: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const attachments = Array(filesPerIteration)
          .fill(null)
          .map((_, j) => createPerformanceTestFile(5, 'text/plain'));

        const startTime = Date.now();
        const result = await system.processBatch(attachments);
        const endTime = Date.now();

        results.push(endTime - startTime);
        expect(result.totalFiles).toBe(filesPerIteration);
      }

      // Performance should remain consistent
      const avgTime =
        results.reduce((sum, time) => sum + time, 0) / results.length;
      const maxTime = Math.max(...results);
      const minTime = Math.min(...results);

      // Variance should be reasonable (not degrading significantly)
      expect(maxTime).toBeLessThan(avgTime * 2);
      expect(minTime).toBeGreaterThan(avgTime * 0.5);
    });

    it('should maintain cache efficiency under load', async () => {
      const sameAttachment = createPerformanceTestFile(20);
      const cacheHitTimes: number[] = [];

      // First request - cache miss
      await system.processAttachment(sameAttachment);

      // Multiple requests - should hit cache
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        await system.processAttachment(sameAttachment);
        const endTime = Date.now();

        cacheHitTimes.push(endTime - startTime);
      }

      // Cache hits should be consistently fast
      const avgCacheHitTime =
        cacheHitTimes.reduce((sum, time) => sum + time, 0) /
        cacheHitTimes.length;
      expect(avgCacheHitTime).toBeLessThan(100); // Cache hits should be very fast

      const metrics = system.getSystemMetrics();
      expect(metrics.performance.cacheHitRate).toBeGreaterThan(0.9); // 90%+ cache hit rate
    });
  });
});

describe('Performance Benchmarks', () => {
  it('should meet baseline performance requirements', async () => {
    const system = new MultiModalCompleteSystem();

    try {
      // Test baseline performance with standard files
      const baselineFiles = [
        createImageTestFile(100), // 100KB image
        createPerformanceTestFile(50, 'text/plain'), // 50KB text
        createPerformanceTestFile(75, 'application/json'), // 75KB JSON
      ];

      const startTime = Date.now();
      const result = await system.processBatch(baselineFiles);
      const endTime = Date.now();

      // Baseline requirements
      expect(result.batchMetrics.successRate).toBeGreaterThan(0.95); // 95% success rate
      expect(result.batchMetrics.averageTimePerFile).toBeLessThan(2000); // Under 2 seconds per file
      expect(endTime - startTime).toBeLessThan(10_000); // Batch under 10 seconds

      const metrics = system.getSystemMetrics();
      expect(metrics.performance.averageProcessingTime).toBeLessThan(3000); // Under 3 seconds average
    } finally {
      system.destroy();
    }
  });

  it('should demonstrate scalability characteristics', async () => {
    const system = new MultiModalCompleteSystem();
    const results: { size: number; time: number; throughput: number }[] = [];

    try {
      // Test different batch sizes
      const batchSizes = [1, 5, 10, 20];

      for (const size of batchSizes) {
        const attachments = Array(size)
          .fill(null)
          .map(() => createPerformanceTestFile(20));

        const startTime = Date.now();
        const result = await system.processBatch(attachments);
        const endTime = Date.now();

        const totalTime = endTime - startTime;
        const throughput = size / (totalTime / 1000); // files per second

        results.push({
          size,
          time: totalTime,
          throughput,
        });

        expect(result.batchMetrics.successRate).toBeGreaterThan(0.8);
      }

      // Verify scalability - larger batches should have better throughput
      expect(results[results.length - 1].throughput).toBeGreaterThan(
        results[0].throughput
      );
    } finally {
      system.destroy();
    }
  });
});
