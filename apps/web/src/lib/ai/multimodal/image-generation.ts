import { openai } from '@ai-sdk/openai';

// Constants for image generation
const DEFAULT_SIZE = '1024x1024';
const DEFAULT_QUALITY = 'standard';
const DEFAULT_STYLE = 'vivid';
const DEFAULT_MODEL = 'dall-e-3';
const MAX_PROMPT_LENGTH = 4000;
const MAX_GENERATIONS_PER_REQUEST = 1;
const VALID_SIZES = ['1024x1024', '1792x1024', '1024x1792'] as const;
const VALID_QUALITIES = ['standard', 'hd'] as const;
const VALID_STYLES = ['vivid', 'natural'] as const;

// Type definitions
export type ImageSize = (typeof VALID_SIZES)[number];
export type ImageQuality = (typeof VALID_QUALITIES)[number];
export type ImageStyle = (typeof VALID_STYLES)[number];

export interface ImageGenerationOptions {
  /** Size of the generated image */
  size?: ImageSize;
  /** Quality of the generated image */
  quality?: ImageQuality;
  /** Style preset for the generated image */
  style?: ImageStyle;
  /** Number of images to generate (currently limited to 1 for DALL-E 3) */
  n?: number;
  /** User identifier for tracking */
  user?: string;
}

export interface ImageGenerationResult {
  /** Generated image URL */
  url: string;
  /** Revised prompt used by the model */
  revisedPrompt?: string;
  /** Base64 encoded image data (if requested) */
  b64Json?: string;
  /** Generation metadata */
  metadata: {
    model: string;
    size: ImageSize;
    quality: ImageQuality;
    style: ImageStyle;
    timestamp: Date;
  };
}

export interface ImageGenerationError {
  error: string;
  code?: string;
  details?: any;
}

/**
 * Validate image generation parameters
 * @param prompt The prompt to validate
 * @param options Generation options to validate
 * @throws Error if parameters are invalid
 */
function validateImageGenerationParams(
  prompt: string,
  options: ImageGenerationOptions
): void {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Prompt is required and must be a string');
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error(
      `Prompt too long. Maximum length is ${MAX_PROMPT_LENGTH} characters`
    );
  }

  if (options.size && !VALID_SIZES.includes(options.size)) {
    throw new Error(`Invalid size. Must be one of: ${VALID_SIZES.join(', ')}`);
  }

  if (options.quality && !VALID_QUALITIES.includes(options.quality)) {
    throw new Error(
      `Invalid quality. Must be one of: ${VALID_QUALITIES.join(', ')}`
    );
  }

  if (options.style && !VALID_STYLES.includes(options.style)) {
    throw new Error(
      `Invalid style. Must be one of: ${VALID_STYLES.join(', ')}`
    );
  }

  if (options.n && (options.n < 1 || options.n > MAX_GENERATIONS_PER_REQUEST)) {
    throw new Error(
      `Number of images must be between 1 and ${MAX_GENERATIONS_PER_REQUEST}`
    );
  }
}

/**
 * Sanitize prompt for image generation
 * @param prompt Input prompt
 * @returns Sanitized prompt
 */
function sanitizeImagePrompt(prompt: string): string {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Prompt must be a non-empty string');
  }

  // Remove potentially problematic content
  let sanitized = prompt
    .replace(/[<>{}[\]]/g, '') // Remove brackets and braces
    .replace(/\b(eval|function|script|javascript|vbscript)\b/gi, '') // Remove code keywords
    .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
    .trim();

  // Truncate if too long
  if (sanitized.length > MAX_PROMPT_LENGTH) {
    console.warn(
      `Prompt truncated from ${sanitized.length} to ${MAX_PROMPT_LENGTH} characters`
    );
    sanitized = sanitized.substring(0, MAX_PROMPT_LENGTH);
  }

  return sanitized;
}

/**
 * Generate image from text prompt using AI SDK 5.0
 * @param prompt Text description of the image to generate
 * @param options Image generation options
 * @returns Promise resolving to image generation result
 */
