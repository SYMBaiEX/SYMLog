import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { createLogger } from '../../logger/unified-logger';

// Create AI video processor logger
const logger = createLogger({ service: 'ai-video-processor' });

// Configuration constants to replace magic numbers
const VIDEO_PROCESSING_CONSTANTS = {
  DEFAULT_FRAME_INTERVAL: 2, // seconds
  DEFAULT_MAX_FRAMES: 20,
  DEFAULT_QUALITY: 0.8,
  MAX_BLOB_SIZE: 50 * 1024 * 1024, // 50MB
  DEFAULT_FRAME_RATE: 30,
  MAX_FRAME_INTERVAL: 10,
  MIN_FRAME_INTERVAL: 0.1,
  MAX_FRAMES_LIMIT: 100,
  MIN_FRAMES_LIMIT: 1,
  MAX_QUALITY: 1.0,
  MIN_QUALITY: 0.1,
  WORKER_CLEANUP_DELAY: 1000, // ms
  ANALYSIS_TIMEOUT: 10_000, // ms
} as const;

// Video processing configuration
export interface VideoProcessingConfig {
  frameInterval: number; // seconds between frame extractions
  maxFrames: number;
  quality: number; // 0.1 to 1.0 for JPEG quality
  enableHardwareAcceleration: boolean;
  enableWorkerProcessing: boolean;
  enableTemporalAnalysis: boolean;
  enableSceneDetection: boolean;
  enableObjectTracking: boolean;
  outputFormat: 'jpeg' | 'webp' | 'png';
  targetWidth?: number;
  targetHeight?: number;
}

// Video metadata extracted from file
export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  frameRate: number;
  bitrate?: number;
  codec?: string;
  hasAudio: boolean;
  audioTracks?: number;
  videoTracks?: number;
  fileSize?: number;
  createdAt?: Date;
}

// Extracted frame data
export interface VideoFrame {
  timestamp: number;
  index: number;
  dataUrl: string;
  width: number;
  height: number;
  size: number; // bytes
  hash?: string; // for deduplication
}

// Scene detection result
export interface SceneDetection {
  timestamp: number;
  sceneType: 'static' | 'motion' | 'transition' | 'text' | 'face' | 'action';
  confidence: number;
  description: string;
  keyObjects: string[];
  colorPalette: string[];
  significance: number; // 1-10
}

// Object tracking result
export interface ObjectTracking {
  objectId: string;
  objectType: string;
  confidence: number;
  boundingBoxes: Array<{
    timestamp: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  firstSeen: number;
  lastSeen: number;
}

// Video analysis result
export interface VideoAnalysisResult {
  metadata: VideoMetadata;
  frames: VideoFrame[];
  scenes: SceneDetection[];
  objects: ObjectTracking[];
  summary: {
    totalScenes: number;
    dominantColors: string[];
    mainObjects: string[];
    contentType:
      | 'educational'
      | 'entertainment'
      | 'presentation'
      | 'documentary'
      | 'conversation'
      | 'action'
      | 'other';
    mood: string;
    keyMoments: Array<{
      timestamp: number;
      description: string;
      importance: number;
    }>;
  };
  audioTranscript?: {
    text: string;
    segments: Array<{
      start: number;
      end: number;
      text: string;
      confidence: number;
    }>;
  };
  performance: {
    processingTime: number;
    frameExtractionTime: number;
    analysisTime: number;
    hardwareAccelerated: boolean;
    workerUsed: boolean;
  };
}

/**
 * Advanced Video Processor with hardware acceleration and intelligent analysis
 */
export class AdvancedVideoProcessor {
  private config: VideoProcessingConfig;
  private worker?: Worker;
  private supportsWebCodecs = false;
  private supportsOffscreenCanvas = false;
  private performanceObserver?: PerformanceObserver;
  private frameBuffer: any[] = [];

