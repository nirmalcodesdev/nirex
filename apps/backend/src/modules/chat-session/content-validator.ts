import { MAX_MESSAGE_CONTENT_SIZE, MAX_MESSAGE_METADATA_SIZE } from '@nirex/shared';
import { AppError } from '../../types/index.js';

/**
 * Content validation result
 */
interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string;
}

/**
 * Sanitize HTML content to prevent XSS
 * Removes all HTML tags and decodes entities
 */
function sanitizeHtml(content: string): string {
  // Remove script tags and their contents
  let sanitized = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Remove event handlers (onclick, onload, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');

  // Remove javascript: and data: URLs
  sanitized = sanitized.replace(/(javascript|data):/gi, '');

  // Remove all remaining HTML tags
  sanitized = sanitized.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#39;': "'",
    '&#47;': '/',
    '&nbsp;': ' ',
  };

  sanitized = sanitized.replace(/&[^;]+;/g, (match) => entities[match] || match);

  return sanitized.trim();
}

/**
 * Check if content contains potentially dangerous patterns
 */
function containsDangerousContent(content: string): boolean {
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /data:text\/html/i,
    /eval\s*\(/i,
    /document\.cookie/i,
    /document\.write/i,
    /window\.location/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ];

  return dangerousPatterns.some((pattern) => pattern.test(content));
}

/**
 * Validate message content
 */
export function validateMessageContent(content: string): ValidationResult {
  // Check if empty
  if (!content || content.trim().length === 0) {
    return { valid: false, error: 'Message content cannot be empty' };
  }

  // Check size (UTF-8 byte length)
  const byteLength = new TextEncoder().encode(content).length;
  if (byteLength > MAX_MESSAGE_CONTENT_SIZE) {
    return {
      valid: false,
      error: `Message content exceeds ${MAX_MESSAGE_CONTENT_SIZE / 1024}KB limit`,
    };
  }

  // Check for dangerous content
  if (containsDangerousContent(content)) {
    return { valid: false, error: 'Message contains potentially dangerous content' };
  }

  // Sanitize content
  const sanitized = sanitizeHtml(content);

  // Check if sanitized content is empty
  if (sanitized.length === 0) {
    return { valid: false, error: 'Message content is invalid after sanitization' };
  }

  return { valid: true, sanitized };
}

/**
 * Validate metadata
 */
export function validateMetadata(metadata: Record<string, unknown> | undefined): ValidationResult {
  if (!metadata) {
    return { valid: true };
  }

  // Check size
  const metadataString = JSON.stringify(metadata);
  const byteLength = new TextEncoder().encode(metadataString).length;

  if (byteLength > MAX_MESSAGE_METADATA_SIZE) {
    return {
      valid: false,
      error: `Metadata exceeds ${MAX_MESSAGE_METADATA_SIZE / 1024}KB limit`,
    };
  }

  // Check for circular references and dangerous values
  try {
    JSON.parse(JSON.stringify(metadata));
  } catch {
    return { valid: false, error: 'Metadata contains invalid values' };
  }

  return { valid: true };
}

/**
 * Validate and sanitize session name
 */
export function validateSessionName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Session name cannot be empty' };
  }

  if (name.length > 200) {
    return { valid: false, error: 'Session name exceeds 200 characters' };
  }

  const sanitized = sanitizeHtml(name);

  if (sanitized.length === 0) {
    return { valid: false, error: 'Session name is invalid after sanitization' };
  }

  return { valid: true, sanitized };
}

/**
 * Validate working directory path
 */
export function validateWorkingDirectory(path: string): ValidationResult {
  if (!path || path.trim().length === 0) {
    return { valid: false, error: 'Working directory cannot be empty' };
  }

  if (path.length > 1000) {
    return { valid: false, error: 'Working directory path exceeds 1000 characters' };
  }

  // Check for path traversal attempts
  const dangerousPatterns = [/\.\.\//, /\.\.\\/, /%2e%2e%2f/i, /%2e%2e\//i];
  if (dangerousPatterns.some((pattern) => pattern.test(path))) {
    return { valid: false, error: 'Invalid working directory path' };
  }

  return { valid: true, sanitized: path.trim() };
}

/**
 * Throw AppError if validation fails
 */
export function assertValidMessageContent(content: string): string {
  const result = validateMessageContent(content);
  if (!result.valid) {
    throw new AppError(result.error!, 400, 'VALIDATION_ERROR');
  }
  return result.sanitized!;
}

/**
 * Throw AppError if metadata validation fails
 */
export function assertValidMetadata(metadata: Record<string, unknown> | undefined): void {
  const result = validateMetadata(metadata);
  if (!result.valid) {
    throw new AppError(result.error!, 400, 'VALIDATION_ERROR');
  }
}

/**
 * Throw AppError if working directory validation fails
 */
export function assertValidWorkingDirectory(path: string): string {
  const result = validateWorkingDirectory(path);
  if (!result.valid) {
    throw new AppError(result.error!, 400, 'VALIDATION_ERROR');
  }
  return result.sanitized!;
}
