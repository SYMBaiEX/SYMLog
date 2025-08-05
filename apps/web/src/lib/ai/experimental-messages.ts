// experimental-messages.ts - Enhanced message handling for AI SDK v5
// Implements the message parts structure and advanced message management

import type { ModelMessage } from 'ai';

// Enhanced message part types
export type MessagePartType =
  | 'text'
  | 'tool-call'
  | 'tool-result'
  | 'step-start'
  | 'reasoning'
  | 'file'
  | 'image'
  | 'audio'
  | 'video'
  | 'dynamic-tool'
  | 'error';

// Base message part interface
export interface BaseMessagePart {
  type: MessagePartType;
  id?: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

// Text message part
export interface TextMessagePart extends BaseMessagePart {
  type: 'text';
  text: string;
  language?: string;
  format?: 'plain' | 'markdown' | 'code';
}

// Tool call message part
export interface ToolCallMessagePart extends BaseMessagePart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  input: any;
  state?: 'pending' | 'executing' | 'completed' | 'failed';
}

// Tool result message part
export interface ToolResultMessagePart extends BaseMessagePart {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  output: any;
  error?: string;
  executionTime?: number;
}

// Step start message part
export interface StepStartMessagePart extends BaseMessagePart {
  type: 'step-start';
  stepNumber: number;
  stepType: 'initial' | 'continue' | 'tool-result';
  description?: string;
}

// Reasoning message part
export interface ReasoningMessagePart extends BaseMessagePart {
  type: 'reasoning';
  reasoning: string;
  confidence?: number;
}

// File message part
export interface FileMessagePart extends BaseMessagePart {
  type: 'file';
  filename: string;
  mediaType: string;
  data: string | Uint8Array;
  size?: number;
}

// Image message part
export interface ImageMessagePart extends BaseMessagePart {
  type: 'image';
  image: string | Uint8Array;
  mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  alt?: string;
  width?: number;
  height?: number;
}

// Audio message part
export interface AudioMessagePart extends BaseMessagePart {
  type: 'audio';
  audio: string | Uint8Array;
  mediaType: 'audio/mp3' | 'audio/wav' | 'audio/ogg';
  duration?: number;
  transcript?: string;
}

// Video message part
export interface VideoMessagePart extends BaseMessagePart {
  type: 'video';
  video: string | Uint8Array;
  mediaType: 'video/mp4' | 'video/webm';
  duration?: number;
  width?: number;
  height?: number;
}

// Dynamic tool message part
export interface DynamicToolMessagePart extends BaseMessagePart {
  type: 'dynamic-tool';
  toolName: string;
  input: unknown;
  output?: unknown;
  dynamic: true;
}

// Error message part
export interface ErrorMessagePart extends BaseMessagePart {
  type: 'error';
  error: string;
  code?: string;
  details?: any;
}

// Union type for all message parts
export type MessagePart =
  | TextMessagePart
  | ToolCallMessagePart
  | ToolResultMessagePart
  | StepStartMessagePart
  | ReasoningMessagePart
  | FileMessagePart
  | ImageMessagePart
  | AudioMessagePart
  | VideoMessagePart
  | DynamicToolMessagePart
  | ErrorMessagePart;

// Enhanced message with parts
export interface EnhancedMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string;
  parts: MessagePart[];
  metadata?: {
    model?: string;
    timestamp?: Date;
    tokenUsage?: {
      prompt: number;
      completion: number;
      total: number;
    };
    [key: string]: any;
  };
}

/**
 * Message Manager for enhanced message handling
 */
export class MessageManager {
  /**
   * Convert standard messages to enhanced format
   */
  static toEnhanced(messages: ModelMessage[]): EnhancedMessage[] {
    return messages.map((message, index) => {
      const enhanced: EnhancedMessage = {
        id: `msg-${index}`,
        role: message.role,
        parts: [],
      };

      // Handle different content formats
      if (typeof message.content === 'string') {
        enhanced.content = message.content;
        enhanced.parts = [
          {
            type: 'text',
            text: message.content,
          },
        ];
      } else if (Array.isArray(message.content)) {
        enhanced.parts = message.content.map((part: any) =>
          MessageManager.convertContentPart(part)
        );
      }

      return enhanced;
    });
  }

