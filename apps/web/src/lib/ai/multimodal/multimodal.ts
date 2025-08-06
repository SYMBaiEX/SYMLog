import { openai } from '@ai-sdk/openai';
import type { CoreMessage } from 'ai';
import { generateObject, experimental_transcribe as transcribe } from 'ai';
import { z } from 'zod';
import {
  scanForMaliciousContent,
  validateAttachments,
} from '@/lib/security/attachment-validator';
import type { FileAttachment } from '@/types/attachments';
import { getAIModel } from '../core/providers';

export async function processAttachmentsForAI(
  attachments: FileAttachment[],
  messageText: string,
  userId?: string
): Promise<{ systemPrompt: string; messageContent: string; error?: string }> {
  if (!attachments || attachments.length === 0) {
    return { systemPrompt: '', messageContent: messageText };
  }

  // Validate attachments first
  const validation = await validateAttachments(attachments, userId);
  if (!validation.valid) {
    return {
      systemPrompt: '',
      messageContent: messageText,
      error: validation.error,
    };
  }

  const safeAttachments = validation.sanitizedAttachments!;

  let systemPrompt = '\n\nAttached files:';
  let messageContent = messageText;

  safeAttachments.forEach((attachment, index) => {
    const attachmentInfo = `
File ${index + 1}: ${attachment.name} (${attachment.type}, ${Math.round(attachment.size / 1024)}KB)`;

    systemPrompt += attachmentInfo;

    // For images, include base64 data
    if (attachment.type.startsWith('image/') && attachment.base64) {
      messageContent += `\n\n[Image: ${attachment.name}]\n${attachment.base64}`;
    }

    // For text files, try to extract content
    else if (attachment.type.startsWith('text/') && attachment.base64) {
      try {
        const content = atob(attachment.base64.split(',')[1]);

        // Scan for malicious content
        const scanResult = scanForMaliciousContent(content, attachment.type);
        if (scanResult.safe) {
          messageContent += `\n\n[File: ${attachment.name}]\n\`\`\`\n${content}\n\`\`\``;
        } else {
          messageContent += `\n\n[File: ${attachment.name} - Blocked: ${scanResult.reason}]`;
        }
      } catch (error) {
        messageContent += `\n\n[File: ${attachment.name} - Unable to read content]`;
      }
    }

    // For other file types, just mention them
    else {
      messageContent += `\n\n[Attached: ${attachment.name}]`;
    }
  });

  return { systemPrompt, messageContent };
}

export async function addAttachmentsToMessage(
  message: CoreMessage,
  attachments: FileAttachment[],
  userId?: string
): Promise<CoreMessage> {
  if (!attachments || attachments.length === 0) {
    return message;
  }

  // Validate attachments first
  const validation = await validateAttachments(attachments, userId);
  if (!validation.valid) {
    // Return message with error notification
    return {
      ...message,
      content: `${message.content}\n\n[Attachment Error: ${validation.error}]`,
    } as CoreMessage;
  }

  const safeAttachments = validation.sanitizedAttachments!;

  const parts: any[] = [];

  // Add text content if it exists
  if (typeof message.content === 'string' && message.content.trim()) {
    parts.push({ type: 'text', text: message.content });
  }

  // Add attachments
  safeAttachments.forEach((attachment) => {
    if (attachment.type.startsWith('image/') && attachment.base64) {
      parts.push({
        type: 'image',
        image: attachment.base64,
      });
    } else if (attachment.type.startsWith('text/') && attachment.base64) {
      try {
        const content = atob(attachment.base64.split(',')[1]);

        // Scan for malicious content
        const scanResult = scanForMaliciousContent(content, attachment.type);
        if (scanResult.safe) {
          parts.push({
            type: 'text',
            text: `File: ${attachment.name}\n\`\`\`\n${content}\n\`\`\``,
          });
        } else {
          parts.push({
            type: 'text',
            text: `File: ${attachment.name} (Blocked: ${scanResult.reason})`,
          });
        }
      } catch (error) {
        parts.push({
          type: 'text',
          text: `File: ${attachment.name} (Unable to read content)`,
        });
      }
    } else {
      parts.push({
        type: 'text',
        text: `Attached file: ${attachment.name} (${attachment.type})`,
      });
    }
  });

  return {
    ...message,
    content: parts.length === 1 ? parts[0].text || parts[0].image : parts,
  };
}

