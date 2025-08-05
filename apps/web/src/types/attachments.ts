export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  base64?: string;
  preview?: string;
  uploadedAt: number;
}

export interface ImageAttachment extends FileAttachment {
  width?: number;
  height?: number;
  alt?: string;
}

export interface DocumentAttachment extends FileAttachment {
  pageCount?: number;
  content?: string;
}

export type AttachmentType =
  | 'image'
  | 'document'
  | 'audio'
  | 'video'
  | 'code'
  | 'data'
  | 'other';

export interface MessageWithAttachments {
  text: string;
  attachments?: FileAttachment[];
}

// Supported file types
export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

export const SUPPORTED_DOCUMENT_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'text/html',
  'text/css',
  'text/javascript',
  'text/typescript',
];

export const SUPPORTED_CODE_TYPES = [
  'text/javascript',
  'text/typescript',
  'text/python',
  'text/java',
  'text/cpp',
  'text/c',
  'text/csharp',
  'text/go',
  'text/rust',
  'text/php',
  'text/ruby',
  'text/swift',
  'text/kotlin',
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_FILES_PER_MESSAGE = 5;

export function getAttachmentType(mimeType: string): AttachmentType {
  if (SUPPORTED_IMAGE_TYPES.includes(mimeType)) return 'image';
  if (SUPPORTED_DOCUMENT_TYPES.includes(mimeType)) return 'document';
  if (SUPPORTED_CODE_TYPES.includes(mimeType)) return 'code';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.includes('json') || mimeType.includes('csv')) return 'data';
  return 'other';
}

export function isFileTypeSupported(mimeType: string): boolean {
  return [
    ...SUPPORTED_IMAGE_TYPES,
    ...SUPPORTED_DOCUMENT_TYPES,
    ...SUPPORTED_CODE_TYPES,
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'video/mp4',
    'video/webm',
  ].includes(mimeType);
}
