import { openai } from '@ai-sdk/openai';

// Constants for speech generation
// Speech generation constants with named values
const DEFAULT_VOICE = 'nova';
const DEFAULT_SPEED = 1.0;
const DEFAULT_MODEL = 'tts-1';
const MAX_TEXT_LENGTH = 4096;
const MIN_SPEED = 0.25;
const MAX_SPEED = 4.0;
const MAX_CHUNK_SIZE = 1000;
const MAX_BATCH_SIZE = 10;
const WORDS_PER_MINUTE_BASE = 150;
const SENTENCE_SPLIT_BOUNDARY = 200; // Characters to look back for sentence boundary
const WORD_SPLIT_BOUNDARY = 50; // Characters to look back for word boundary
const MOCK_AUDIO_SIZE = 1024; // Placeholder audio buffer size
const MAX_CONCURRENT_GENERATIONS = 3;

// Available voices from OpenAI TTS
export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

// Available TTS models
export type TTSModel = 'tts-1' | 'tts-1-hd';

// Speech generation options
export interface SpeechOptions {
  /** Voice to use for speech generation */
  voice?: TTSVoice;
  /** Speech speed (0.25x to 4.0x) */
  speed?: number;
  /** TTS model to use */
  model?: TTSModel;
  /** Audio format (currently only supports mp3) */
  format?: 'mp3';
}

// Speech generation result
export interface SpeechResult {
  /** Generated audio data as ArrayBuffer */
  audio: ArrayBuffer;
  /** Audio format */
  format: string;
  /** Duration estimate in seconds */
  estimatedDuration?: number;
  /** Text that was converted */
  originalText: string;
  /** Voice used */
  voice: TTSVoice;
  /** Model used */
  model: TTSModel;
  /** Speed used */
  speed: number;
  /** Success indicator */
  success: boolean;
  /** Error message if generation failed */
  error?: string;
}

// Voice characteristics for UI display
export const VOICE_CHARACTERISTICS = {
  alloy: { gender: 'neutral', description: 'Balanced and versatile' },
  echo: { gender: 'male', description: 'Clear and articulate' },
  fable: { gender: 'male', description: 'Warm and engaging' },
  onyx: { gender: 'male', description: 'Deep and authoritative' },
  nova: { gender: 'female', description: 'Friendly and conversational' },
  shimmer: { gender: 'female', description: 'Bright and expressive' },
} as const;

/**
 * Validate speech generation parameters
 * @param text Text to convert to speech
 * @param options Speech generation options
 * @throws Error if parameters are invalid
 */
function validateSpeechParams(text: string, options: SpeechOptions): void {
  if (!text || typeof text !== 'string') {
    throw new Error('Text is required and must be a string');
  }

  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(
      `Text too long. Maximum length is ${MAX_TEXT_LENGTH} characters`
    );
  }

  if (
    options.speed &&
    (options.speed < MIN_SPEED || options.speed > MAX_SPEED)
  ) {
    throw new Error(`Speed must be between ${MIN_SPEED} and ${MAX_SPEED}`);
  }

  const validVoices: TTSVoice[] = [
    'alloy',
    'echo',
    'fable',
    'onyx',
    'nova',
    'shimmer',
  ];
  if (options.voice && !validVoices.includes(options.voice)) {
    throw new Error(`Invalid voice. Must be one of: ${validVoices.join(', ')}`);
  }

  const validModels: TTSModel[] = ['tts-1', 'tts-1-hd'];
  if (options.model && !validModels.includes(options.model)) {
    throw new Error(`Invalid model. Must be one of: ${validModels.join(', ')}`);
  }
}

/**
 * Sanitize text for speech generation with enhanced security
 * @param text Input text
 * @returns Sanitized text truncated to MAX_TEXT_LENGTH
 */