export function createImageDataURL(
  base64Data: string,
  mimeType: string
): string {
  // If already a data URL, return as is
  if (base64Data.startsWith('data:')) {
    return base64Data;
  }

  // Create data URL
  return `data:${mimeType};base64,${base64Data}`;
}

// Advanced Multi-Modal Processing Class
export class AdvancedMultiModal {
  /**
   * Process image attachments with OCR and AI analysis
   */
  async processImageAttachment(
    imageData: string,
    options?: {
      extractText?: boolean;
      analyzeContent?: boolean;
      detectObjects?: boolean;
    }
  ) {
    const opts = {
      extractText: true,
      analyzeContent: true,
      detectObjects: true,
      ...options,
    };

    const results: {
      extractedText?: string;
      analysis?: any;
      errors?: string[];
    } = {};
    const errors: string[] = [];

    // OCR text extraction using GPT-4 Vision
    if (opts.extractText) {
      try {
        const extractedText = await this.extractTextFromImage(imageData);
        results.extractedText = extractedText;
      } catch (error) {
        errors.push(
          `Text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Image analysis
    if (opts.analyzeContent) {
      try {
        const analysis = await generateObject({
          model: openai('gpt-4o'),
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analyze this image in detail. Describe what you see, identify objects, colors, mood, and any text present.',
                },
                { type: 'image', image: imageData },
              ],
            },
          ],
          schema: z.object({
            description: z
              .string()
              .describe('Overall description of the image'),
            objects: z.array(z.string()).describe('List of identified objects'),
            text: z.string().optional().describe('Any text found in the image'),
            colors: z
              .array(z.string())
              .describe('Dominant colors in the image'),
            mood: z.string().describe('Mood or atmosphere of the image'),
            tags: z
              .array(z.string())
              .describe('Relevant tags for categorization'),
          }),
        });

        results.analysis = analysis.object;
      } catch (error) {
        errors.push(
          `Image analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    if (errors.length > 0) {
      results.errors = errors;
    }

    return results;
  }

  /**
   * Extract text from image using AI vision capabilities
   */
  private async extractTextFromImage(imageData: string): Promise<string> {
    const response = await generateObject({
      model: openai('gpt-4o'),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all text from this image. Return only the extracted text, preserving formatting where possible.',
            },
            { type: 'image', image: imageData },
          ],
        },
      ],
      schema: z.object({
        text: z.string().describe('All extracted text from the image'),
        confidence: z
          .number()
          .min(0)
          .max(1)
          .describe('Confidence level of text extraction'),
      }),
    });