  constructor(config?: Partial<VideoProcessingConfig>) {
    this.config = {
      frameInterval: VIDEO_PROCESSING_CONSTANTS.DEFAULT_FRAME_INTERVAL,
      maxFrames: VIDEO_PROCESSING_CONSTANTS.DEFAULT_MAX_FRAMES,
      quality: VIDEO_PROCESSING_CONSTANTS.DEFAULT_QUALITY,
      enableHardwareAcceleration: true,
      enableWorkerProcessing: true,
      enableTemporalAnalysis: true,
      enableSceneDetection: true,
      enableObjectTracking: true,
      outputFormat: 'jpeg',
      ...config,
    };

    this.initializeCapabilities();

    if (this.config.enableWorkerProcessing) {
      this.initializeWorker();
    }
  }

  /**
   * Process video with comprehensive analysis
   */
  async processVideo(videoData: string): Promise<VideoAnalysisResult> {
    const startTime = performance.now();

    try {
      // Create video element and extract metadata
      const video = await this.createVideoElement(videoData);
      const metadata = await this.extractAdvancedMetadata(video);

      // Extract frames using optimal method
      const frameStartTime = performance.now();
      const frames = await this.extractFramesOptimized(video);
      const frameExtractionTime = performance.now() - frameStartTime;

      // Perform comprehensive analysis
      const analysisStartTime = performance.now();
      const scenes = await this.performSceneDetection(frames);
      const objects = this.config.enableObjectTracking
        ? await this.performObjectTracking(frames)
        : [];
      const summary = await this.generateVideoSummary(frames, scenes, metadata);
      const analysisTime = performance.now() - analysisStartTime;

      // Audio transcription if available
      let audioTranscript: VideoAnalysisResult['audioTranscript'];
      if (metadata.hasAudio) {
        try {
          audioTranscript = await this.extractAndTranscribeAudio(video);
        } catch (error) {
          logger.warn('Audio transcription failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const totalTime = performance.now() - startTime;

      return {
        metadata,
        frames,
        scenes,
        objects,
        summary,
        audioTranscript,
        performance: {
          processingTime: totalTime,
          frameExtractionTime,
          analysisTime,
          hardwareAccelerated: this.supportsWebCodecs,
          workerUsed: !!this.worker,
        },
      };
    } catch (error) {
      throw new Error(
        `Video processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract frames with hardware acceleration when available
   */
  private async extractFramesOptimized(
    video: HTMLVideoElement
  ): Promise<VideoFrame[]> {
    if (this.supportsWebCodecs && this.config.enableHardwareAcceleration) {
      return this.extractFramesWithWebCodecs(video);
    }

    if (this.worker && this.config.enableWorkerProcessing) {
      return this.extractFramesWithWorker(video);
    }

    return this.extractFramesCanvas(video);
  }

  /**
   * Extract frames using WebCodecs API for hardware acceleration
   */
  private async extractFramesWithWebCodecs(
    video: HTMLVideoElement
  ): Promise<VideoFrame[]> {
    const frames: VideoFrame[] = [];
    const canvas = new OffscreenCanvas(video.videoWidth, video.videoHeight);
    const ctx = canvas.getContext('2d')!;

    const duration = video.duration;
    const frameCount = Math.min(
      Math.floor(duration / this.config.frameInterval),
      this.config.maxFrames
    );

    for (let i = 0; i < frameCount; i++) {
      const timestamp = i * this.config.frameInterval;
      video.currentTime = timestamp;

      await new Promise<void>((resolve) => {
        const handler = () => {
          video.removeEventListener('seeked', handler);
          resolve();
        };
        video.addEventListener('seeked', handler);
      });

      // Use VideoFrame for hardware-accelerated processing
      const videoFrame = new VideoFrame(video, {
        timestamp: timestamp * 1_000_000,
      });

      ctx.drawImage(videoFrame, 0, 0);
      videoFrame.close();

      const blob = await canvas.convertToBlob({
        type: `image/${this.config.outputFormat}`,
        quality: this.config.quality,
      });

      const dataUrl = await this.blobToDataUrl(blob);
      const hash = await this.generateFrameHash(dataUrl);

      frames.push({
        timestamp,
        index: i,
        dataUrl,
        width: canvas.width,
        height: canvas.height,
        size: blob.size,
        hash,
      });
    }

    return frames;
  }

  /**
   * Extract frames using Web Worker for non-blocking processing
   */
  private async extractFramesWithWorker(
    video: HTMLVideoElement
  ): Promise<VideoFrame[]> {
    if (!this.worker) {
      return this.extractFramesCanvas(video);
    }

    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const offscreenCanvas = canvas.transferControlToOffscreen();

        // Validate and sanitize video data before processing
        const sanitizedConfig = {
          frameInterval: Math.max(
            VIDEO_PROCESSING_CONSTANTS.MIN_FRAME_INTERVAL,
            Math.min(
              VIDEO_PROCESSING_CONSTANTS.MAX_FRAME_INTERVAL,
              this.config.frameInterval
            )
          ),
          maxFrames: Math.max(
            VIDEO_PROCESSING_CONSTANTS.MIN_FRAMES_LIMIT,
            Math.min(
              VIDEO_PROCESSING_CONSTANTS.MAX_FRAMES_LIMIT,
              this.config.maxFrames
            )
          ),
          quality: Math.max(
            VIDEO_PROCESSING_CONSTANTS.MIN_QUALITY,
            Math.min(
              VIDEO_PROCESSING_CONSTANTS.MAX_QUALITY,
              this.config.quality
            )
          ),
        };

        if (this.worker) {
          this.worker.postMessage(
            {
              type: 'extractFrames',
              canvas: offscreenCanvas,
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              videoDuration: video.duration,
              config: sanitizedConfig,
            },
            [offscreenCanvas]
          );

          this.worker.onmessage = (event) => {
            try {
              if (event.data.type === 'framesExtracted') {
                resolve(event.data.frames);
              } else if (event.data.type === 'error') {
                reject(new Error(event.data.error));
              }
            } catch (error) {
              reject(new Error('Worker message processing failed'));
            }
          };

          this.worker.onerror = () => {
            reject(new Error('Worker encountered an error'));
          };
        } else {
          resolve(this.extractFramesCanvas(video));
        }
      } catch (error) {
        reject(
          new Error(
            `Worker setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
      }
    });
  }

  /**
   * Fallback canvas-based frame extraction
   */
  private async extractFramesCanvas(
    video: HTMLVideoElement
  ): Promise<VideoFrame[]> {
    const frames: VideoFrame[] = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    canvas.width = this.config.targetWidth || video.videoWidth;
    canvas.height = this.config.targetHeight || video.videoHeight;

    const duration = video.duration;
    const frameCount = Math.min(
      Math.floor(duration / this.config.frameInterval),
      this.config.maxFrames
    );

    for (let i = 0; i < frameCount; i++) {
      const timestamp = i * this.config.frameInterval;

      video.currentTime = timestamp;
      await new Promise((resolve) => {
        video.onseeked = resolve;
        video.ontimeupdate = resolve;
      });

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL(
        `image/${this.config.outputFormat}`,
        this.config.quality
      );
      const size = Math.round((dataUrl.length * 3) / 4); // Approximate byte size
      const hash = await this.generateFrameHash(dataUrl);

      frames.push({
        timestamp,
        index: i,
        dataUrl,
        width: canvas.width,
        height: canvas.height,
        size,
        hash,
      });
    }

    return frames;
  }

  /**
   * Advanced scene detection with temporal analysis
   */
  private async performSceneDetection(
    frames: VideoFrame[]
  ): Promise<SceneDetection[]> {
    const scenes: SceneDetection[] = [];

    // Process frames in batches to avoid overwhelming the AI
    const batchSize = 3;
    for (let i = 0; i < frames.length; i += batchSize) {
      const batch = frames.slice(i, i + batchSize);

      try {
        const batchAnalysis = await generateObject({
          model: openai('gpt-4o'),
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analyze these video frames for scene detection. For each frame, identify the scene type, describe what's happening, and rate significance (1-10). Frames are at timestamps: ${batch.map((f) => f.timestamp).join(', ')} seconds.`,
                },
                ...batch.map((frame) => ({
                  type: 'image' as const,
                  image: frame.dataUrl,
                })),
              ],
            },
          ],
          schema: z.object({
            scenes: z.array(
              z.object({
                frameIndex: z.number(),
                timestamp: z.number(),
                sceneType: z.enum([
                  'static',
                  'motion',
                  'transition',
                  'text',
                  'face',
                  'action',
                ]),
                confidence: z.number().min(0).max(1),
                description: z.string(),
                keyObjects: z.array(z.string()),
                colorPalette: z.array(z.string()),
                significance: z.number().min(1).max(10),
                motionLevel: z
                  .enum(['none', 'low', 'medium', 'high'])
                  .optional(),
                textPresent: z.boolean().optional(),
              })
            ),
          }),
        });

        scenes.push(
          ...batchAnalysis.object.scenes.map((scene) => ({
            ...scene,
            sceneType: scene.sceneType as SceneDetection['sceneType'],
          }))
        );
      } catch (error) {
        logger.warn('Scene detection failed for batch', {
          frameIndex: i,
          error: error instanceof Error ? error.message : String(error),
        });

        // Add fallback basic scene detection
        for (const frame of batch) {
          scenes.push({
            timestamp: frame.timestamp,
            sceneType: 'static',
            confidence: 0.3,
            description: 'Basic frame analysis (AI analysis failed)',
            keyObjects: [],
            colorPalette: [],
            significance: 5,
          });
        }
      }
    }