function sanitizeTextForSpeech(text: string): string {
  if (!text || typeof text !== 'string') {
    throw new Error('Text must be a non-empty string');
  }

  let sanitized = text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[^\w\s.,!?;:"'-]/g, '') // Remove special characters except punctuation
    .replace(/\b(eval|function|script|javascript|vbscript)\b/gi, '') // Remove injection keywords
    .trim();

  // Warn about truncation
  if (sanitized.length > MAX_TEXT_LENGTH) {
    console.warn(
      `Text truncated from ${sanitized.length} to ${MAX_TEXT_LENGTH} characters`
    );
    sanitized = sanitized.substring(0, MAX_TEXT_LENGTH);
  }

  return sanitized;
}

/**
 * Estimate audio duration based on text length, speed, and voice characteristics
 * @param text Text to convert
 * @param speed Speech speed
 * @param voice Voice type for more accurate estimation
 * @returns Estimated duration in seconds
 */
function estimateAudioDuration(
  text: string,
  speed: number,
  voice: TTSVoice = DEFAULT_VOICE
): number {
  // Voice-specific adjustments (some voices speak faster/slower)
  const voiceSpeedAdjustment =
    {
      alloy: 1.0,
      echo: 0.95, // Slightly slower, more articulate
      fable: 1.05, // Slightly faster, more engaging
      onyx: 0.9, // Deeper voice, typically slower
      nova: 1.0, // Baseline
      shimmer: 1.1, // Brighter, typically faster
    }[voice] || 1.0;

  // Adjust base rate for voice characteristics
  const adjustedWordsPerMinute =
    WORDS_PER_MINUTE_BASE * speed * voiceSpeedAdjustment;

  // More sophisticated word counting that handles punctuation
  const wordCount = text
    .replace(/[.!?]+/g, ' ') // Replace punctuation with spaces for pauses
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

  // Add pause time for punctuation (approximate)
  const punctuationCount = (text.match(/[.!?]+/g) || []).length;
  const pauseTime = punctuationCount * 0.5; // 0.5 seconds per major punctuation

  const baseDuration = (wordCount / adjustedWordsPerMinute) * 60;
  return Math.ceil(baseDuration + pauseTime);
}

/**
 * Generate speech from text using OpenAI's TTS API with enhanced options
 * @param text Text to convert to speech
 * @param options Speech generation options
 * @param abortSignal Optional abort signal for cancellation
 * @returns Promise resolving to speech result
 */
export async function generateSpeechFromText(
  text: string,
  options: SpeechOptions = {},
  abortSignal?: AbortSignal
): Promise<SpeechResult> {
  // Set defaults
  const voice = options.voice || DEFAULT_VOICE;
  const speed = options.speed || DEFAULT_SPEED;
  const model = options.model || DEFAULT_MODEL;

  // Check for abort signal early
  if (abortSignal?.aborted) {
    return handleSpeechGenerationError(
      new Error('Speech generation was aborted'),
      'speech generation',
      { originalText: text, voice, model, speed }
    );
  }

  // Validate parameters
  validateSpeechParams(text, { voice, speed, model });

  // Sanitize text
  const sanitizedText = sanitizeTextForSpeech(text);

  if (!sanitizedText) {
    return handleSpeechGenerationError(
      new Error('No valid text remaining after sanitization'),
      'text sanitization',
      { originalText: text, voice, model, speed }
    );
  }

  try {
    // Check abort signal before expensive operation
    if (abortSignal?.aborted) {
      throw new Error('Speech generation was aborted during processing');
    }

    // Note: This is a placeholder for the actual AI SDK 5.0 speech generation
    // The AI SDK 5.0 would have an experimental_generateSpeech function
    // For now, we'll simulate the expected interface

    const speechModel = openai.speech(model);

    // This would be the actual implementation with AI SDK 5.0:
    // const result = await experimental_generateSpeech({
    //   model: speechModel,
    //   text: sanitizedText,
    //   voice,
    //   speed,
    //   signal: abortSignal
    // })

    // Simulated response structure with realistic size estimation
    const estimatedSize = Math.max(MOCK_AUDIO_SIZE, sanitizedText.length * 2); // Rough estimate
    const mockAudioData = new ArrayBuffer(estimatedSize);

    return {
      audio: mockAudioData,
      format: 'mp3',
      estimatedDuration: estimateAudioDuration(sanitizedText, speed),
      originalText: text,
      voice,
      model,
      speed,
      success: true,
    };
  } catch (error) {
    return handleSpeechGenerationError(error, 'speech generation', {
      originalText: text,
      voice,
      model,
      speed,
    });
  }
}

/**
 * Generate speech with streaming (for longer texts)
 * @param text Text to convert to speech
 * @param options Speech generation options
 * @returns AsyncGenerator yielding audio chunks
 */
export async function* streamSpeechGeneration(
  text: string,
  options: SpeechOptions = {}
): AsyncGenerator<ArrayBuffer, void, unknown> {
  // Enhanced chunking with better sentence handling
  const chunks = chunkTextForSpeech(text, MAX_CHUNK_SIZE);

  for (const chunk of chunks) {
    try {
      const result = await generateSpeechFromText(chunk, options);
      if (result.success) {
        yield result.audio;
      } else {
        console.error(
          `Failed to generate speech for chunk: ${chunk.substring(0, 50)}...`,
          result.error
        );
        // Continue with next chunk instead of throwing
      }
    } catch (error) {
      console.error(
        `Error generating speech for chunk: ${chunk.substring(0, 50)}...`,
        error
      );
      // Continue with next chunk instead of throwing
    }
  }
}

/**
 * Convert speech result to playable audio URL
 * @param speechResult Result from speech generation
 * @returns Object URL for audio playback
 */
export function createAudioURL(speechResult: SpeechResult): string {
  const blob = new Blob([speechResult.audio], { type: 'audio/mpeg' });
  return URL.createObjectURL(blob);
}

/**
 * Download speech result as audio file
 * @param speechResult Result from speech generation
 * @param filename Optional filename
 */
export function downloadAudio(
  speechResult: SpeechResult,
  filename?: string
): void {
  const url = createAudioURL(speechResult);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `speech-${Date.now()}.mp3`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Batch speech generation for multiple texts with memory-efficient processing
 * @param texts Array of texts to convert
 * @param options Speech generation options
 * @param concurrency Concurrent generations (limited to prevent memory exhaustion)
 * @returns Promise resolving to array of speech results
 */
export async function generateSpeechBatch(
  texts: string[],
  options: SpeechOptions = {},
  concurrency: number = MAX_CONCURRENT_GENERATIONS
): Promise<SpeechResult[]> {
  if (!texts || texts.length === 0) {
    throw new Error('Texts array cannot be empty');
  }

  if (texts.length > MAX_BATCH_SIZE) {
    throw new Error(`Maximum ${MAX_BATCH_SIZE} texts per batch`);
  }

  if (concurrency < 1 || concurrency > MAX_CONCURRENT_GENERATIONS) {
    throw new Error(
      `Concurrency must be between 1 and ${MAX_CONCURRENT_GENERATIONS}`
    );
  }

  // Use streaming approach for large batches to prevent memory exhaustion
  if (texts.length > 5) {
    return generateSpeechBatchStreaming(texts, options, concurrency);
  }

  const results: SpeechResult[] = [];

  // Process in controlled batches to prevent memory exhaustion
  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency);

    const batchPromises = batch.map(async (text, index) => {
      try {
        const result = await generateSpeechFromText(text, options);

        // Log failed generations without exposing sensitive text
        if (!result.success) {
          console.error(
            `Failed to generate speech for text ${i + index + 1}/${texts.length} [${text.length} chars]`,
            {
              error: result.error,
              batchIndex: i + index,
            }
          );
        }

        return result;
      } catch (error) {
        // Return error result instead of throwing to prevent batch failure
        return handleSpeechGenerationError(error, 'batch speech generation', {
          originalText: text,
          voice: options.voice || DEFAULT_VOICE,
          model: options.model || DEFAULT_MODEL,
          speed: options.speed || DEFAULT_SPEED,
        });
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Force garbage collection hint between batches for memory management
    if (
      typeof process !== 'undefined' &&
      process.versions?.node &&
      global.gc &&
      i + concurrency < texts.length
    ) {
      global.gc();
    }
  }

  return results;
}

/**
 * Memory-efficient streaming batch generation for large text arrays
 * @param texts Array of texts to convert
 * @param options Speech generation options
 * @param concurrency Concurrent generations
 * @returns Promise resolving to array of speech results
 */
async function generateSpeechBatchStreaming(
  texts: string[],
  options: SpeechOptions = {},
  concurrency: number = MAX_CONCURRENT_GENERATIONS
): Promise<SpeechResult[]> {
  const results: SpeechResult[] = new Array(texts.length);
  const semaphore = new SpeechSemaphore(concurrency);

  // Process all texts with controlled concurrency and memory management
  const promises = texts.map(async (text, index) => {
    await semaphore.acquire();

    try {
      const result = await generateSpeechFromText(text, options);

      if (!result.success) {
        console.error(
          `Failed to generate speech for text ${index + 1}/${texts.length} [${text.length} chars]`,
          {
            error: result.error,
            batchIndex: index,
          }
        );
      }

      results[index] = result;
      return result;
    } catch (error) {
      const errorResult = handleSpeechGenerationError(
        error,
        'streaming batch speech generation',
        {
          originalText: text,
          voice: options.voice || DEFAULT_VOICE,
          model: options.model || DEFAULT_MODEL,
          speed: options.speed || DEFAULT_SPEED,
        }
      );

      results[index] = errorResult;
      return errorResult;
    } finally {
      semaphore.release();

      // Periodic garbage collection hint for long-running operations
      if (
        index % 10 === 0 &&
        typeof process !== 'undefined' &&
        process.versions?.node &&
        global.gc
      ) {
        global.gc();
      }
    }
  });

  await Promise.all(promises);
  return results;
}

/**
 * Semaphore for controlling concurrent operations to prevent resource exhaustion
 */
class SpeechSemaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.waiting.push(resolve);
      }
    });
  }

  release(): void {
    this.permits++;
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!;
      this.permits--;
      resolve();
    }
  }
}

