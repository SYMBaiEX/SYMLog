// Security utilities for input sanitization

/**
 * Sanitize user input for inclusion in AI prompts
 * Removes characters that could be used for prompt injection
 */
export function sanitizeForPrompt(input: string): string {
  if (!input || typeof input !== 'string') return '';

  // Remove potential injection characters and limit length
  return input
    .replace(/[<>{}[\]]/g, '') // Remove brackets and braces
    .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
    .replace(/[^\x20-\x7E\n\r\t]/g, '') // Keep only printable ASCII + newlines
    .substring(0, 100) // Limit length to prevent context overflow
    .trim();
}

/**
 * Validate and sanitize error parameters for redirects
 */
export function sanitizeErrorParam(error: string | null): string {
  const VALID_ERRORS = [
    'access_denied',
    'invalid_grant',
    'server_error',
    'temporarily_unavailable',
    'invalid_request',
    'unauthorized_client',
    'unsupported_response_type',
    'invalid_scope',
    'insufficient_scope',
    'invalid_token',
    'login_required',
    'consent_required',
    'interaction_required',
    'account_selection_required',
  ];

  if (!(error && VALID_ERRORS.includes(error))) {
    return 'unknown_error';
  }

  return error;
}

/**
 * Sanitize URLs to prevent open redirects
 */
export function sanitizeRedirectUrl(
  url: string,
  allowedDomains: string[]
): string | null {
  try {
    const parsed = new URL(url);

    // Check if the domain is in the allowed list
    const isAllowed = allowedDomains.some((domain) => {
      if (domain.startsWith('*.')) {
        // Wildcard subdomain matching
        const baseDomain = domain.slice(2);
        return (
          parsed.hostname === baseDomain ||
          parsed.hostname.endsWith(`.${baseDomain}`)
        );
      }
      return parsed.hostname === domain;
    });

    if (!isAllowed) {
      return null;
    }

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitize file attachments
 */
export interface SanitizedAttachment {
  name: string;
  size: number;
  type: string;
  valid: boolean;
  error?: string;
}

export function sanitizeAttachment(attachment: any): SanitizedAttachment {
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/json',
  ];

  // Validate structure
  if (!attachment || typeof attachment !== 'object') {
    return {
      name: 'unknown',
      size: 0,
      type: 'unknown',
      valid: false,
      error: 'Invalid attachment structure',
    };
  }

  const name =
    typeof attachment.name === 'string'
      ? attachment.name.substring(0, 255)
      : 'unnamed';
  const size = typeof attachment.size === 'number' ? attachment.size : 0;
  const type =
    typeof attachment.type === 'string'
      ? attachment.type
      : 'application/octet-stream';

  // Validate size
  if (size > MAX_SIZE) {
    return {
      name,
      size,
      type,
      valid: false,
      error: 'File too large (max 10MB)',
    };
  }

  // Validate type
  if (!ALLOWED_TYPES.includes(type)) {
    return { name, size, type, valid: false, error: 'File type not allowed' };
  }

  return { name, size, type, valid: true };
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return str.replace(/[&<>"'/]/g, (char) => htmlEscapes[char]);
}