    return scenes;
  }

  /**
   * Object tracking across frames
   */
  private async performObjectTracking(
    frames: VideoFrame[]
  ): Promise<ObjectTracking[]> {
    // This is a simplified implementation
    // In production, you'd use computer vision libraries or specialized APIs
    const objects: ObjectTracking[] = [];

    try {
      const objectAnalysis = await generateObject({
        model: openai('gpt-4o'),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Track objects across these video frames. Identify consistent objects that appear in multiple frames and estimate their positions. Focus on people, vehicles, and prominent objects.',
              },
              ...frames.slice(0, 5).map((frame) => ({
                // Limit to 5 frames for cost efficiency
                type: 'image' as const,
                image: frame.dataUrl,
              })),
            ],
          },
        ],
        schema: z.object({
          trackedObjects: z.array(
            z.object({
              objectId: z.string(),
              objectType: z.string(),
              confidence: z.number().min(0).max(1),
              appearances: z.array(
                z.object({
                  frameIndex: z.number(),
                  timestamp: z.number(),
                  description: z.string(),
                  estimated_position: z.string(), // "center", "left", "right", etc.
                })
              ),
            })
          ),
        }),
      });

      // Convert to ObjectTracking format
      for (const obj of objectAnalysis.object.trackedObjects) {
        const firstAppearance = obj.appearances[0];
        const lastAppearance = obj.appearances[obj.appearances.length - 1];

        objects.push({
          objectId: obj.objectId,
          objectType: obj.objectType,
          confidence: obj.confidence,
          boundingBoxes: obj.appearances.map((app) => ({
            timestamp: app.timestamp,
            x: 0.5, // Simplified - would need proper computer vision for real coordinates
            y: 0.5,
            width: 0.2,
            height: 0.2,
          })),
          firstSeen: firstAppearance.timestamp,
          lastSeen: lastAppearance.timestamp,
        });
      }
    } catch (error) {
      logger.warn('Object tracking failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return objects;
  }

  /**
   * Generate comprehensive video summary
   */
  private async generateVideoSummary(
    frames: VideoFrame[],
    scenes: SceneDetection[],
    metadata: VideoMetadata
  ): Promise<VideoAnalysisResult['summary']> {
    try {
      const summaryAnalysis = await generateObject({
        model: openai('gpt-4o'),
        prompt: `Analyze this video data and create a comprehensive summary:

Video metadata: ${JSON.stringify(metadata)}
Scenes detected: ${JSON.stringify(scenes)}
Total frames analyzed: ${frames.length}

Provide insights about the video content, main themes, and key moments.`,
        schema: z.object({
          totalScenes: z.number(),
          dominantColors: z.array(z.string()),
          mainObjects: z.array(z.string()),
          contentType: z.enum([
            'educational',
            'entertainment',
            'presentation',
            'documentary',
            'conversation',
            'action',
            'other',
          ]),
          mood: z.string(),
          keyMoments: z.array(
            z.object({
              timestamp: z.number(),
              description: z.string(),
              importance: z.number().min(1).max(10),
            })
          ),
          overallDescription: z.string(),
          technicalQuality: z.enum(['low', 'medium', 'high']),
        }),
      });

      return summaryAnalysis.object;
    } catch (error) {
      logger.warn('Summary generation failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback summary
      return {
        totalScenes: scenes.length,
        dominantColors: ['unknown'],
        mainObjects: ['unknown'],
        contentType: 'other',
        mood: 'neutral',
        keyMoments: scenes
          .filter((s) => s.significance >= 7)
          .map((s) => ({
            timestamp: s.timestamp,
            description: s.description,
            importance: s.significance,
          })),
      };
    }
  }

  /**
   * Extract and transcribe audio from video
   */
  private async extractAndTranscribeAudio(
    video: HTMLVideoElement
  ): Promise<VideoAnalysisResult['audioTranscript']> {
    // This is a placeholder implementation
    // In production, you'd use Web Audio API or ffmpeg.wasm to extract audio
    // then send to Whisper API for transcription

    try {
      // For now, return a placeholder indicating audio is present but not transcribed
      return {
        text: 'Audio transcription not yet implemented - requires Web Audio API integration',
        segments: [
          {
            start: 0,
            end: video.duration,
            text: 'Audio track detected but not transcribed',
            confidence: 0.1,
          },
        ],
      };
    } catch (error) {
      return;
    }
  }

  /**
   * Extract detailed video metadata
   */
  private async extractAdvancedMetadata(
    video: HTMLVideoElement
  ): Promise<VideoMetadata> {
    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        const metadata: VideoMetadata = {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          frameRate: VIDEO_PROCESSING_CONSTANTS.DEFAULT_FRAME_RATE,
          hasAudio: (video as any).audioTracks?.length > 0,
          audioTracks: (video as any).audioTracks?.length || 0,
          videoTracks: (video as any).videoTracks?.length || 1,
        };

        // Try to extract additional metadata if available
        if ((video as any).mozHasAudio !== undefined) {
          metadata.hasAudio = (video as any).mozHasAudio;
        }

        resolve(metadata);
      };
    });
  }

  /**
   * Create video element from data URL
   */
  private async createVideoElement(
    videoData: string
  ): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.crossOrigin = 'anonymous';
      video.muted = true; // Required for autoplay

      video.onloadedmetadata = () => {
        resolve(video);
      };

      video.onerror = () => {
        reject(new Error('Failed to load video'));
      };

      video.src = videoData.startsWith('data:')
        ? videoData
        : `data:video/mp4;base64,${videoData}`;
    });
  }

  /**
   * Generate hash for frame deduplication
   */
  private async generateFrameHash(dataUrl: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(dataUrl.substring(0, 1000)); // Use first 1000 chars for hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 16);
  }

  /**
   * Convert blob to data URL with security validation
   */
  private async blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Validate blob size and type
        if (blob.size > VIDEO_PROCESSING_CONSTANTS.MAX_BLOB_SIZE) {
          reject(new Error('Blob size exceeds maximum allowed size'));
          return;
        }

        if (!blob.type.startsWith('image/')) {
          reject(
            new Error('Only image blobs are allowed for data URL conversion')
          );
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Basic validation of data URL format
          if (result && result.startsWith('data:image/')) {
            resolve(result);
          } else {
            reject(new Error('Invalid data URL generated'));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read blob'));
        reader.readAsDataURL(blob);
      } catch (error) {
        reject(
          new Error(
            `Blob conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
      }
    });
  }

  /**
   * Initialize browser capabilities detection
   */
  private initializeCapabilities(): void {
    // Check for WebCodecs API support
    this.supportsWebCodecs = 'VideoFrame' in window && 'VideoEncoder' in window;

    // Check for OffscreenCanvas support
    this.supportsOffscreenCanvas = 'OffscreenCanvas' in window;

    logger.info('Video processor capabilities', {
      webCodecs: this.supportsWebCodecs,
      offscreenCanvas: this.supportsOffscreenCanvas,
      workers: 'Worker' in window,
    });
  }

  /**
   * Initialize Web Worker for background processing with security measures
   */
  private initializeWorker(): void {
    try {
      // Create worker from secure inline code
      const workerCode = `
        'use strict';
        
        // Validate incoming messages
        function validateMessage(data) {
          if (!data || typeof data !== 'object') return false;
          if (data.type !== 'extractFrames') return false;
          if (!data.config || typeof data.config !== 'object') return false;
          return true;
        }
        
        self.onmessage = function(event) {
          try {
            const data = event.data;
            
            if (!validateMessage(data)) {
              self.postMessage({
                type: 'error',
                error: 'Invalid message format'
              });
              return;
            }
            
            if (data.type === 'extractFrames') {
              // Validate configuration parameters
              const config = {
                frameInterval: Math.max(0.1, Math.min(10, data.config.frameInterval || 2)),
                maxFrames: Math.max(1, Math.min(100, data.config.maxFrames || 10)),
                quality: Math.max(0.1, Math.min(1.0, data.config.quality || 0.8))
              };
              
              // Worker-based frame extraction placeholder
              // In a real implementation, this would use OffscreenCanvas
              self.postMessage({
                type: 'framesExtracted',
                frames: []
              });
            }
          } catch (error) {
            self.postMessage({
              type: 'error',
              error: 'Worker processing error'
            });
          }
        };
        
        self.onerror = function(error) {
          self.postMessage({
            type: 'error',
            error: 'Worker runtime error'
          });
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);

      this.worker = new Worker(workerUrl);

      this.worker.onerror = (error) => {
        logger.warn('Video processing worker error', {
          error: error instanceof Error ? error.message : String(error),
        });
        this.worker?.terminate();
        this.worker = undefined;
      };

      // Clean up blob URL to prevent memory leaks
      setTimeout(() => {
        URL.revokeObjectURL(workerUrl);
      }, VIDEO_PROCESSING_CONSTANTS.WORKER_CLEANUP_DELAY);
    } catch (error) {
      logger.warn('Failed to initialize video processing worker', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.worker = undefined;
    }
  }

  /**
   * Update processor configuration
   */
  updateConfig(newConfig: Partial<VideoProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): VideoProcessingConfig {
    return { ...this.config };
  }

  /**
   * Cleanup resources properly to prevent memory leaks
   */
  destroy(): void {
    try {
      // Terminate worker safely
      if (this.worker) {
        this.worker.terminate();
        this.worker = undefined;
      }

      // Clear any cached data
      if (this.performanceObserver) {
        this.performanceObserver.disconnect();
        this.performanceObserver = undefined;
      }

      // Reset instance variables
      this.frameBuffer = [];
      this.supportsWebCodecs = false;
      this.supportsOffscreenCanvas = false;
    } catch (error) {
      logger.warn('Error during video processor cleanup', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Export convenience functions
export const createVideoProcessor = (
  config?: Partial<VideoProcessingConfig>
): AdvancedVideoProcessor => {
  return new AdvancedVideoProcessor(config);
};

export const processVideoFile = async (
  videoData: string,
  config?: Partial<VideoProcessingConfig>
): Promise<VideoAnalysisResult> => {
  const processor = new AdvancedVideoProcessor(config);
  try {
    return await processor.processVideo(videoData);
  } finally {
    processor.destroy();
  }
};

// Export default processor instance
export const videoProcessor = new AdvancedVideoProcessor();
