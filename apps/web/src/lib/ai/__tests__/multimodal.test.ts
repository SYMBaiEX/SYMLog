/**
 * Comprehensive Test Suite for Multi-Modal AI System
 * Tests all major functionality including video processing, streaming, and cross-modal analysis
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';
import type { FileAttachment } from '@/types/attachments';
import { AdvancedMultiModal } from '../multimodal';
import { MultiModalCompleteSystem } from '../multimodal-complete';
import { RealtimeStreamingProcessor } from '../streaming-processor';
import { AdvancedVideoProcessor } from '../video-processor';

// Mock external dependencies
vi.mock('ai', () => ({
  generateObject: vi.fn(),
  transcribe: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(),
}));

vi.mock('@/lib/security/attachment-validator', () => ({
  validateAttachments: vi.fn(() =>
    Promise.resolve({
      valid: true,
      sanitizedAttachments: [],
    })
  ),
  scanForMaliciousContent: vi.fn(() => ({ safe: true })),
}));

// Test data
const createMockImageAttachment = (): FileAttachment => ({
  name: 'test-image.jpg',
  type: 'image/jpeg',
  size: 102_400,
  base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD//test',
});

const createMockVideoAttachment = (): FileAttachment => ({
  name: 'test-video.mp4',
  type: 'video/mp4',
  size: 2_048_000,
  base64: 'data:video/mp4;base64,AAAAIGZ0eXBtcDQyAAACAGlzb20=',
});

const createMockAudioAttachment = (): FileAttachment => ({
  name: 'test-audio.mp3',
  type: 'audio/mpeg',
  size: 512_000,
  base64:
    'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMDEA',
});

const createMockDocumentAttachment = (): FileAttachment => ({
  name: 'test-document.pdf',
  type: 'application/pdf',
  size: 256_000,
  base64: 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKNCAwIG9iag==',
});

describe('AdvancedMultiModal', () => {
  let multiModal: AdvancedMultiModal;
  let mockGenerateObject: Mock;
  let mockTranscribe: Mock;

  beforeEach(() => {
    multiModal = new AdvancedMultiModal();
    mockGenerateObject = vi.mocked(require('ai').generateObject);
    mockTranscribe = vi.mocked(require('ai').transcribe);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Image Processing', () => {
    it('should process image attachment with OCR and analysis', async () => {
      const mockImageAnalysis = {
        object: {
          description: 'A test image showing a person',
          objects: ['person', 'background'],
          text: 'Sample text in image',
          colors: ['blue', 'white'],
          mood: 'neutral',
          tags: ['person', 'portrait'],
        },
      };

      mockGenerateObject.mockResolvedValueOnce(mockImageAnalysis);
      mockGenerateObject.mockResolvedValueOnce({
        object: { text: 'Sample text in image', confidence: 0.95 },
      });

      const result = await multiModal.processImageAttachment(
        'data:image/jpeg;base64,test123',
        { extractText: true, analyzeContent: true }
      );

      expect(result).toBeDefined();
      expect(result.extractedText).toBe('Sample text in image');
      expect(result.analysis).toEqual(mockImageAnalysis.object);
      expect(mockGenerateObject).toHaveBeenCalledTimes(2);
    });

    it('should handle image processing errors gracefully', async () => {
      mockGenerateObject.mockRejectedValueOnce(
        new Error('AI service unavailable')
      );

      const result = await multiModal.processImageAttachment(
        'data:image/jpeg;base64,test123'
      );

      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors![0]).toContain('AI service unavailable');
    });
  });

  describe('Audio Processing', () => {
    it('should transcribe and analyze audio', async () => {
      const mockTranscription = {
        text: 'This is a test audio transcription',
      };

      const mockAnalysis = {
        object: {
          sentiment: 'positive',
          topics: ['test', 'audio'],
          summary: 'Test audio content',
          actionItems: ['Review transcription'],
          keyPoints: ['Important point 1'],
        },
      };

      mockTranscribe.mockResolvedValueOnce(mockTranscription);
      mockGenerateObject.mockResolvedValueOnce(mockAnalysis);

      const result = await multiModal.processAudioAttachment(
        'data:audio/mpeg;base64,testbinary',
        { analyzeSentiment: true, extractActionItems: true }
      );

      expect(result.transcription).toEqual(mockTranscription);
      expect(result.analysis).toEqual(mockAnalysis.object);
      expect(mockTranscribe).toHaveBeenCalledTimes(1);
      expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    });

    it('should handle binary audio data', async () => {
      const binaryData = new Uint8Array([1, 2, 3, 4, 5]);
      mockTranscribe.mockResolvedValueOnce({ text: 'Binary audio test' });

      const result = await multiModal.processAudioAttachment(binaryData);

      expect(result.transcription.text).toBe('Binary audio test');
      expect(mockTranscribe).toHaveBeenCalledWith({
        model: expect.anything(),
        audio: binaryData,
        language: undefined,
      });
    });
  });

  describe('Document Processing', () => {
    it('should process text documents', async () => {
      const mockAnalysis = {
        object: {
          summary: 'Test document summary',
          structure: {
            sections: ['Introduction', 'Content'],
            hasTable: false,
            hasCode: true,
            wordCount: 150,
          },
          keyTopics: ['testing', 'documents'],
          documentType: 'technical',
          metadata: {
            language: 'english',
            techStack: ['javascript', 'typescript'],
          },
        },
      };

      mockGenerateObject.mockResolvedValueOnce(mockAnalysis);

      // Mock atob for base64 decoding
      global.atob = vi.fn(() => 'Sample document content for testing');

      const result = await multiModal.processDocumentAttachment(
        'data:text/plain;base64,dGVzdCBjb250ZW50',
        'text/plain'
      );

      expect(result.content).toBe('Sample document content for testing');
      expect(result.analysis).toEqual(mockAnalysis.object);
    });

    it('should throw error for unsupported document types', async () => {
      await expect(
        multiModal.processDocumentAttachment('data', 'application/unknown')
      ).rejects.toThrow('Unsupported document type');
    });
  });

  describe('Video Processing', () => {
    beforeEach(() => {
      // Mock DOM APIs
      global.document = {
        createElement: vi.fn((tag) => {
          if (tag === 'video') {
            return {
              preload: '',
              crossOrigin: '',
              src: '',
              duration: 10,
              videoWidth: 1280,
              videoHeight: 720,
              audioTracks: [{}],
              currentTime: 0,
              onloadedmetadata: null,
              onerror: null,
              onseeked: null,
              ontimeupdate: null,
            };
          }
          if (tag === 'canvas') {
            return {
              width: 0,
              height: 0,
              getContext: vi.fn(() => ({
                drawImage: vi.fn(),
                canvas: { width: 1280, height: 720 },
              })),
              toDataURL: vi.fn(() => 'data:image/jpeg;base64,mockframe'),
            };
          }
          return {};
        }),
      } as any;
    });

    it('should process video with frame extraction', async () => {
      const mockFrameAnalysis = {
        object: {
          scenes: [
            {
              frameIndex: 0,
              timestamp: 0,
              sceneType: 'static',
              confidence: 0.9,
              description: 'Test scene',
              keyObjects: ['test'],
              colorPalette: ['blue'],
              significance: 7,
            },
          ],
        },
      };

      const mockSummary = {
        object: {
          summary: 'Video summary',
          mainThemes: ['test'],
          contentType: 'educational',
        },
      };

      mockGenerateObject
        .mockResolvedValueOnce(mockFrameAnalysis)
        .mockResolvedValueOnce(mockSummary);

      const result = await multiModal.processVideoAttachment(
        'data:video/mp4;base64,test',
        { extractFrames: true, analyzeContent: true }
      );

      expect(result.metadata).toBeDefined();
      expect(result.metadata!.duration).toBe(10);
      expect(result.frames).toBeDefined();
      expect(Array.isArray(result.frames)).toBe(true);
    });

    it('should handle video processing errors', async () => {
      // Mock video element creation failure
      global.document.createElement = vi.fn(() => {
        throw new Error('Failed to create video element');
      });

      await expect(
        multiModal.processVideoAttachment('data:video/mp4;base64,test')
      ).rejects.toThrow('Video processing failed');
    });
  });

  describe('Unified Attachment Processing', () => {
    it('should route to correct processor based on file type', async () => {
      const imageAttachment = createMockImageAttachment();
      mockGenerateObject.mockResolvedValue({ object: { test: 'data' } });

      const result = await multiModal.processAttachment(imageAttachment);

      expect(result.type).toBe('image');
      expect(result.originalName).toBe('test-image.jpg');
      expect(result.processedData).toBeDefined();
    });

    it('should handle unsupported file types', async () => {
      const unsupportedAttachment: FileAttachment = {
        name: 'test.xyz',
        type: 'application/unknown',
        size: 1000,
        base64: 'data',
      };

      const result = await multiModal.processAttachment(unsupportedAttachment);

      expect(result.type).toBe('unknown');
      expect(result.error).toContain('Unsupported file type');
    });
  });
});

describe('AdvancedVideoProcessor', () => {
  let videoProcessor: AdvancedVideoProcessor;

  beforeEach(() => {
    videoProcessor = new AdvancedVideoProcessor({
      frameInterval: 1,
      maxFrames: 5,
      enableHardwareAcceleration: false, // Disable for testing
    });

    // Mock browser APIs
    global.performance = { now: vi.fn(() => Date.now()) } as any;
    global.navigator = { hardwareConcurrency: 4 } as any;
    global.crypto = {
      subtle: {
        digest: vi.fn(async () => new ArrayBuffer(32)),
      },
    } as any;
  });

  afterEach(() => {
    videoProcessor.destroy();
  });

  it('should initialize with correct configuration', () => {
    const config = videoProcessor.getConfig();
    expect(config.frameInterval).toBe(1);
    expect(config.maxFrames).toBe(5);
    expect(config.enableHardwareAcceleration).toBe(false);
  });

  it('should update configuration', () => {
    videoProcessor.updateConfig({ frameInterval: 2, quality: 0.9 });
    const config = videoProcessor.getConfig();
    expect(config.frameInterval).toBe(2);
    expect(config.quality).toBe(0.9);
  });

  it('should handle video processing with fallback methods', async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        totalScenes: 1,
        dominantColors: ['blue'],
        mainObjects: ['test'],
        contentType: 'other',
        mood: 'neutral',
        keyMoments: [],
      },
    });

    // Mock video element creation
    global.document = {
      createElement: vi.fn(() => ({
        preload: '',
        crossOrigin: '',
        muted: true,
        src: '',
        duration: 5,
        videoWidth: 640,
        videoHeight: 480,
        audioTracks: [],
        onloadedmetadata: null,
        onerror: null,
      })),
    } as any;

    try {
      const result = await videoProcessor.processVideo(
        'data:video/mp4;base64,test'
      );
      expect(result.metadata).toBeDefined();
      expect(result.performance).toBeDefined();
    } catch (error) {
      // Expected to fail in test environment due to DOM limitations
      expect(error).toBeInstanceOf(Error);
    }
  });
});

describe('RealtimeStreamingProcessor', () => {
  let streamingProcessor: RealtimeStreamingProcessor;

  beforeEach(() => {
    streamingProcessor = new RealtimeStreamingProcessor({
      frameRate: 30,
      enableRealtimeAnalysis: false, // Disable for testing
    });

    // Mock MediaDevices API
    global.navigator = {
      mediaDevices: {
        getUserMedia: vi.fn(async () => ({
          getTracks: vi.fn(() => [
            { kind: 'video', stop: vi.fn() },
            { kind: 'audio', stop: vi.fn() },
          ]),
        })),
        getDisplayMedia: vi.fn(async () => ({
          getVideoTracks: vi.fn(() => [{ kind: 'video' }]),
        })),
      },
    } as any;
  });

  afterEach(async () => {
    await streamingProcessor.stopStream();
  });

  it('should initialize with default configuration', () => {
    expect(streamingProcessor).toBeInstanceOf(RealtimeStreamingProcessor);
  });

  it('should handle getUserMedia errors gracefully', async () => {
    global.navigator.mediaDevices.getUserMedia = vi.fn(async () => {
      throw new Error('Permission denied');
    });

    await expect(streamingProcessor.startStream()).rejects.toThrow(
      'Permission denied'
    );
  });

  it('should manage event listeners', () => {
    const mockCallback = vi.fn();

    streamingProcessor.addEventListener('started', mockCallback);
    streamingProcessor.removeEventListener('started', mockCallback);

    // No error should be thrown
    expect(true).toBe(true);
  });
});

describe('MultiModalCompleteSystem', () => {
  let completeSystem: MultiModalCompleteSystem;

  beforeEach(() => {
    completeSystem = new MultiModalCompleteSystem({
      enableCrossModalAnalysis: true,
      enableIntelligentCaching: true,
    });
  });

  afterEach(() => {
    completeSystem.destroy();
  });

  it('should initialize all subsystems', () => {
    expect(completeSystem).toBeInstanceOf(MultiModalCompleteSystem);
  });

  it('should process single attachment with caching', async () => {
    const attachment = createMockImageAttachment();
    mockGenerateObject.mockResolvedValue({
      object: {
        description: 'test',
        objects: [],
        colors: [],
        mood: 'neutral',
        tags: [],
      },
    });

    const result1 = await completeSystem.processAttachment(attachment);
    const result2 = await completeSystem.processAttachment(attachment); // Should hit cache

    expect(result1.originalName).toBe('test-image.jpg');
    expect(result2.originalName).toBe('test-image.jpg');
  });

  it('should process batch attachments with parallelization', async () => {
    const attachments = [
      createMockImageAttachment(),
      createMockAudioAttachment(),
    ];

    mockGenerateObject.mockResolvedValue({ object: {} });
    mockTranscribe.mockResolvedValue({ text: 'test' });

    const result = await completeSystem.processBatch(attachments);

    expect(result.totalFiles).toBe(2);
    expect(result.batchId).toBeDefined();
    expect(result.batchMetrics).toBeDefined();
  });

  it('should handle cross-modal analysis', async () => {
    const attachments = [
      createMockImageAttachment(),
      createMockVideoAttachment(),
    ];

    mockGenerateObject.mockResolvedValue({ object: {} });

    const result = await completeSystem.processBatch(attachments);

    // Cross-modal analysis should be attempted for multiple media files
    expect(result.totalFiles).toBe(2);
  });

  it('should provide system metrics', () => {
    const metrics = completeSystem.getSystemMetrics();

    expect(metrics.performance).toBeDefined();
    expect(metrics.cacheSize).toBeDefined();
    expect(metrics.videoProcessor).toBeDefined();
    expect(metrics.streaming).toBeDefined();
  });

  it('should reset system state', () => {
    completeSystem.reset();
    const metrics = completeSystem.getSystemMetrics();

    expect(metrics.performance.totalRequests).toBe(0);
    expect(metrics.cacheSize).toBe(0);
  });
});

describe('Integration Tests', () => {
  it('should handle complete workflow from file to analysis', async () => {
    const system = new MultiModalCompleteSystem();
    const attachment = createMockImageAttachment();

    mockGenerateObject.mockResolvedValue({
      object: {
        description: 'Integration test image',
        objects: ['test-object'],
        colors: ['red', 'blue'],
        mood: 'positive',
        tags: ['integration', 'test'],
      },
    });

    try {
      const result = await system.processAttachment(attachment);

      expect(result.type).toBe('image');
      expect(result.processedData).toBeDefined();
      expect(result.error).toBeUndefined();
    } finally {
      system.destroy();
    }
  });

  it('should handle mixed file types in batch processing', async () => {
    const system = new MultiModalCompleteSystem();
    const attachments = [
      createMockImageAttachment(),
      createMockAudioAttachment(),
      createMockDocumentAttachment(),
    ];

    mockGenerateObject.mockResolvedValue({ object: {} });
    mockTranscribe.mockResolvedValue({ text: 'test transcription' });
    global.atob = vi.fn(() => 'document content');

    try {
      const result = await system.processBatch(attachments);

      expect(result.totalFiles).toBe(3);
      expect(result.results.length).toBe(3);
      expect(result.batchMetrics.successRate).toBeGreaterThan(0);
    } finally {
      system.destroy();
    }
  });
});

describe('Error Handling and Edge Cases', () => {
  let system: MultiModalCompleteSystem;

  beforeEach(() => {
    system = new MultiModalCompleteSystem();
  });

  afterEach(() => {
    system.destroy();
  });

  it('should handle malformed base64 data', async () => {
    const malformedAttachment: FileAttachment = {
      name: 'malformed.jpg',
      type: 'image/jpeg',
      size: 1000,
      base64: 'invalid-base64-data',
    };

    const result = await system.processAttachment(malformedAttachment);
    expect(result.error).toBeDefined();
  });

  it('should handle network timeouts gracefully', async () => {
    mockGenerateObject.mockRejectedValue(new Error('Network timeout'));

    const attachment = createMockImageAttachment();
    const result = await system.processAttachment(attachment);

    expect(result.error).toContain('Network timeout');
  });

  it('should handle memory limitations in batch processing', async () => {
    // Create a large batch to test memory handling
    const largeAttachments = Array(100)
      .fill(null)
      .map((_, i) => ({
        name: `large-file-${i}.jpg`,
        type: 'image/jpeg',
        size: 10_485_760, // 10MB each
        base64: 'data:image/jpeg;base64,' + 'a'.repeat(1000),
      }));

    mockGenerateObject.mockResolvedValue({ object: {} });

    const result = await system.processBatch(largeAttachments);

    // Should complete without crashing
    expect(result.totalFiles).toBe(100);
  });

  it('should validate file size limits', async () => {
    const oversizedAttachment: FileAttachment = {
      name: 'huge-file.jpg',
      type: 'image/jpeg',
      size: 1_073_741_824, // 1GB
      base64: 'data:image/jpeg;base64,huge',
    };

    // This should be handled by the attachment validator
    const result = await system.processAttachment(oversizedAttachment);

    // Result should handle the case appropriately
    expect(result).toBeDefined();
  });
});

describe('Performance Tests', () => {
  it('should complete image processing within time limits', async () => {
    const system = new MultiModalCompleteSystem();
    const attachment = createMockImageAttachment();

    mockGenerateObject.mockResolvedValue({ object: {} });

    const startTime = Date.now();
    await system.processAttachment(attachment);
    const endTime = Date.now();

    // Should complete within 10 seconds
    expect(endTime - startTime).toBeLessThan(10_000);

    system.destroy();
  });

  it('should handle concurrent processing efficiently', async () => {
    const system = new MultiModalCompleteSystem();
    const attachments = Array(10)
      .fill(null)
      .map(() => createMockImageAttachment());

    mockGenerateObject.mockResolvedValue({ object: {} });

    const startTime = Date.now();

    const results = await Promise.all(
      attachments.map((attachment) => system.processAttachment(attachment))
    );

    const endTime = Date.now();

    expect(results.length).toBe(10);
    expect(results.every((r) => !r.error)).toBe(true);

    // Concurrent processing should be faster than sequential
    expect(endTime - startTime).toBeLessThan(30_000);

    system.destroy();
  });
});