  /**
   * Convert enhanced messages back to standard format
   */
  static fromEnhanced(messages: EnhancedMessage[]): ModelMessage[] {
    return messages.map((message) => {
      // If there's only text content, return simple format
      if (message.parts.length === 1 && message.parts[0].type === 'text') {
        return {
          role: message.role,
          content: (message.parts[0] as TextMessagePart).text,
        };
      }

      // Otherwise, return parts array
      return {
        role: message.role,
        content: message.parts.map((part) =>
          MessageManager.convertPartToContent(part)
        ),
      };
    }) as ModelMessage[];
  }

  /**
   * Convert content part to message part
   */
  private static convertContentPart(part: any): MessagePart {
    switch (part.type) {
      case 'text':
        return {
          type: 'text',
          text: part.text || part.content || '',
        };

      case 'image':
        return {
          type: 'image',
          image: part.image || part.data,
          mediaType: part.mediaType || 'image/png',
          alt: part.alt,
        };

      case 'tool-call':
        return {
          type: 'tool-call',
          toolCallId: part.toolCallId || part.id,
          toolName: part.toolName || part.name,
          input: part.input || part.args,
          state: part.state,
        };

      case 'tool-result':
        return {
          type: 'tool-result',
          toolCallId: part.toolCallId || part.id,
          toolName: part.toolName || part.name,
          output: part.output || part.result,
          error: part.error,
        };

      case 'file':
        return {
          type: 'file',
          filename: part.filename || part.name || 'file',
          mediaType:
            part.mediaType || part.mimeType || 'application/octet-stream',
          data: part.data || part.content,
        };

      default:
        return {
          type: 'text',
          text: JSON.stringify(part),
        };
    }
  }

  /**
   * Convert message part back to content format
   */
  private static convertPartToContent(part: MessagePart): any {
    switch (part.type) {
      case 'text':
        return {
          type: 'text',
          text: part.text,
        };

      case 'image':
        return {
          type: 'image',
          image: part.image,
          mediaType: part.mediaType,
        };

      case 'tool-call':
        return {
          type: 'tool-call',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: part.input,
        };

      case 'tool-result':
        return {
          type: 'tool-result',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          output: part.output,
        };

      default:
        return part;
    }
  }

  /**
   * Filter message parts by type
   */
  static filterParts(
    messages: EnhancedMessage[],
    types: MessagePartType[]
  ): MessagePart[] {
    const parts: MessagePart[] = [];

    for (const message of messages) {
      for (const part of message.parts) {
        if (types.includes(part.type)) {
          parts.push(part);
        }
      }
    }

    return parts;
  }