    return response.object.text;
  }

  /**
   * Process audio attachments with transcription and analysis
   */
  async processAudioAttachment(
    audioData: Uint8Array | string,
    options?: {
      language?: string;
      analyzeSentiment?: boolean;
      extractActionItems?: boolean;
    }
  ) {
    const opts = {
      analyzeSentiment: true,
      extractActionItems: true,
      ...options,
    };

    // Convert base64 to Uint8Array if needed
    let audioBuffer: Uint8Array;
    if (typeof audioData === 'string') {
      // Remove data URL prefix if present
      const base64 = audioData.replace(/^data:audio\/\w+;base64,/, '');
      const binaryString = atob(base64);
      audioBuffer = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        audioBuffer[i] = binaryString.charCodeAt(i);
      }
    } else {
      audioBuffer = audioData;
    }

    // Transcribe audio
    const transcription = await transcribe({
      model: openai.transcription('whisper-1'),
      audio: audioBuffer,
      ...(opts.language && { language: opts.language }),
    });

    const results: {
      transcription: any;
      analysis?: any;
    } = { transcription };

    // Analyze transcribed content if requested
    if (
      (opts.analyzeSentiment || opts.extractActionItems) &&
      transcription.text
    ) {
      const analysis = await generateObject({
        model: getAIModel('fast'),
        prompt: `Analyze this transcribed audio: "${transcription.text}"`,
        schema: z.object({
          sentiment: z
            .enum(['positive', 'negative', 'neutral'])
            .describe('Overall sentiment'),
          topics: z.array(z.string()).describe('Main topics discussed'),
          summary: z.string().describe('Brief summary of the content'),
          actionItems: z
            .array(z.string())
            .describe('Action items or tasks mentioned'),
          keyPoints: z.array(z.string()).describe('Key points or highlights'),
        }),
      });

      results.analysis = analysis.object;
    }

    return results;
  }

  /**
   * Process document attachments (PDF, DOCX, etc.)
   */
  async processDocumentAttachment(
    documentData: string,
    mimeType: string,
    options?: {
      extractStructure?: boolean;
      summarize?: boolean;
      extractMetadata?: boolean;
    }
  ) {
    const opts = {
      extractStructure: true,
      summarize: true,
      extractMetadata: true,
      ...options,
    };

    // For now, we'll handle text-based documents
    // In a real implementation, you'd use libraries like pdf.js or mammoth.js
    if (mimeType.includes('text/') || mimeType.includes('json')) {
      try {
        const content = atob(documentData.split(',')[1]);

        const analysis = await generateObject({
          model: getAIModel('balanced'),
          prompt: `Analyze this document content:\n\n${content}`,
          schema: z.object({
            summary: z.string().describe('Brief summary of the document'),
            structure: z
              .object({
                sections: z
                  .array(z.string())
                  .describe('Main sections or headings'),
                hasTable: z
                  .boolean()
                  .describe('Whether document contains tables'),
                hasCode: z
                  .boolean()
                  .describe('Whether document contains code snippets'),
                wordCount: z.number().describe('Approximate word count'),
              })
              .optional(),
            keyTopics: z.array(z.string()).describe('Key topics covered'),
            documentType: z
              .string()
              .describe('Type of document (report, article, code, etc.)'),
            metadata: z
              .object({
                language: z.string().describe('Document language'),
                techStack: z
                  .array(z.string())
                  .optional()
                  .describe('Technologies mentioned if technical doc'),
              })
              .optional(),
          }),
        });

        return {
          content,
          analysis: analysis.object,
        };
      } catch (error) {
        throw new Error(
          `Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    throw new Error(`Unsupported document type: ${mimeType}`);
  }

  /**
   * Process video attachments with frame extraction and analysis
   */
  async processVideoAttachment(
    videoData: string,
    options?: {
      extractFrames?: boolean;
      analyzeContent?: boolean;
      transcribeAudio?: boolean;
      frameInterval?: number;
      maxFrames?: number;
    }
  ) {
    const opts = {
      extractFrames: true,
      analyzeContent: true,
      transcribeAudio: true,
      frameInterval: 2, // Extract frame every 2 seconds
      maxFrames: 10, // Maximum frames to extract
      ...options,
    };

    const results: {
      metadata?: any;
      frames?: any[];
      audioTranscription?: any;
      analysis?: any;
      errors?: string[];
    } = {};
    const errors: string[] = [];

    try {
      // Extract video metadata and frames
      const videoElement = await this.createVideoElement(videoData);
      const metadata = await this.extractVideoMetadata(videoElement);
      results.metadata = metadata;

      if (opts.extractFrames) {
        try {
          const frames = await this.extractVideoFrames(videoElement, {
            interval: opts.frameInterval,
            maxFrames: opts.maxFrames,
          });
          results.frames = frames;

          // Analyze extracted frames if requested
          if (opts.analyzeContent && frames.length > 0) {
            const frameAnalysis = await this.analyzeVideoFrames(frames);
            results.analysis = frameAnalysis;
          }
        } catch (error) {
          errors.push(
            `Frame extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // Extract and transcribe audio track
      if (opts.transcribeAudio) {
        try {
          const audioBuffer = await this.extractAudioFromVideo(videoElement);
          if (audioBuffer) {
            const transcription = await transcribe({
              model: openai.transcription('whisper-1'),
              audio: audioBuffer,
            });
            results.audioTranscription = transcription;
          }
        } catch (error) {
          errors.push(
            `Audio transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      if (errors.length > 0) {
        results.errors = errors;
      }

      return results;
    } catch (error) {
      throw new Error(
        `Video processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
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

      video.onloadedmetadata = () => resolve(video);
      video.onerror = () => reject(new Error('Failed to load video'));

      video.src = videoData.startsWith('data:')
        ? videoData
        : `data:video/mp4;base64,${videoData}`;
    });
  }

  /**
   * Extract video metadata
   */
  private async extractVideoMetadata(video: HTMLVideoElement): Promise<{
    duration: number;
    width: number;
    height: number;
    hasAudio: boolean;
    frameRate?: number;
  }> {
    return {
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      hasAudio:
        (video as any).audioTracks?.length > 0 ||
        (video as any).webkitAudioDecodedByteCount > 0,
      frameRate: 30, // Default, could be calculated more precisely
    };
  }

  /**
   * Extract frames from video at specified intervals
   */
  private async extractVideoFrames(
    video: HTMLVideoElement,
    options: {
      interval: number;
      maxFrames: number;
    }
  ): Promise<
    Array<{
      timestamp: number;
      dataUrl: string;
      width: number;
      height: number;
    }>
  > {
    const frames: Array<{
      timestamp: number;
      dataUrl: string;
      width: number;
      height: number;
    }> = [];

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const duration = video.duration;
    const frameCount = Math.min(
      Math.floor(duration / options.interval),
      options.maxFrames
    );

    for (let i = 0; i < frameCount; i++) {
      const timestamp = i * options.interval;

      // Seek to timestamp
      video.currentTime = timestamp;
      await new Promise((resolve) => {
        video.onseeked = resolve;
        video.ontimeupdate = resolve;
      });

      // Draw frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Extract frame as data URL
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

      frames.push({
        timestamp,
        dataUrl,
        width: canvas.width,
        height: canvas.height,
      });
    }

    return frames;
  }

  /**
   * Analyze extracted video frames
   */
  private async analyzeVideoFrames(
    frames: Array<{
      timestamp: number;
      dataUrl: string;
      width: number;
      height: number;
    }>
  ): Promise<{
    sceneDetection: any[];
    objectDetection: any[];
    summary: string;
    keyMoments: any[];
  }> {
    const analysis = {
      sceneDetection: [] as any[],
      objectDetection: [] as any[],
      summary: '',
      keyMoments: [] as any[],
    };

    // Analyze a subset of frames to avoid overwhelming the AI
    const samplesToAnalyze = frames.slice(0, 5);

    for (const frame of samplesToAnalyze) {
      try {
        const frameAnalysis = await generateObject({
          model: openai('gpt-4o'),
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analyze this video frame at timestamp ${frame.timestamp}s. Describe the scene, identify objects, activities, and any significant changes from previous frames.`,
                },
                { type: 'image', image: frame.dataUrl },
              ],
            },
          ],
          schema: z.object({
            scene: z.string().describe('Description of the scene'),
            objects: z
              .array(z.string())
              .describe('Objects visible in the frame'),
            activities: z
              .array(z.string())
              .describe('Activities or actions taking place'),
            mood: z.string().describe('Overall mood or atmosphere'),
            significance: z
              .number()
              .min(1)
              .max(10)
              .describe('How significant is this frame (1-10)'),
            changes: z
              .string()
              .optional()
              .describe('Notable changes from previous context'),
          }),
        });

        analysis.sceneDetection.push({
          timestamp: frame.timestamp,
          ...frameAnalysis.object,
        });

        if (frameAnalysis.object.significance >= 7) {
          analysis.keyMoments.push({
            timestamp: frame.timestamp,
            description: frameAnalysis.object.scene,
            significance: frameAnalysis.object.significance,
          });
        }
      } catch (error) {
        console.warn(`Failed to analyze frame at ${frame.timestamp}s:`, error);
      }
    }

    // Generate overall summary
    try {
      const summaryAnalysis = await generateObject({
        model: openai('gpt-4o'),
        prompt: `Based on these video frame analyses, provide a comprehensive summary: ${JSON.stringify(analysis.sceneDetection)}`,
        schema: z.object({
          summary: z.string().describe('Overall summary of the video content'),
          mainThemes: z.array(z.string()).describe('Main themes or topics'),
          contentType: z
            .string()
            .describe(
              'Type of video content (educational, entertainment, etc.)'
            ),
        }),
      });

      analysis.summary = summaryAnalysis.object.summary;
    } catch (error) {
      analysis.summary = 'Unable to generate video summary';
    }

    return analysis;
  }

  /**
   * Extract audio track from video
   */
  private async extractAudioFromVideo(
    video: HTMLVideoElement
  ): Promise<Uint8Array | null> {
    try {
      // This is a simplified approach - in production you'd want to use Web Audio API
      // or a library like ffmpeg.wasm for proper audio extraction

      if (
        !(video as any).audioTracks ||
        (video as any).audioTracks.length === 0
      ) {
        return null;
      }

      // For now, we'll return null and handle audio extraction differently
      // In a real implementation, you'd use MediaRecorder or Web Audio API
      return null;
    } catch (error) {
      console.warn('Audio extraction not fully implemented:', error);
      return null;
    }
  }

  /**
   * Unified attachment processor that handles all types
   */
  async processAttachment(attachment: FileAttachment): Promise<{
    type: string;
    originalName: string;
    processedData: any;
    error?: string;
  }> {
    try {
      const { type, base64, name } = attachment;

      if (type.startsWith('image/')) {
        const processedData = await this.processImageAttachment(base64 || '');
        return { type: 'image', originalName: name, processedData };
      }

      if (type.startsWith('audio/')) {
        const processedData = await this.processAudioAttachment(base64 || '');
        return { type: 'audio', originalName: name, processedData };
      }

      if (
        type.includes('pdf') ||
        type.includes('document') ||
        type.startsWith('text/')
      ) {
        const processedData = await this.processDocumentAttachment(
          base64 || '',
          type
        );
        return { type: 'document', originalName: name, processedData };
      }

      if (type.startsWith('video/')) {
        const processedData = await this.processVideoAttachment(base64 || '');
        return { type: 'video', originalName: name, processedData };
      }

      return {
        type: 'unknown',
        originalName: name,
        processedData: null,
        error: `Unsupported file type: ${type}`,
      };
    } catch (error) {
      return {
        type: attachment.type,
        originalName: attachment.name,
        processedData: null,
        error: error instanceof Error ? error.message : 'Processing failed',
      };
    }
  }
}

// Export singleton instance
export const multiModalProcessor = new AdvancedMultiModal();

// Enhanced attachment processing for AI messages
export async function processAttachmentsForAIEnhanced(
  attachments: FileAttachment[],
  messageText: string,
  userId?: string,
  options?: {
    enableOCR?: boolean;
    enableAnalysis?: boolean;
    enableTranscription?: boolean;
  }
): Promise<{
  systemPrompt: string;
  messageContent: string;
  processedAttachments?: any[];
  error?: string;
}> {
  if (!attachments || attachments.length === 0) {
    return { systemPrompt: '', messageContent: messageText };
  }

  const opts = {
    enableOCR: true,
    enableAnalysis: true,
    enableTranscription: true,
    ...options,
  };

  // Validate attachments first
  const validation = await validateAttachments(attachments, userId);
  if (!validation.valid) {
    return {
      systemPrompt: '',
      messageContent: messageText,
      error: validation.error,
    };
  }

  const safeAttachments = validation.sanitizedAttachments!;
  const processedAttachments: any[] = [];

  let systemPrompt = '\n\nProcessed attachments:';
  let enhancedContent = messageText;

  // Process each attachment with advanced capabilities
  for (const attachment of safeAttachments) {
    const processed = await multiModalProcessor.processAttachment(attachment);
    processedAttachments.push(processed);

    if (processed.error) {
      systemPrompt += `\n- ${attachment.name}: Processing failed (${processed.error})`;
      continue;
    }

    // Add processed data to the message based on type
    if (processed.type === 'image' && processed.processedData) {
      const { extractedText, analysis } = processed.processedData;
      systemPrompt += `\n- Image: ${attachment.name}`;

      if (extractedText) {
        systemPrompt += ` (contains text: "${extractedText.substring(0, 100)}...")`;
      }

      if (analysis) {
        enhancedContent += `\n\n[Image Analysis for ${attachment.name}]:\n`;
        enhancedContent += `Description: ${analysis.description}\n`;
        enhancedContent += `Objects: ${analysis.objects.join(', ')}\n`;
        enhancedContent += `Mood: ${analysis.mood}`;
      }
    }

    if (processed.type === 'audio' && processed.processedData) {
      const { transcription, analysis } = processed.processedData;
      systemPrompt += `\n- Audio: ${attachment.name} (transcribed)`;

      if (transcription?.text) {
        enhancedContent += `\n\n[Audio Transcription for ${attachment.name}]:\n${transcription.text}`;
      }

      if (analysis) {
        enhancedContent += '\n\nAnalysis:\n';
        enhancedContent += `- Sentiment: ${analysis.sentiment}\n`;
        enhancedContent += `- Topics: ${analysis.topics.join(', ')}\n`;
        if (analysis.actionItems.length > 0) {
          enhancedContent += `- Action Items: ${analysis.actionItems.join('; ')}`;
        }
      }
    }

    if (processed.type === 'document' && processed.processedData) {
      const { content, analysis } = processed.processedData;
      systemPrompt += `\n- Document: ${attachment.name} (${analysis?.documentType || 'processed'})`;

      if (analysis) {
        enhancedContent += `\n\n[Document Summary for ${attachment.name}]:\n${analysis.summary}`;
      }
    }
  }

  return {
    systemPrompt,
    messageContent: enhancedContent,
    processedAttachments,
  };
}