export async function createImageArtifact(
  prompt: string,
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResult> {
  // Set defaults
  const size = options.size || DEFAULT_SIZE;
  const quality = options.quality || DEFAULT_QUALITY;
  const style = options.style || DEFAULT_STYLE;
  const n = options.n || 1;

  // Validate parameters
  validateImageGenerationParams(prompt, { size, quality, style, n });

  // Sanitize prompt
  const sanitizedPrompt = sanitizeImagePrompt(prompt);

  try {
    // Note: This is a placeholder for AI SDK 5.0 image generation
    // The actual implementation would use experimental_generateImage

    const imageModel = openai.image(DEFAULT_MODEL);

    // This would be the actual implementation with AI SDK 5.0:
    // const result = await experimental_generateImage({
    //   model: imageModel,
    //   prompt: sanitizedPrompt,
    //   size,
    //   quality,
    //   style,
    //   n,
    //   user: options.user
    // })

    // Simulated response for now
    const mockUrl = `https://placeholder.com/generated-image-${Date.now()}.png`;
    const mockRevisedPrompt = `Enhanced: ${sanitizedPrompt}`;

    return {
      url: mockUrl,
      revisedPrompt: mockRevisedPrompt,
      metadata: {
        model: DEFAULT_MODEL,
        size,
        quality,
        style,
        timestamp: new Date(),
      },
    };
  } catch (error) {
    console.error('Image generation failed:', error);
    throw new Error(
      `Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate image and return as base64
 * @param prompt Text description of the image
 * @param options Generation options
 * @returns Promise resolving to base64 image data
 */
export async function generateImageBase64(
  prompt: string,
  options: ImageGenerationOptions = {}
): Promise<string> {
  const result = await createImageArtifact(prompt, {
    ...options,
    // Request base64 format in the actual implementation
  });

  // In the actual implementation, this would return the b64Json field
  // For now, we'll throw an error indicating it's not yet supported
  throw new Error('Base64 image generation not yet implemented');
}

/**
 * Batch image generation with rate limiting
 * @param prompts Array of prompts to generate images for
 * @param options Shared generation options
 * @param delayMs Delay between generations to avoid rate limits
 * @returns Promise resolving to array of results
 */
export async function generateImageBatch(
  prompts: string[],
  options: ImageGenerationOptions = {},
  delayMs = 1000
): Promise<Array<ImageGenerationResult | ImageGenerationError>> {
  if (!prompts || prompts.length === 0) {
    throw new Error('Prompts array cannot be empty');
  }

  const results: Array<ImageGenerationResult | ImageGenerationError> = [];

  for (let i = 0; i < prompts.length; i++) {
    try {
      const result = await createImageArtifact(prompts[i], options);
      results.push(result);

      // Add delay between requests to avoid rate limiting
      if (i < prompts.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      results.push({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: { promptIndex: i, prompt: prompts[i] },
      });
    }
  }

  return results;
}

/**
 * Image generation service for managing operations
 */
export class ImageGenerationService {
  private static instance: ImageGenerationService;
  private generationQueue: Array<{
    prompt: string;
    options: ImageGenerationOptions;
    resolve: (result: ImageGenerationResult) => void;
    reject: (error: Error) => void;
  }> = [];
  private isProcessing = false;
  private disposed = false;

  private constructor() {}

  static getInstance(): ImageGenerationService {
    if (!ImageGenerationService.instance) {
      ImageGenerationService.instance = new ImageGenerationService();
    }
    return ImageGenerationService.instance;
  }

  /**
   * Queue image generation request
   * @param prompt Image prompt
   * @param options Generation options
   * @returns Promise resolving to generation result
   */
  async queueGeneration(
    prompt: string,
    options: ImageGenerationOptions = {}
  ): Promise<ImageGenerationResult> {
    return new Promise((resolve, reject) => {
      this.generationQueue.push({ prompt, options, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process generation queue
   */
  private async processQueue(): Promise<void> {
    if (
      this.isProcessing ||
      this.generationQueue.length === 0 ||
      this.disposed
    ) {
      return;
    }

    this.isProcessing = true;

    while (this.generationQueue.length > 0) {
      const request = this.generationQueue.shift();
      if (!request) continue;

      try {
        const result = await createImageArtifact(
          request.prompt,
          request.options
        );
        request.resolve(result);
      } catch (error) {
        request.reject(
          error instanceof Error ? error : new Error('Generation failed')
        );
      }

      // Rate limiting delay
      if (this.generationQueue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    this.isProcessing = false;
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.generationQueue.length;
  }

  /**
   * Clear generation queue
   */
  clearQueue(): void {
    this.generationQueue.forEach((request) => {
      request.reject(new Error('Queue cleared'));
    });
    this.generationQueue = [];
  }

  /**
   * Dispose of the service and clean up resources
   */
  dispose(): void {
    this.disposed = true;
    this.clearQueue();
  }
}

// Export singleton instance
export const imageGenerationService = ImageGenerationService.getInstance();

/**
 * Create image URL from generation result
 * @param result Image generation result
 * @returns Object URL for display
 */
export function createImageObjectURL(result: ImageGenerationResult): string {
  if (result.b64Json) {
    // Convert base64 to blob
    const byteCharacters = atob(result.b64Json);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });
    return URL.createObjectURL(blob);
  }

  // Return the URL directly
  return result.url;
}

/**
 * Download generated image
 * @param result Image generation result
 * @param filename Optional filename
 */
export async function downloadGeneratedImage(
  result: ImageGenerationResult,
  filename?: string
): Promise<void> {
  const imageUrl = result.url;

  try {
    // Fetch the image
    const response = await fetch(imageUrl);
    const blob = await response.blob();

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `ai-generated-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to download image:', error);
    throw new Error('Failed to download generated image');
  }
}
