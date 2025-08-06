import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { createLogger } from '../../logger/unified-logger';

// Create AI streaming processor logger
const logger = createLogger({ service: 'ai-streaming-processor' });

// Configuration constants for streaming
const STREAMING_CONSTANTS = {
  DEFAULT_FRAME_RATE: 30,
  DEFAULT_VIDEO_BITRATE: 2_500_000, // 2.5 Mbps
  DEFAULT_AUDIO_BITRATE: 128_000, // 128 kbps
  DEFAULT_ANALYSIS_INTERVAL: 1, // seconds
  DEFAULT_BUFFER_SIZE: 10,
  DEFAULT_TARGET_LATENCY: 100, // ms
  FRAME_SIZE_LIMIT: 5 * 1024 * 1024, // 5MB
  ANALYSIS_TIMEOUT: 10_000, // 10 seconds
  CHUNK_SIZE: 100, // ms for MediaRecorder
} as const;

// Streaming configuration
export interface StreamingConfig {
  frameRate: number; // frames per second to capture
  videoBitsPerSecond: number;
  audioBitsPerSecond: number;
  mimeType: string;
  analysisInterval: number; // seconds between AI analysis
  bufferSize: number; // number of frames to buffer
  enableLowLatency: boolean;
  enableAdaptiveBitrate: boolean;
  targetLatency: number; // milliseconds
  enableRealtimeAnalysis: boolean;
  enableEdgeProcessing: boolean;
}

// Stream quality metrics
export interface StreamQuality {
  currentBitrate: number;
  averageLatency: number;
  framesDropped: number;
  totalFrames: number;
  networkCondition: 'excellent' | 'good' | 'fair' | 'poor';
  cpuUsage: number;
  memoryUsage: number;
}

// Real-time analysis result
export interface RealtimeAnalysisResult {
  timestamp: number;
  frameData: string;
  analysis: {
    scene: string;
    objects: string[];
    motion: 'none' | 'low' | 'medium' | 'high';
    text?: string;
    faces?: number;
    confidence: number;
  };
  audioLevel?: number;
  transcriptSegment?: string;
}

// Stream event types with enhanced type safety
export type StreamEvent =
  | { type: 'started'; streamId: string }
  | { type: 'stopped'; streamId: string }
  | { type: 'error'; error: string }
  | { type: 'frame'; data: RealtimeAnalysisResult }
  | { type: 'quality'; metrics: StreamQuality }
  | { type: 'transcript'; text: string; timestamp: number };

// Tool renderer signature for streaming tools
export type StreamingToolRenderer<TParams = any, TResult = any> = (
  params: TParams,
  context: {
    toolName: string;
    toolCallId: string;
    streamId: string;
    timestamp: number;
  }
) => AsyncGenerator<any, TResult, void>;

// Enhanced streaming tool definition
export interface StreamingToolDefinition<TParams = any, TResult = any> {
  description: string;
  parameters: any; // Zod schema or parameter object
  renderer: StreamingToolRenderer<TParams, TResult>;
  metadata?: {
    category?: string;
    priority?: 'high' | 'medium' | 'low';
    timeout?: number;
    retryable?: boolean;
  };
}

/**
 * Real-time Streaming Processor with WebRTC and MediaRecorder
 */
export class RealtimeStreamingProcessor {
  private config: StreamingConfig;
  private mediaRecorder?: MediaRecorder;
  private webRTCConnection?: RTCPeerConnection;
  private stream?: MediaStream;
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D;
  private videoElement?: HTMLVideoElement;

  // Analysis state
  private analysisWorker?: Worker;
  private frameBuffer: ImageData[] = [];
  private lastAnalysisTime = 0;
  private streamMetrics: StreamQuality = {
    currentBitrate: 0,
    averageLatency: 0,
    framesDropped: 0,
    totalFrames: 0,
    networkCondition: 'excellent',
    cpuUsage: 0,
    memoryUsage: 0,
  };

  // Event handling
  private eventListeners: Map<string, ((event: StreamEvent) => void)[]> =
    new Map();
  private streamId = '';

  // Performance monitoring
  private performanceObserver?: PerformanceObserver;
  private latencyMeasurements: number[] = [];

