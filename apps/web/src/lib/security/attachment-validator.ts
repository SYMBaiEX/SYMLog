import { logSecurityEvent } from '@/lib/logger';
import type { FileAttachment } from '@/types/attachments';

// Security constants for attachment validation
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB total
const MAX_ATTACHMENTS = 10;

// Allowed MIME types and extensions
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

const ALLOWED_TEXT_TYPES = [
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'text/css',
  'text/javascript',
  'application/json',
  'application/xml',
  'application/x-yaml',
  'application/x-python',
  'application/x-ruby',
  'application/x-sh',
];

const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const ALLOWED_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_TEXT_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
];

// Dangerous file extensions that should be blocked
const BLOCKED_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.wsf',
  '.wsh',
  '.msi',
  '.jar',
  '.app',
  '.deb',
  '.rpm',
  '.dmg',
  '.pkg',
  '.run',
  '.bundle',
  '.ipa',
  '.apk',
  '.appimage',
  '.snap',
  '.flatpak',
];

// Magic bytes for file type verification
const FILE_SIGNATURES: Record<string, { offset: number; bytes: number[] }[]> = {
  'image/jpeg': [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  'image/png': [
    { offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  ],
  'image/gif': [
    { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
    { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
  ],
  'image/webp': [
    { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
    { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }, // WEBP
  ],
  'application/pdf': [
    { offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  ],
};

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedAttachments?: FileAttachment[];
}

/**
 * Validate file attachments for security
 */
export async function validateAttachments(
  attachments: FileAttachment[],
  userId?: string
): Promise<ValidationResult> {
  if (!attachments || attachments.length === 0) {
    return { valid: true, sanitizedAttachments: [] };
  }

  // Check maximum number of attachments
  if (attachments.length > MAX_ATTACHMENTS) {
    logSecurityEvent({
      type: 'VALIDATION_FAILED',
      userId,
      metadata: {
        reason: 'too_many_attachments',
        count: attachments.length,
        limit: MAX_ATTACHMENTS,
      },
    });
    return {
      valid: false,
      error: `Maximum ${MAX_ATTACHMENTS} attachments allowed`,
    };
  }

  const sanitizedAttachments: FileAttachment[] = [];
  let totalSize = 0;

  for (const attachment of attachments) {
    // Validate individual file size
    if (attachment.size > MAX_FILE_SIZE) {
      logSecurityEvent({
        type: 'VALIDATION_FAILED',
        userId,
        metadata: {
          reason: 'file_too_large',
          fileName: attachment.name,
          size: attachment.size,
          limit: MAX_FILE_SIZE,
        },
      });
      return {
        valid: false,
        error: `File "${attachment.name}" exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      };
    }

    // Check total size
    totalSize += attachment.size;
    if (totalSize > MAX_TOTAL_SIZE) {
      logSecurityEvent({
        type: 'VALIDATION_FAILED',
        userId,
        metadata: {
          reason: 'total_size_exceeded',
          totalSize,
          limit: MAX_TOTAL_SIZE,
        },
      });
      return {
        valid: false,
        error: `Total attachment size exceeds ${MAX_TOTAL_SIZE / 1024 / 1024}MB`,
      };
    }

    // Validate file extension
    const extension = attachment.name.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (extension && BLOCKED_EXTENSIONS.includes(extension)) {
      logSecurityEvent({
        type: 'SECURITY_VIOLATION',
        userId,
        metadata: {
          reason: 'blocked_file_extension',
          fileName: attachment.name,
          extension,
        },
      });
      return {
        valid: false,
        error: `File type "${extension}" is not allowed`,
      };
    }

    // Validate MIME type
    if (!ALLOWED_TYPES.includes(attachment.type)) {
      logSecurityEvent({
        type: 'VALIDATION_FAILED',
        userId,
        metadata: {
          reason: 'invalid_mime_type',
          fileName: attachment.name,
          mimeType: attachment.type,
        },
      });
      return {
        valid: false,
        error: `File type "${attachment.type}" is not allowed`,
      };
    }

    // Verify file signature if possible
    if (attachment.base64 && FILE_SIGNATURES[attachment.type]) {
      const isValidSignature = await verifyFileSignature(
        attachment.base64,
        attachment.type
      );

      if (!isValidSignature) {
        logSecurityEvent({
          type: 'SECURITY_VIOLATION',
          userId,
          metadata: {
            reason: 'file_signature_mismatch',
            fileName: attachment.name,
            claimedType: attachment.type,
          },
        });
        return {
          valid: false,
          error: `File "${attachment.name}" content does not match its type`,
        };
      }
    }

    // Sanitize filename
    const sanitizedName = sanitizeFileName(attachment.name);

    // Create sanitized attachment
    sanitizedAttachments.push({
      ...attachment,
      name: sanitizedName,
    });
  }

  return {
    valid: true,
    sanitizedAttachments,
  };
}

/**
 * Verify file signature matches claimed MIME type
 */
async function verifyFileSignature(
  base64Data: string,
  mimeType: string
): Promise<boolean> {
  try {
    const signatures = FILE_SIGNATURES[mimeType];
    if (!signatures) return true; // No signature to verify

    // Extract the binary data from base64
    const base64Content = base64Data.includes(',')
      ? base64Data.split(',')[1]
      : base64Data;

    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Check each possible signature
    for (const signature of signatures) {
      let matches = true;

      for (let i = 0; i < signature.bytes.length; i++) {
        if (bytes[signature.offset + i] !== signature.bytes[i]) {
          matches = false;
          break;
        }
      }

      if (matches) return true;
    }

    return false;
  } catch (error) {
    console.error('Error verifying file signature:', error);
    return false;
  }
}

/**
 * Sanitize filename to prevent path traversal and other attacks
 */
function sanitizeFileName(fileName: string): string {
  // Remove any path components
  const baseName = fileName.split(/[/\\]/).pop() || 'unnamed';

  // Remove dangerous characters
  const sanitized = baseName
    .replace(/[<>:"|?*\x00-\x1F]/g, '_') // Remove invalid filename chars
    .replace(/\.{2,}/g, '_') // Remove multiple dots
    .replace(/^\./, '_') // Remove leading dot
    .slice(0, 255); // Limit length

  return sanitized || 'unnamed';
}

/**
 * Check if content contains potentially malicious patterns
 */
export function scanForMaliciousContent(
  content: string,
  mimeType: string
): { safe: boolean; reason?: string } {
  // For text-based files, check for suspicious patterns
  if (mimeType.startsWith('text/') || mimeType === 'application/json') {
    // Check for script tags in text files
    if (/<script[\s>]/i.test(content)) {
      return { safe: false, reason: 'Contains script tags' };
    }

    // Check for event handlers
    if (/on\w+\s*=/i.test(content)) {
      return { safe: false, reason: 'Contains event handlers' };
    }

    // Check for javascript: protocol
    if (/javascript:/i.test(content)) {
      return { safe: false, reason: 'Contains javascript: protocol' };
    }

    // Check for data: protocol with script
    if (/data:[^,]*script/i.test(content)) {
      return { safe: false, reason: 'Contains data: protocol with script' };
    }
  }

  // For SVG files, check for script content
  if (
    mimeType === 'image/svg+xml' &&
    (/<script[\s>]/i.test(content) || /on\w+\s*=/i.test(content))
  ) {
    return { safe: false, reason: 'SVG contains scripting' };
  }

  return { safe: true };
}
