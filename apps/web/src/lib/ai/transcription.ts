import { openai } from '@ai-sdk/openai';

// Constants for transcription
const DEFAULT_MODEL = 'whisper-1';
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const SUPPORTED_FORMATS = [
  'mp3',
  'mp4',
  'mpeg',
  'mpga',
  'm4a',
  'wav',
  'webm',
  'ogg',
  'flac',
] as const;
const DEFAULT_LANGUAGE = 'en';
const DEFAULT_TEMPERATURE = 0;
const MAX_PROMPT_LENGTH = 224; // Whisper's limit for prompts

// Type definitions
export type AudioFormat = (typeof SUPPORTED_FORMATS)[number];

export interface TranscriptionOptions {
  /** Language of the audio (ISO 639-1) */
  language?: string;
  /** Optional prompt to guide the transcription */
  prompt?: string;
  /** Sampling temperature (0-1) */
  temperature?: number;
  /** Response format */
  responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
}

export interface TranscriptionResult {
  /** Transcribed text */
  text: string;
  /** Language detected or specified */
  language?: string;
  /** Duration of the audio in seconds */
  duration?: number;
  /** Segments with timestamps (if verbose_json format) */
  segments?: Array<{
    id: number;
    seek: number;
    start: number;
    end: number;
    text: string;
    tokens: number[];
    temperature: number;
    avg_logprob: number;
    compression_ratio: number;
    no_speech_prob: number;
  }>;
  /** Words with timestamps (if available) */
  words?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
}

/**
 * Validate audio file and options
 * @param audioData Audio data to validate
 * @param filename Filename to check format
 * @param options Transcription options
 * @throws Error if validation fails
 */