  constructor(config?: Partial<StreamingConfig>) {
    this.config = {
      frameRate: STREAMING_CONSTANTS.DEFAULT_FRAME_RATE,
      videoBitsPerSecond: STREAMING_CONSTANTS.DEFAULT_VIDEO_BITRATE,
      audioBitsPerSecond: STREAMING_CONSTANTS.DEFAULT_AUDIO_BITRATE,
      mimeType: 'video/webm;codecs=vp9,opus',
      analysisInterval: STREAMING_CONSTANTS.DEFAULT_ANALYSIS_INTERVAL,
      bufferSize: STREAMING_CONSTANTS.DEFAULT_BUFFER_SIZE,
      enableLowLatency: true,
      enableAdaptiveBitrate: true,
      targetLatency: STREAMING_CONSTANTS.DEFAULT_TARGET_LATENCY,
      enableRealtimeAnalysis: true,
      enableEdgeProcessing: true,
      ...config,
    };

    this.initializePerformanceMonitoring();
    this.initializeAnalysisWorker();
  }

  /**
   * Start real-time streaming from camera/screen
   */
  async startStream(constraints: MediaStreamConstraints = {}): Promise<string> {
    try {
      this.streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Get user media with optimized constraints
      const defaultConstraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: this.config.frameRate },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48_000,
        },
      };

      this.stream = await navigator.mediaDevices.getUserMedia({
        ...defaultConstraints,
        ...constraints,
      });

      // Setup video element for frame capture
      await this.setupVideoCapture();

      // Initialize MediaRecorder for recording
      await this.initializeRecorder();

      // Start real-time analysis if enabled
      if (this.config.enableRealtimeAnalysis) {
        this.startRealtimeAnalysis();
      }

      // Setup adaptive bitrate if enabled
      if (this.config.enableAdaptiveBitrate) {
        this.startAdaptiveBitrate();
      }

      this.emit({ type: 'started', streamId: this.streamId });
      return this.streamId;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown streaming error';
      this.emit({ type: 'error', error: errorMessage });
      throw new Error(`Failed to start stream: ${errorMessage}`);
    }
  }

  /**
   * Start screen sharing stream
   */
  async startScreenShare(): Promise<string> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });

      return this.startStream({ video: false, audio: false }).then(() => {
        // Replace video track with screen share
        const videoTrack = stream.getVideoTracks()[0];
        const sender = this.webRTCConnection
          ?.getSenders()
          .find((s) => s.track?.kind === 'video');

        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
        }

        return this.streamId;
      });
    } catch (error) {
      throw new Error(
        `Failed to start screen share: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Stop streaming and cleanup
   */
  async stopStream(): Promise<void> {
    try {
      // Stop media recorder
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      // Close WebRTC connection
      if (this.webRTCConnection) {
        this.webRTCConnection.close();
      }

      // Stop all media tracks
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
      }

      // Cleanup analysis worker
      if (this.analysisWorker) {
        this.analysisWorker.terminate();
      }

      // Reset state
      this.frameBuffer = [];
      this.lastAnalysisTime = 0;

      this.emit({ type: 'stopped', streamId: this.streamId });
    } catch (error) {
      this.emit({
        type: 'error',
        error: `Stop stream failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  /**
   * Create WebRTC peer connection for low-latency streaming
   */
  async createPeerConnection(
    iceServers: RTCIceServer[] = []
  ): Promise<RTCPeerConnection> {
    const configuration: RTCConfiguration = {
      iceServers:
        iceServers.length > 0
          ? iceServers
          : [{ urls: 'stun:stun.l.google.com:19302' }],
      // Enable low-latency optimizations
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    };

    this.webRTCConnection = new RTCPeerConnection(configuration);

    // Add stream tracks
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        this.webRTCConnection!.addTrack(track, this.stream!);
      });
    }

    // Monitor connection state
    this.webRTCConnection.onconnectionstatechange = () => {
      const state = this.webRTCConnection!.connectionState;
      if (state === 'failed' || state === 'disconnected') {
        this.emit({ type: 'error', error: `WebRTC connection ${state}` });
      }
    };

    // Monitor ICE connection state
    this.webRTCConnection.oniceconnectionstatechange = () => {
      const state = this.webRTCConnection!.iceConnectionState;
      this.updateNetworkCondition(state);
    };

    return this.webRTCConnection;
  }

  /**
   * Process live stream frame for analysis with comprehensive error handling
   * Enhanced with streaming tool renderer compatibility
   */
  async processLiveFrame(): Promise<RealtimeAnalysisResult | null> {
    try {
      // Comprehensive null checks
      if (!(this.videoElement && this.canvas && this.ctx)) {
        logger.warn('Video processing components not initialized');
        return null;
      }

      // Check if video element is in a valid state
      if (this.videoElement.readyState < 2) {
        logger.debug('Video not ready for frame capture');
        return null;
      }

      const now = Date.now();
      if (now - this.lastAnalysisTime < this.config.analysisInterval * 1000) {
        return null; // Too soon for next analysis
      }

      // Validate canvas dimensions
      if (this.canvas.width <= 0 || this.canvas.height <= 0) {
        logger.warn('Invalid canvas dimensions');
        return null;
      }

      // Capture frame from video with error handling
      try {
        this.ctx.drawImage(
          this.videoElement,
          0,
          0,
          this.canvas.width,
          this.canvas.height
        );
      } catch (drawError) {
        logger.warn('Failed to draw video frame to canvas', {
          error: drawError instanceof Error ? drawError.message : String(drawError),
        });
        return null;
      }

      // Generate frame data with size limit
      const frameData = this.canvas.toDataURL('image/jpeg', 0.8);
      if (frameData.length > STREAMING_CONSTANTS.FRAME_SIZE_LIMIT) {
        logger.warn('Frame data too large, skipping analysis');
        return null;
      }

      // Perform AI analysis with timeout
      let analysis: RealtimeAnalysisResult['analysis'];
      try {
        analysis = await Promise.race([
          this.analyzeFrame(frameData),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error('Analysis timeout')),
              STREAMING_CONSTANTS.ANALYSIS_TIMEOUT
            )
          ),
        ]);
      } catch (analysisError) {
        logger.warn('Frame analysis failed', {
          error: analysisError instanceof Error ? analysisError.message : String(analysisError),
        });
        analysis = {
          scene: 'analysis_failed',
          objects: [],
          motion: 'none',
          confidence: 0.1,
        };
      }

      // Get audio level with error handling
      let audioLevel: number;
      try {
        audioLevel = await this.getAudioLevel();
      } catch (audioError) {
        logger.debug('Audio level detection failed', {
          error: audioError instanceof Error ? audioError.message : String(audioError),
        });
        audioLevel = 0;
      }

      this.lastAnalysisTime = now;
      this.streamMetrics.totalFrames++;

      const result: RealtimeAnalysisResult = {
        timestamp: now,
        frameData,
        analysis,
        audioLevel,
      };

      this.emit({ type: 'frame', data: result });
      return result;
    } catch (error) {
      logger.error('Live frame processing encountered unexpected error', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.emit({
        type: 'error',
        error: `Frame processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      return null;
    }
  }

  /**
   * Add event listener with type safety
   */
  addEventListener<T extends StreamEvent['type']>(
    eventType: T,
    callback: (event: Extract<StreamEvent, { type: T }>) => void
  ): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners
      .get(eventType)!
      .push(callback as (event: StreamEvent) => void);
  }

  /**
   * Execute streaming tool with proper renderer signature
   */
  async executeStreamingTool<TParams, TResult>(
    toolName: string,
    params: TParams,
    toolDefinition: StreamingToolDefinition<TParams, TResult>
  ): Promise<TResult> {
    const toolCallId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const context = {
      toolName,
      toolCallId,
      streamId: this.streamId,
      timestamp: Date.now(),
    };

    this.emit({
      type: 'frame',
      data: {
        timestamp: context.timestamp,
        frameData: '',
        analysis: {
          scene: `Executing tool: ${toolName}`,
          objects: [],
          motion: 'none',
          confidence: 1.0,
        },
      },
    });

    try {
      const renderer = toolDefinition.renderer(params, context);
      let finalResult: TResult;

      for await (const partial of renderer) {
        // Emit partial results as frame events
        this.emit({
          type: 'frame',
          data: {
            timestamp: Date.now(),
            frameData: JSON.stringify(partial),
            analysis: {
              scene: `Tool ${toolName} progress`,
              objects: [toolName],
              motion: 'low',
              confidence: 0.8,
            },
          },
        });
        finalResult = partial;
      }

      return finalResult!;
    } catch (error) {
      this.emit({
        type: 'error',
        error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      throw error;
    }
  }

  /**
   * Remove event listener with type safety
   */
  removeEventListener<T extends StreamEvent['type']>(
    eventType: T,
    callback: (event: Extract<StreamEvent, { type: T }>) => void
  ): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback as (event: StreamEvent) => void);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Get current stream metrics
   */
  getStreamMetrics(): StreamQuality {
    return { ...this.streamMetrics };
  }

  /**
   * Update streaming configuration
   */
  updateConfig(newConfig: Partial<StreamingConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Apply config changes to active components
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      // Would need to restart recorder with new settings
    }
  }

  // Private methods

  private async setupVideoCapture(): Promise<void> {
    if (!this.stream) return;

    this.videoElement = document.createElement('video');
    this.videoElement.srcObject = this.stream;
    this.videoElement.autoplay = true;
    this.videoElement.muted = true;

    // Wait for video to be ready
    await new Promise<void>((resolve) => {
      this.videoElement!.onloadedmetadata = () => resolve();
    });

    // Create canvas for frame capture
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.videoElement.videoWidth;
    this.canvas.height = this.videoElement.videoHeight;
    this.ctx = this.canvas.getContext('2d')!;
  }

  private async initializeRecorder(): Promise<void> {
    if (!this.stream) {
      throw new Error('No stream available for recording');
    }

    try {
      const options: MediaRecorderOptions = {
        mimeType: this.config.mimeType,
        videoBitsPerSecond: this.config.videoBitsPerSecond,
        audioBitsPerSecond: this.config.audioBitsPerSecond,
      };

      // Validate MediaRecorder support for the specified MIME type
      if (
        options.mimeType &&
        !MediaRecorder.isTypeSupported(options.mimeType)
      ) {
        logger.warn('MIME type not supported, falling back to default', {
          mimeType: options.mimeType,
        });
        delete options.mimeType;
      }

      this.mediaRecorder = new MediaRecorder(this.stream, options);

      this.mediaRecorder.ondataavailable = (event) => {
        try {
          if (event.data && event.data.size > 0) {
            this.processRecordedChunk(event.data);
          }
        } catch (error) {
          logger.error('Error processing recorded chunk', {
            error: error instanceof Error ? error.message : String(error),
          });
          this.emit({
            type: 'error',
            error: `Chunk processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      };

      this.mediaRecorder.onerror = (event) => {
        logger.error('MediaRecorder error', {
          error: event instanceof Error ? event.message : String(event),
        });
        this.emit({ type: 'error', error: `MediaRecorder error: ${event}` });
      };

      this.mediaRecorder.onstart = () => {
        logger.debug('MediaRecorder started successfully');
      };

      this.mediaRecorder.onstop = () => {
        logger.debug('MediaRecorder stopped');
      };

      this.mediaRecorder.onpause = () => {
        logger.debug('MediaRecorder paused');
      };

      this.mediaRecorder.onresume = () => {
        logger.debug('MediaRecorder resumed');
      };

      // Start recording in small chunks for low latency
      this.mediaRecorder.start(STREAMING_CONSTANTS.CHUNK_SIZE);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown MediaRecorder initialization error';
      logger.error('Failed to initialize MediaRecorder', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.emit({
        type: 'error',
        error: `MediaRecorder initialization failed: ${errorMessage}`,
      });
      throw new Error(`MediaRecorder initialization failed: ${errorMessage}`);
    }
  }

  private async analyzeFrame(
    frameData: string
  ): Promise<RealtimeAnalysisResult['analysis']> {
    try {
      const analysis = await generateObject({
        model: openai('gpt-4o-mini'), // Use faster model for real-time
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Quickly analyze this live video frame. Identify main scene, objects, motion level, and any text. Be concise for real-time processing.',
              },
              {
                type: 'image',
                image: frameData || '',
              },
            ],
          },
        ],
        schema: z.object({
          scene: z.string().max(50),
          objects: z.array(z.string()).max(5),
          motion: z.enum(['none', 'low', 'medium', 'high']),
          text: z.string().optional(),
          faces: z.number().min(0).max(20).optional(),
          confidence: z.number().min(0).max(1),
        }),
      });

      return analysis.object;
    } catch (error) {
      // Fallback minimal analysis
      return {
        scene: 'analysis_failed',
        objects: [],
        motion: 'none',
        confidence: 0.1,
      };
    }
  }

  private async getAudioLevel(): Promise<number> {
    if (!this.stream) return 0;

    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(this.stream);
      const analyser = audioContext.createAnalyser();

      source.connect(analyser);
      analyser.fftSize = 256;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);

      // Calculate average audio level
      const average =
        dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      return average / 255; // Normalize to 0-1
    } catch (error) {
      return 0;
    }
  }

  private startRealtimeAnalysis(): void {
    const analysisLoop = async () => {
      if (this.stream && this.config.enableRealtimeAnalysis) {
        await this.processLiveFrame();
        setTimeout(analysisLoop, this.config.analysisInterval * 1000);
      }
    };

    analysisLoop();
  }

  private startAdaptiveBitrate(): void {
    setInterval(() => {
      this.adjustBitrateBasedOnConditions();
    }, 5000); // Check every 5 seconds
  }

  private adjustBitrateBasedOnConditions(): void {
    const { networkCondition, averageLatency } = this.streamMetrics;

    let bitrateMultiplier = 1.0;

    switch (networkCondition) {
      case 'poor':
        bitrateMultiplier = 0.5;
        break;
      case 'fair':
        bitrateMultiplier = 0.7;
        break;
      case 'good':
        bitrateMultiplier = 0.9;
        break;
      case 'excellent':
        bitrateMultiplier = 1.0;
        break;
    }

    // Adjust based on latency
    if (averageLatency > this.config.targetLatency * 2) {
      bitrateMultiplier *= 0.8;
    }

    const newBitrate = this.config.videoBitsPerSecond * bitrateMultiplier;
    this.streamMetrics.currentBitrate = newBitrate;

    // Apply new bitrate (would need MediaRecorder restart in practice)
  }

  private updateNetworkCondition(iceState: RTCIceConnectionState): void {
    switch (iceState) {
      case 'connected':
        this.streamMetrics.networkCondition = 'excellent';
        break;
      case 'checking':
        this.streamMetrics.networkCondition = 'good';
        break;
      case 'failed':
      case 'disconnected':
        this.streamMetrics.networkCondition = 'poor';
        break;
      default:
        this.streamMetrics.networkCondition = 'fair';
    }
  }

  private processRecordedChunk(data: Blob): void {
    // Process recorded data chunks for additional analysis or storage
    // This could include sending to backend, local storage, etc.
  }

  private initializePerformanceMonitoring(): void {
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'measure') {
            this.latencyMeasurements.push(entry.duration);
            if (this.latencyMeasurements.length > 100) {
              this.latencyMeasurements.shift(); // Keep last 100 measurements
            }

            // Update average latency
            this.streamMetrics.averageLatency =
              this.latencyMeasurements.reduce((sum, val) => sum + val, 0) /
              this.latencyMeasurements.length;
          }
        });
      });

      this.performanceObserver.observe({ entryTypes: ['measure'] });
    }
  }

  private initializeAnalysisWorker(): void {
    if (!this.config.enableEdgeProcessing) return;

    try {
      const workerCode = `
        self.onmessage = function(event) {
          const { type, frameData } = event.data;
          
          if (type === 'analyzeFrame') {
            // Edge processing would go here
            // For now, just echo back
            self.postMessage({
              type: 'frameAnalyzed',
              result: {
                processed: true,
                timestamp: Date.now()
              }
            });
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.analysisWorker = new Worker(URL.createObjectURL(blob));
    } catch (error) {
      logger.warn('Failed to initialize analysis worker', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private emit(event: StreamEvent): void {
    const listeners = this.eventListeners.get(event.type) || [];
    listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        logger.error('Event listener error', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // Also emit on 'all' listeners
    const allListeners = this.eventListeners.get('all') || [];
    allListeners.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        logger.error('Universal event listener error', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }
}

// Export convenience functions
export const createStreamingProcessor = (
  config?: Partial<StreamingConfig>
): RealtimeStreamingProcessor => {
  return new RealtimeStreamingProcessor(config);
};

export const startCameraStream = async (
  config?: Partial<StreamingConfig>
): Promise<string> => {
  const processor = new RealtimeStreamingProcessor(config);
  return processor.startStream();
};

export const startScreenShareStream = async (
  config?: Partial<StreamingConfig>
): Promise<string> => {
  const processor = new RealtimeStreamingProcessor(config);
  return processor.startScreenShare();
};

// Export default processor instance
export const streamingProcessor = new RealtimeStreamingProcessor();