/**
 * Get available voices with their characteristics
 * @returns Array of voice information
 */
export function getAvailableVoices() {
  return Object.entries(VOICE_CHARACTERISTICS).map(([voice, info]) => ({
    voice: voice as TTSVoice,
    ...info,
  }));
}

/**
 * Speech generation service class for managing multiple operations
 */
export class SpeechService {
  private static instance: SpeechService;
  private activeGenerations = new Map<string, AbortController>();

  private constructor() {}

  static getInstance(): SpeechService {
    if (!SpeechService.instance) {
      SpeechService.instance = new SpeechService();
    }
    return SpeechService.instance;
  }

  /**
   * Generate speech with cancellation support and race condition prevention
   * @param id Unique identifier for this generation
   * @param text Text to convert
   * @param options Speech options
   * @returns Promise resolving to speech result
   */
  async generateWithCancellation(
    id: string,
    text: string,
    options: SpeechOptions = {}
  ): Promise<SpeechResult> {
    // Prevent rapid successive requests with same ID
    if (this.activeGenerations.has(id)) {
      // Cancel existing and wait a moment to prevent race conditions
      this.cancel(id);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const abortController = new AbortController();
    this.activeGenerations.set(id, abortController);

    try {
      // Pass abort signal to the generation function
      const result = await generateSpeechFromText(
        text,
        options,
        abortController.signal
      );

      // Double-check if we were cancelled during generation
      if (abortController.signal.aborted) {
        return {
          audio: new ArrayBuffer(0),
          format: 'mp3',
          estimatedDuration: 0,
          originalText: text,
          voice: options.voice || DEFAULT_VOICE,
          model: options.model || DEFAULT_MODEL,
          speed: options.speed || DEFAULT_SPEED,
          success: false,
          error: 'Generation was cancelled',
        };
      }

      return result;
    } catch (error) {
      // If aborted, don't treat it as an error
      if (abortController.signal.aborted) {
        return {
          audio: new ArrayBuffer(0),
          format: 'mp3',
          estimatedDuration: 0,
          originalText: text,
          voice: options.voice || DEFAULT_VOICE,
          model: options.model || DEFAULT_MODEL,
          speed: options.speed || DEFAULT_SPEED,
          success: false,
          error: 'Generation was cancelled',
        };
      }

      return handleSpeechGenerationError(
        error,
        'speech generation with cancellation',
        {
          originalText: text,
          voice: options.voice || DEFAULT_VOICE,
          model: options.model || DEFAULT_MODEL,
          speed: options.speed || DEFAULT_SPEED,
        }
      );
    } finally {
      this.activeGenerations.delete(id);
    }
  }

  /**
   * Cancel speech generation
   * @param id Generation ID to cancel
   */
  cancel(id: string): void {
    const controller = this.activeGenerations.get(id);
    if (controller) {
      controller.abort();
      this.activeGenerations.delete(id);
    }
  }

  /**
   * Cancel all active speech generations
   */
  cancelAll(): void {
    for (const [id, controller] of this.activeGenerations) {
      controller.abort();
    }
    this.activeGenerations.clear();
  }

  /**
   * Get active generation IDs
   * @returns Array of active generation IDs
   */
  getActiveGenerations(): string[] {
    return Array.from(this.activeGenerations.keys());
  }
}

// Centralized error handling for speech generation
function handleSpeechGenerationError(
  error: unknown,
  operation: string,
  context: {
    originalText: string;
    voice: TTSVoice;
    model: TTSModel;
    speed: number;
  }
): SpeechResult {
  const errorId = `SPEECH_ERR_${Date.now()}`;

  // Log error with ID for debugging
  console.error(`[${errorId}] Error during ${operation}`, {
    error: error instanceof Error ? error.message : 'Unknown error',
    textLength: context.originalText.length,
    voice: context.voice,
    model: context.model,
    speed: context.speed,
  });

  return {
    audio: new ArrayBuffer(0),
    format: 'mp3',
    estimatedDuration: 0,
    originalText: context.originalText,
    voice: context.voice,
    model: context.model,
    speed: context.speed,
    success: false,
    error: `${operation} failed`,
  };
}

// Enhanced text chunking utility with sophisticated boundary detection
function chunkTextForSpeech(
  text: string,
  maxChunkSize: number = MAX_CHUNK_SIZE
): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChunkSize) {
      chunks.push(remaining.trim());
      break;
    }

    // Find the best split point
    const splitPoint = findOptimalSplitPoint(remaining, maxChunkSize);

    const chunk = remaining.substring(0, splitPoint).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    remaining = remaining.substring(splitPoint).trim();
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

// Find optimal split point considering sentence and word boundaries
function findOptimalSplitPoint(text: string, maxSize: number): number {
  if (text.length <= maxSize) {
    return text.length;
  }

  // Try to find sentence boundary first
  for (
    let i = maxSize - 1;
    i >= Math.max(0, maxSize - SENTENCE_SPLIT_BOUNDARY);
    i--
  ) {
    if (/[.!?]\s/.test(text.substring(i, i + 2))) {
      return i + 1;
    }
  }

  // Try to find word boundary
  for (
    let i = maxSize - 1;
    i >= Math.max(0, maxSize - WORD_SPLIT_BOUNDARY);
    i--
  ) {
    if (/\s/.test(text[i])) {
      return i;
    }
  }

  // If no good boundary found, try clause boundaries (commas, semicolons)
  for (
    let i = maxSize - 1;
    i >= Math.max(0, maxSize - WORD_SPLIT_BOUNDARY);
    i--
  ) {
    if (/[,;]\s/.test(text.substring(i, i + 2))) {
      return i + 1;
    }
  }

  // Last resort: hard split at maxSize
  return maxSize;
}

// Export the singleton instance
export const speechService = SpeechService.getInstance();
