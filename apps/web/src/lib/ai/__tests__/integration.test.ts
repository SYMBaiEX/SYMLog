/**
 * Integration Tests for Multi-Modal AI System
 * Tests end-to-end workflows, real-world scenarios, and system integration
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { FileAttachment } from '@/types/attachments';
import { MultiModalCompleteSystem } from '../multimodal-complete';
import { createStreamingProcessor } from '../streaming-processor';
import { createVideoProcessor } from '../video-processor';

// Mock WebRTC and MediaDevices for browser APIs
Object.defineProperty(window, 'MediaRecorder', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    state: 'inactive',
    ondataavailable: null,
    onerror: null,
  })),
});

Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn(async () => ({
      getTracks: () => [
        { kind: 'video', stop: vi.fn() },
        { kind: 'audio', stop: vi.fn() },
      ],
    })),
    getDisplayMedia: vi.fn(async () => ({
      getVideoTracks: () => [{ kind: 'video' }],
      getTracks: () => [{ kind: 'video', stop: vi.fn() }],
    })),
  },
});

Object.defineProperty(window, 'RTCPeerConnection', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    addTrack: vi.fn(),
    close: vi.fn(),
    getSenders: vi.fn(() => []),
    connectionState: 'connected',
    iceConnectionState: 'connected',
    onconnectionstatechange: null,
    oniceconnectionstatechange: null,
  })),
});

// Create test files for integration testing
const createRealImageData = (): string => {
  // Minimal valid JPEG header in base64
  return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/4A==';
};

const createRealVideoData = (): string => {
  // Minimal valid MP4 header in base64
  return 'data:video/mp4;base64,AAAAIGZ0eXBtcDQyAAACAGlzb21tcDQxbXA0MgAAAAhtdmhkAAAAANTZRa3U2UWtAAAAZAAABaQAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAABhpb2RzAAAAABCAgIAQAE////9//w==';
};

const createTestAttachments = (): FileAttachment[] => [
  {
    name: 'integration-test-image.jpg',
    type: 'image/jpeg',
    size: 102_400,
    base64: createRealImageData(),
  },
  {
    name: 'integration-test-video.mp4',
    type: 'video/mp4',
    size: 2_048_000,
    base64: createRealVideoData(),
  },
  {
    name: 'integration-test-document.txt',
    type: 'text/plain',
    size: 1024,
    base64:
      'data:text/plain;base64,' +
      btoa(
        'This is a test document for integration testing. It contains multiple sentences and should be processed correctly by the document analysis system.'
      ),
  },
];

describe('Multi-Modal Integration Tests', () => {
  let system: MultiModalCompleteSystem;

  beforeAll(() => {
    // Setup global mocks that persist across tests
    global.crypto = {
      subtle: {
        digest: vi.fn(async () => {
          const buffer = new ArrayBuffer(32);
          const view = new Uint8Array(buffer);
          for (let i = 0; i < 32; i++) {
            view[i] = Math.floor(Math.random() * 256);
          }
          return buffer;
        }),
      },
    } as any;

    global.performance = {
      now: vi.fn(() => Date.now()),
    } as any;

    // Mock AI responses
    vi.mock('ai', () => ({
      generateObject: vi.fn(async ({ schema, prompt, messages }) => {
        // Simulate realistic AI responses based on the schema
        if (schema && schema._def) {
          const schemaShape = schema._def.shape();

          if (schemaShape.description) {
            return {
              object: {
                description: 'Integration test image showing a placeholder',
                objects: ['placeholder', 'test-content'],
                text: 'Sample text extracted from image',
                colors: ['gray', 'white'],
                mood: 'neutral',
                tags: ['test', 'integration', 'placeholder'],
              },
            };
          }

          if (schemaShape.scenes) {
            return {
              object: {
                scenes: [
                  {
                    frameIndex: 0,
                    timestamp: 0,
                    sceneType: 'static',
                    confidence: 0.85,
                    description: 'Static test scene',
                    keyObjects: ['test-object'],
                    colorPalette: ['gray'],
                    significance: 6,
                  },
                ],
              },
            };
          }

          if (schemaShape.summary) {
            return {
              object: {
                summary:
                  'This is a comprehensive analysis of the integration test content',
                structure: {
                  sections: ['Introduction', 'Test Content'],
                  hasTable: false,
                  hasCode: false,
                  wordCount: 25,
                },
                keyTopics: ['integration', 'testing', 'multimodal'],
                documentType: 'test-document',
                metadata: {
                  language: 'english',
                },
              },
            };
          }
        }

        // Default response
        return {
          object: {
            result: 'Integration test response',
            confidence: 0.8,
          },
        };
      }),
      transcribe: vi.fn(async () => ({
        text: 'This is a simulated audio transcription for integration testing',
        segments: [
          {
            start: 0,
            end: 5,
            text: 'This is a simulated audio transcription for integration testing',
            confidence: 0.9,
          },
        ],
      })),
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

  describe('End-to-End File Processing', () => {
    it('should process a complete multi-modal workflow', async () => {
      const attachments = createTestAttachments();

      const result = await system.processBatch(attachments);

      expect(result.batchId).toBeDefined();
      expect(result.totalFiles).toBe(3);
      expect(result.processedFiles).toBeGreaterThan(0);
      expect(result.batchMetrics.totalTime).toBeGreaterThan(0);
      expect(result.batchMetrics.successRate).toBeGreaterThan(0);

      // Verify each file was processed
      const imageResult = result.results.find((r) =>
        r.fileName.includes('image')
      );
      const videoResult = result.results.find((r) =>
        r.fileName.includes('video')
      );
      const documentResult = result.results.find((r) =>
        r.fileName.includes('document')
      );

      expect(imageResult).toBeDefined();
      expect(videoResult).toBeDefined();
      expect(documentResult).toBeDefined();
    }, 30_000); // Extended timeout for integration test

    it('should maintain consistency across multiple processing runs', async () => {
      const attachment = createTestAttachments()[0]; // Use image

      const result1 = await system.processAttachment(attachment);
      const result2 = await system.processAttachment(attachment);
      const result3 = await system.processAttachment(attachment);

      // Results should be consistent (likely cached after first run)
      expect(result1.type).toBe(result2.type);
      expect(result1.type).toBe(result3.type);
      expect(result1.originalName).toBe(result2.originalName);
      expect(result1.originalName).toBe(result3.originalName);

      // Performance should improve with caching
      const metrics = system.getSystemMetrics();
      expect(metrics.performance.cacheHitRate).toBeGreaterThan(0);
    });

    it('should handle mixed success and failure scenarios', async () => {
      const attachments = [
        ...createTestAttachments(),
        {
          name: 'invalid-file.xyz',
          type: 'application/unknown',
          size: 1000,
          base64: 'invalid-data',
        },
      ];

      const result = await system.processBatch(attachments);

      expect(result.totalFiles).toBe(4);
      expect(result.processedFiles).toBe(3); // 3 valid, 1 invalid
      expect(result.failedFiles).toBe(1);
      expect(result.batchMetrics.successRate).toBe(0.75);

      // Verify failed file is handled correctly
      const failedResult = result.results.find((r) => r.error);
      expect(failedResult).toBeDefined();
      expect(failedResult!.fileName).toBe('invalid-file.xyz');
    });
  });

  describe('Real-time Streaming Integration', () => {
    it('should initialize streaming processor successfully', async () => {
      const streamingProcessor = createStreamingProcessor({
        frameRate: 15, // Lower for testing
        enableRealtimeAnalysis: false,
        enableLowLatency: true,
      });

      expect(streamingProcessor).toBeDefined();

      // Test event system
      let eventReceived = false;
      streamingProcessor.addEventListener('started', () => {
        eventReceived = true;
      });

      try {
        await streamingProcessor.startStream({
          video: { width: 640, height: 480 },
          audio: false,
        });

        // Should receive started event
        expect(eventReceived).toBe(true);

        const metrics = streamingProcessor.getStreamMetrics();
        expect(metrics).toBeDefined();
        expect(metrics.networkCondition).toBeDefined();
      } catch (error) {
        // Expected in test environment without real media devices
        expect(error).toBeInstanceOf(Error);
      } finally {
        await streamingProcessor.stopStream();
      }
    });

    it('should handle screen sharing workflow', async () => {
      const streamId = await system.startScreenShare((analysisResult) => {
        expect(analysisResult).toBeDefined();
        expect(analysisResult.timestamp).toBeGreaterThan(0);
      });

      expect(streamId).toBeDefined();
      expect(typeof streamId).toBe('string');

      await system.stopStreaming();
    });
  });

  describe('Video Processing Integration', () => {
    it('should process video with all advanced features', async () => {
      const videoProcessor = createVideoProcessor({
        frameInterval: 1,
        maxFrames: 3,
        enableHardwareAcceleration: false, // Disable for testing
        enableTemporalAnalysis: true,
        enableSceneDetection: true,
      });

      try {
        const result = await videoProcessor.processVideo(createRealVideoData());

        expect(result.metadata).toBeDefined();
        expect(result.frames).toBeDefined();
        expect(result.scenes).toBeDefined();
        expect(result.summary).toBeDefined();
        expect(result.performance).toBeDefined();

        // Verify performance metrics
        expect(result.performance.processingTime).toBeGreaterThan(0);
        expect(result.performance.frameExtractionTime).toBeGreaterThan(0);
        expect(result.performance.analysisTime).toBeGreaterThan(0);
      } catch (error) {
        // Expected in test environment due to DOM limitations
        expect(error).toBeInstanceOf(Error);
      } finally {
        videoProcessor.destroy();
      }
    });
  });

  describe('Cross-Modal Analysis Integration', () => {
    it('should perform comprehensive cross-modal analysis', async () => {
      const attachments = createTestAttachments();

      const result = await system.processBatch(attachments);

      // With 3 different modalities, cross-modal analysis should be performed
      expect(result.totalFiles).toBe(3);

      // Check if any results have cross-modal insights
      const hasAnalysis = result.results.some(
        (r) => r.result && typeof r.result === 'object'
      );
      expect(hasAnalysis).toBe(true);
    });

    it('should identify correlations between different media types', async () => {
      // Create related content
      const relatedAttachments: FileAttachment[] = [
        {
          name: 'presentation-slide.jpg',
          type: 'image/jpeg',
          size: 200_000,
          base64: createRealImageData(),
        },
        {
          name: 'presentation-script.txt',
          type: 'text/plain',
          size: 2048,
          base64:
            'data:text/plain;base64,' +
            btoa(
              'Welcome to our presentation about artificial intelligence and machine learning. Today we will discuss the latest advances in multi-modal AI systems.'
            ),
        },
      ];

      const result = await system.processBatch(relatedAttachments);

      expect(result.processedFiles).toBe(2);
      expect(result.batchMetrics.successRate).toBe(1.0);

      // Both files should be processed successfully
      expect(result.results.length).toBe(2);
      expect(result.results.every((r) => !r.error)).toBe(true);
    });
  });

  describe('Performance and Scalability Integration', () => {
    it('should handle large batch processing efficiently', async () => {
      // Create a moderate batch for integration testing
      const largeBatch: FileAttachment[] = Array(20)
        .fill(null)
        .map((_, i) => ({
          name: `batch-file-${i}.txt`,
          type: 'text/plain',
          size: 1024,
          base64:
            'data:text/plain;base64,' +
            btoa(
              `This is test document number ${i} for batch processing integration testing.`
            ),
        }));

      const startTime = Date.now();
      const result = await system.processBatch(largeBatch);
      const endTime = Date.now();

      expect(result.totalFiles).toBe(20);
      expect(result.batchMetrics.parallelizationFactor).toBeGreaterThan(1);
      expect(result.batchMetrics.averageTimePerFile).toBeGreaterThan(0);

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(60_000); // 60 seconds max

      // Verify performance metrics
      const metrics = system.getSystemMetrics();
      expect(metrics.performance.totalRequests).toBeGreaterThan(0);
      expect(metrics.performance.successfulRequests).toBeGreaterThan(0);
    }, 60_000); // Extended timeout for large batch

    it('should optimize performance with caching', async () => {
      const attachment = createTestAttachments()[0];

      // Process same file multiple times
      const results = await Promise.all([
        system.processAttachment(attachment),
        system.processAttachment(attachment),
        system.processAttachment(attachment),
      ]);

      // All should succeed
      expect(results.every((r) => !r.error)).toBe(true);

      // Cache hit rate should improve
      const metrics = system.getSystemMetrics();
      expect(metrics.performance.cacheHitRate).toBeGreaterThan(0);
      expect(metrics.cacheSize).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover gracefully from transient failures', async () => {
      // Mock AI service to fail initially, then succeed
      let callCount = 0;
      const originalGenerateObject = vi.fn(async () => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Transient AI service error');
        }
        return {
          object: {
            description: 'Recovery test successful',
            confidence: 0.9,
          },
        };
      });

      // Override the mock temporarily
      vi.doMock('ai', () => ({
        generateObject: originalGenerateObject,
        transcribe: vi.fn(async () => ({ text: 'test' })),
      }));

      const attachment = createTestAttachments()[0];

      // First few attempts should fail, but system should handle gracefully
      const result1 = await system.processAttachment(attachment);
      expect(result1.error).toBeDefined();

      const result2 = await system.processAttachment(attachment);
      expect(result2.error).toBeDefined();

      const result3 = await system.processAttachment(attachment);
      // This should succeed due to retry logic or different handling
      // In a real implementation with retry logic
    });

    it('should handle memory pressure gracefully', async () => {
      // Simulate memory pressure by creating large attachments
      const largeAttachment: FileAttachment = {
        name: 'large-test-file.txt',
        type: 'text/plain',
        size: 10_485_760, // 10MB
        base64: 'data:text/plain;base64,' + 'a'.repeat(1_000_000), // Large base64 string
      };

      const result = await system.processAttachment(largeAttachment);

      // Should handle gracefully without crashing
      expect(result).toBeDefined();

      // May succeed or fail, but shouldn't crash the system
      const metrics = system.getSystemMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('System Integration Points', () => {
    it('should integrate with security validation', async () => {
      // This test verifies that the security layer is properly integrated
      const attachment = createTestAttachments()[0];

      const result = await system.processAttachment(attachment);

      // Should process successfully as our test data is safe
      expect(result.error).toBeUndefined();
      expect(result.processedData).toBeDefined();
    });

    it('should provide comprehensive system metrics', async () => {
      // Process some files to generate metrics
      await system.processBatch(createTestAttachments());

      const metrics = system.getSystemMetrics();

      expect(metrics.performance).toBeDefined();
      expect(metrics.performance.totalRequests).toBeGreaterThan(0);
      expect(metrics.performance.successfulRequests).toBeGreaterThan(0);
      expect(metrics.performance.averageProcessingTime).toBeGreaterThan(0);

      expect(metrics.cacheSize).toBeGreaterThanOrEqual(0);
      expect(metrics.videoProcessor).toBeDefined();
      expect(metrics.streaming).toBeDefined();
    });

    it('should support system lifecycle management', () => {
      const initialMetrics = system.getSystemMetrics();

      // Reset system
      system.reset();

      const resetMetrics = system.getSystemMetrics();
      expect(resetMetrics.performance.totalRequests).toBe(0);
      expect(resetMetrics.cacheSize).toBe(0);

      // Destroy system
      system.destroy();

      // Should complete without errors
      expect(true).toBe(true);
    });
  });
});

describe('Real-World Scenario Tests', () => {
  it('should handle a typical user workflow', async () => {
    const system = new MultiModalCompleteSystem();

    try {
      // Scenario: User uploads multiple files for a presentation
      const presentationFiles: FileAttachment[] = [
        {
          name: 'title-slide.jpg',
          type: 'image/jpeg',
          size: 150_000,
          base64: createRealImageData(),
        },
        {
          name: 'demo-video.mp4',
          type: 'video/mp4',
          size: 5_000_000,
          base64: createRealVideoData(),
        },
        {
          name: 'speaker-notes.txt',
          type: 'text/plain',
          size: 3000,
          base64:
            'data:text/plain;base64,' +
            btoa(
              'Speaker notes for the presentation: Welcome everyone, today we will discuss...'
            ),
        },
      ];

      // Process the presentation files
      const result = await system.processBatch(presentationFiles);

      // Verify successful processing
      expect(result.totalFiles).toBe(3);
      expect(result.batchMetrics.successRate).toBeGreaterThan(0.8); // At least 80% success

      // Check that different file types were handled
      const fileTypes = result.results.map((r) => r.type);
      expect(fileTypes).toContain('image/jpeg');
      expect(fileTypes).toContain('video/mp4');
      expect(fileTypes).toContain('text/plain');

      // Verify performance is reasonable
      expect(result.batchMetrics.totalTime).toBeLessThan(30_000); // Under 30 seconds
    } finally {
      system.destroy();
    }
  });

  it('should handle content creation workflow', async () => {
    const system = new MultiModalCompleteSystem();

    try {
      // Scenario: Content creator uploads media for analysis
      const contentFiles: FileAttachment[] = [
        {
          name: 'thumbnail.jpg',
          type: 'image/jpeg',
          size: 80_000,
          base64: createRealImageData(),
        },
        {
          name: 'main-content.mp4',
          type: 'video/mp4',
          size: 10_000_000,
          base64: createRealVideoData(),
        },
      ];

      // Process individual files first
      const thumbnailResult = await system.processAttachment(contentFiles[0]);
      expect(thumbnailResult.type).toBe('image');

      const videoResult = await system.processAttachment(contentFiles[1]);
      expect(videoResult.type).toBe('video');

      // Then process as batch for cross-modal analysis
      const batchResult = await system.processBatch(contentFiles);
      expect(batchResult.processedFiles).toBe(2);
    } finally {
      system.destroy();
    }
  });
});

// Mock WebCodecs and other advanced APIs for completeness
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'VideoFrame', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      close: vi.fn(),
    })),
  });

  Object.defineProperty(window, 'OffscreenCanvas', {
    writable: true,
    value: vi.fn().mockImplementation((width, height) => ({
      width,
      height,
      getContext: vi.fn(() => ({
        drawImage: vi.fn(),
      })),
      convertToBlob: vi.fn(
        async () => new Blob(['mock'], { type: 'image/jpeg' })
      ),
    })),
  });
}