function validateTranscriptionParams(
  audioData: Uint8Array | string | File | Blob,
  filename: string,
  options: TranscriptionOptions
): void {
  // Check file format
  const extension = filename.split('.').pop()?.toLowerCase();
  if (!(extension && SUPPORTED_FORMATS.includes(extension as AudioFormat))) {
    throw new Error(
      `Unsupported audio format. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`
    );
  }

  // Check file size
  let size = 0;
  if (audioData instanceof Uint8Array) {
    size = audioData.length;
  } else if (audioData instanceof File || audioData instanceof Blob) {
    size = audioData.size;
  } else if (typeof audioData === 'string') {
    // Base64 string - estimate size
    size = (audioData.length * 3) / 4;
  }

  if (size > MAX_FILE_SIZE) {
    throw new Error(
      `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
    );
  }

  // Validate options
  if (
    options.temperature !== undefined &&
    (options.temperature < 0 || options.temperature > 1)
  ) {
    throw new Error('Temperature must be between 0 and 1');
  }

  if (options.prompt && options.prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error(
      `Prompt too long. Maximum length is ${MAX_PROMPT_LENGTH} characters`
    );
  }

  if (options.language && options.language.length !== 2) {
    throw new Error('Language must be a 2-letter ISO 639-1 code');
  }
}

/**
 * Sanitize transcription prompt
 * @param prompt Input prompt
 * @returns Sanitized prompt
 */
function sanitizeTranscriptionPrompt(prompt: string): string {
  if (!prompt) return '';

  // Remove potentially problematic content
  let sanitized = prompt
    .replace(/[<>{}[\]]/g, '') // Remove brackets and braces
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();

  // Truncate if too long
  if (sanitized.length > MAX_PROMPT_LENGTH) {
    sanitized = sanitized.substring(0, MAX_PROMPT_LENGTH);
  }

  return sanitized;
}

/**
 * Transcribe audio to text using AI SDK 5.0
 * @param audioData Audio data as Uint8Array, base64 string, File, or Blob
 * @param filename Filename with extension to determine format
 * @param options Transcription options
 * @returns Promise resolving to transcription result
 */
export async function transcribeAudio(
  audioData: Uint8Array | string | File | Blob,
  filename: string,
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> {
  // Set defaults
  const {
    language,
    prompt,
    temperature = DEFAULT_TEMPERATURE,
    responseFormat = 'json',
  } = options;

  // Validate parameters
  validateTranscriptionParams(audioData, filename, options);

  // Sanitize prompt if provided
  const sanitizedPrompt = prompt
    ? sanitizeTranscriptionPrompt(prompt)
    : undefined;

  try {
    // Note: This is a placeholder for AI SDK 5.0 transcription
    // The actual implementation would use experimental_transcribe
    // TODO: Replace with actual AI SDK 5.0 implementation when available

    const transcriptionModel = openai.transcription(DEFAULT_MODEL);

    // Convert audio data to appropriate format
    let audioInput: Uint8Array;
    if (audioData instanceof Uint8Array) {
      audioInput = audioData;
    } else if (typeof audioData === 'string') {
      // Assume base64 string
      const binaryString = atob(audioData);
      audioInput = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        audioInput[i] = binaryString.charCodeAt(i);
      }
    } else if (audioData instanceof File || audioData instanceof Blob) {
      const arrayBuffer = await audioData.arrayBuffer();
      audioInput = new Uint8Array(arrayBuffer);
    } else {
      throw new Error('Invalid audio data format');
    }

    // This would be the actual implementation with AI SDK 5.0:
    // const result = await experimental_transcribe({
    //   model: transcriptionModel,
    //   audio: audioInput,
    //   language,
    //   prompt: sanitizedPrompt,
    //   temperature,
    //   responseFormat
    // })

    // Placeholder response - actual implementation pending
    const mockTranscription: TranscriptionResult = {
      text: `[Placeholder] Transcription feature not yet implemented. Audio file: ${filename}`,
      language: language || 'en',
      duration: 0,
    };

    if (responseFormat === 'verbose_json') {
      mockTranscription.segments = [
        {
          id: 0,
          seek: 0,
          start: 0,
          end: 10.5,
          text: mockTranscription.text,
          tokens: [1, 2, 3],
          temperature: 0,
          avg_logprob: -0.5,
          compression_ratio: 1.2,
          no_speech_prob: 0.01,
        },
      ];
    }

    return mockTranscription;
  } catch (error) {
    console.error('Transcription failed:', error);
    throw new Error(
      `Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Transcribe audio from URL
 * @param audioUrl URL of the audio file
 * @param options Transcription options
 * @returns Promise resolving to transcription result
 */
export async function transcribeAudioFromURL(
  audioUrl: string,
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> {
  try {
    // Fetch audio file
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }

    const blob = await response.blob();

    // Extract filename from URL or use default
    const urlParts = audioUrl.split('/');
    const filename = urlParts[urlParts.length - 1] || 'audio.mp3';

    return transcribeAudio(blob, filename, options);
  } catch (error) {
    console.error('Failed to transcribe from URL:', error);
    throw new Error(
      `Failed to transcribe from URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Transcription service for managing multiple operations
 */
export class TranscriptionService {
  private static instance: TranscriptionService;
  private activeTranscriptions = new Map<string, AbortController>();

  private constructor() {}

  static getInstance(): TranscriptionService {
    if (!TranscriptionService.instance) {
      TranscriptionService.instance = new TranscriptionService();
    }
    return TranscriptionService.instance;
  }

  /**
   * Transcribe with cancellation support
   * @param id Unique identifier for this transcription
   * @param audioData Audio data
   * @param filename Filename
   * @param options Transcription options
   * @returns Promise resolving to transcription result
   */
  async transcribeWithCancellation(
    id: string,
    audioData: Uint8Array | string | File | Blob,
    filename: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    // Cancel existing transcription with same ID
    if (this.activeTranscriptions.has(id)) {
      this.cancel(id);
    }

    const abortController = new AbortController();
    this.activeTranscriptions.set(id, abortController);

    try {
      // In the real implementation, we would pass the abort signal
      const result = await transcribeAudio(audioData, filename, options);
      return result;
    } finally {
      this.activeTranscriptions.delete(id);
    }
  }

  /**
   * Cancel transcription
   * @param id Transcription ID to cancel
   */
  cancel(id: string): void {
    const controller = this.activeTranscriptions.get(id);
    if (controller) {
      controller.abort();
      this.activeTranscriptions.delete(id);
    }
  }

  /**
   * Cancel all active transcriptions
   */
  cancelAll(): void {
    for (const [id, controller] of this.activeTranscriptions) {
      controller.abort();
    }
    this.activeTranscriptions.clear();
  }

  /**
   * Get active transcription IDs
   */
  getActiveTranscriptions(): string[] {
    return Array.from(this.activeTranscriptions.keys());
  }
}

// Export singleton instance
export const transcriptionService = TranscriptionService.getInstance();

/**
 * Extract audio from video file
 * @param videoFile Video file
 * @returns Promise resolving to audio blob
 */
export async function extractAudioFromVideo(videoFile: File): Promise<Blob> {
  // This is a placeholder - actual implementation would use
  // Web Audio API or a library to extract audio track
  // TODO: Implement audio extraction using Web Audio API
  throw new Error(
    'Audio extraction from video not yet implemented - pending Web Audio API integration'
  );
}

/**
 * Split long audio into chunks for transcription
 * @param audioData Audio data
 * @param chunkDurationMs Chunk duration in milliseconds
 * @returns Array of audio chunks
 */
export async function splitAudioIntoChunks(
  audioData: Uint8Array,
  chunkDurationMs = 60_000 // 1 minute
): Promise<Uint8Array[]> {
  // This is a placeholder - actual implementation would use
  // Web Audio API to split audio into time-based chunks
  // TODO: Implement audio splitting using Web Audio API
  throw new Error(
    'Audio splitting not yet implemented - pending Web Audio API integration'
  );
}

/**
 * Merge transcription results from multiple chunks
 * @param results Array of transcription results
 * @returns Merged transcription result
 */
export function mergeTranscriptionResults(
  results: TranscriptionResult[]
): TranscriptionResult {
  if (results.length === 0) {
    throw new Error('No results to merge');
  }

  const mergedText = results.map((r) => r.text).join(' ');
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);

  const merged: TranscriptionResult = {
    text: mergedText,
    language: results[0].language,
    duration: totalDuration,
  };

  // Merge segments if available
  if (results.some((r) => r.segments)) {
    merged.segments = [];
    let segmentOffset = 0;

    for (const result of results) {
      if (result.segments) {
        for (const segment of result.segments) {
          merged.segments.push({
            ...segment,
            id: merged.segments.length,
            start: segment.start + segmentOffset,
            end: segment.end + segmentOffset,
          });
        }
      }
      segmentOffset += result.duration || 0;
    }
  }

  return merged;
}

/**
 * Generate subtitles from transcription
 * @param result Transcription result with segments
 * @param format Subtitle format
 * @returns Subtitle string
 */
export function generateSubtitles(
  result: TranscriptionResult,
  format: 'srt' | 'vtt' = 'srt'
): string {
  if (!result.segments || result.segments.length === 0) {
    throw new Error('No segments available for subtitle generation');
  }

  if (format === 'srt') {
    return result.segments
      .map((segment, index) => {
        const start = formatTimeSRT(segment.start);
        const end = formatTimeSRT(segment.end);
        return `${index + 1}\n${start} --> ${end}\n${segment.text.trim()}\n`;
      })
      .join('\n');
  }

  // VTT format
  let vtt = 'WEBVTT\n\n';
  vtt += result.segments
    .map((segment) => {
      const start = formatTimeVTT(segment.start);
      const end = formatTimeVTT(segment.end);
      return `${start} --> ${end}\n${segment.text.trim()}\n`;
    })
    .join('\n');
  return vtt;
}

// Helper functions for time formatting
function formatTimeSRT(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(ms, 3)}`;
}

function formatTimeVTT(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${pad(ms, 3)}`;
}

function pad(num: number, size = 2): string {
  return num.toString().padStart(size, '0');
}