  /**
   * Extract text content from messages
   */
  static extractText(messages: EnhancedMessage[]): string {
    const textParts = MessageManager.filterParts(messages, [
      'text',
      'reasoning',
    ]);
    return textParts
      .map((part) => {
        if (part.type === 'text') return part.text;
        if (part.type === 'reasoning') return part.reasoning;
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  }

  /**
   * Extract tool interactions from messages
   */
  static extractToolInteractions(messages: EnhancedMessage[]): Array<{
    call: ToolCallMessagePart;
    result?: ToolResultMessagePart;
  }> {
    const toolCalls = MessageManager.filterParts(messages, [
      'tool-call',
    ]) as ToolCallMessagePart[];
    const toolResults = MessageManager.filterParts(messages, [
      'tool-result',
    ]) as ToolResultMessagePart[];

    return toolCalls.map((call) => ({
      call,
      result: toolResults.find(
        (result) => result.toolCallId === call.toolCallId
      ),
    }));
  }

  /**
   * Compress message history while preserving important parts
   */
  static compress(
    messages: EnhancedMessage[],
    options?: {
      maxMessages?: number;
      preserveTypes?: MessagePartType[];
      summarize?: boolean;
    }
  ): EnhancedMessage[] {
    const maxMessages = options?.maxMessages || 10;
    const preserveTypes = options?.preserveTypes || [
      'tool-call',
      'tool-result',
      'error',
    ];

    // Always keep system messages
    const systemMessages = messages.filter((m) => m.role === 'system');

    // Keep messages with important parts
    const importantMessages = messages.filter((m) =>
      m.parts.some((p) => preserveTypes.includes(p.type))
    );

    // Get recent messages
    const recentMessages = messages.slice(-maxMessages);

    // Combine and deduplicate
    const compressed = new Map<string, EnhancedMessage>();

    [...systemMessages, ...importantMessages, ...recentMessages].forEach(
      (msg) => {
        if (msg.id) {
          compressed.set(msg.id, msg);
        }
      }
    );

    // Sort by original order
    return Array.from(compressed.values()).sort((a, b) => {
      const indexA = messages.findIndex((m) => m.id === a.id);
      const indexB = messages.findIndex((m) => m.id === b.id);
      return indexA - indexB;
    });
  }

  /**
   * Add step boundaries to messages
   */
  static addStepBoundaries(
    messages: EnhancedMessage[],
    stepInfo: Array<{
      type: 'initial' | 'continue' | 'tool-result';
      description?: string;
    }>
  ): EnhancedMessage[] {
    const result: EnhancedMessage[] = [];
    let stepNumber = 0;

    for (let i = 0; i < messages.length; i++) {
      // Add step boundary if needed
      if (i < stepInfo.length) {
        const stepPart: StepStartMessagePart = {
          type: 'step-start',
          stepNumber: stepNumber++,
          stepType: stepInfo[i].type,
          description: stepInfo[i].description,
        };

        // Add to assistant message or create new one
        if (messages[i].role === 'assistant') {
          result.push({
            ...messages[i],
            parts: [stepPart, ...messages[i].parts],
          });
        } else {
          result.push({
            id: `step-${stepNumber}`,
            role: 'assistant',
            parts: [stepPart],
          });
          result.push(messages[i]);
        }
      } else {
        result.push(messages[i]);
      }
    }

    return result;
  }

  /**
   * Validate message structure
   */
  static validate(message: EnhancedMessage): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check required fields
    if (!message.role) {
      errors.push('Message must have a role');
    }

    if (message.parts && Array.isArray(message.parts)) {
      // Validate each part
      message.parts.forEach((part, index) => {
        if (!part.type) {
          errors.push(`Part ${index} must have a type`);
        }

        // Type-specific validation
        switch (part.type) {
          case 'text':
            if (!(part as TextMessagePart).text) {
              errors.push(`Text part ${index} must have text content`);
            }
            break;

          case 'tool-call': {
            const toolCall = part as ToolCallMessagePart;
            if (!(toolCall.toolCallId && toolCall.toolName)) {
              errors.push(
                `Tool call part ${index} must have toolCallId and toolName`
              );
            }
            break;
          }

          case 'tool-result': {
            const toolResult = part as ToolResultMessagePart;
            if (!toolResult.toolCallId) {
              errors.push(`Tool result part ${index} must have toolCallId`);
            }
            break;
          }
        }
      });
    } else {
      errors.push('Message must have parts array');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Message streaming utilities
 */
export class MessageStreamer {
  private buffer: MessagePart[] = [];
  private currentMessage: EnhancedMessage | null = null;

  /**
   * Process a streaming chunk
   */
  processChunk(chunk: any): EnhancedMessage | null {
    if (chunk.type === 'text-delta') {
      // Accumulate text
      if (!this.currentMessage) {
        this.currentMessage = {
          id: `stream-${Date.now()}`,
          role: 'assistant',
          parts: [],
        };
      }

      const lastPart =
        this.currentMessage.parts[this.currentMessage.parts.length - 1];
      if (lastPart?.type === 'text') {
        (lastPart as TextMessagePart).text += chunk.textDelta;
      } else {
        this.currentMessage.parts.push({
          type: 'text',
          text: chunk.textDelta,
        });
      }

      return this.currentMessage;
    }

    if (chunk.type === 'tool-call-delta') {
      // Handle tool call streaming
      // Implementation depends on specific streaming format
    }

    return null;
  }

  /**
   * Get the final message
   */
  finalize(): EnhancedMessage | null {
    const message = this.currentMessage;
    this.currentMessage = null;
    this.buffer = [];
    return message;
  }
}

// Classes are already exported above
