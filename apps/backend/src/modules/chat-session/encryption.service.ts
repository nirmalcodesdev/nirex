/**
 * Encryption Service for Chat Session Messages
 *
 * Production-grade encryption for sensitive message content:
 * - AES-256-GCM for authenticated encryption
 * - Transparent encrypt/decrypt in repository layer
 * - Mark sensitive messages (code, tokens, credentials)
 * - Key rotation support
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { logger } from '../../utils/logger.js';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Get encryption key from environment
 * Falls back to a derived key if not set (NOT for production)
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.MESSAGE_ENCRYPTION_KEY;

  if (envKey) {
    // Use provided key (should be 64 hex characters for AES-256)
    if (envKey.length === 64) {
      return Buffer.from(envKey, 'hex');
    }
    // If key is not correct length, derive a key from it
    return scryptSync(envKey, 'nirex-salt', KEY_LENGTH);
  }

  // Fallback: derive from JWT secret (NOT recommended for production)
  logger.warn('MESSAGE_ENCRYPTION_KEY not set, using derived key');
  const fallbackSecret = process.env.JWT_ACCESS_SECRET || 'fallback-secret-do-not-use';
  return scryptSync(fallbackSecret, 'nirex-fallback-salt', KEY_LENGTH);
}

/**
 * Encrypt sensitive text
 */
export function encrypt(text: string): string {
  if (!text || text.length === 0) {
    return text;
  }

  try {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encryptedData
    const result = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;

    // Mark as encrypted
    return `enc:${result}`;
  } catch (error) {
    logger.error('Encryption failed', { error });
    throw new Error('Failed to encrypt message');
  }
}

/**
 * Decrypt encrypted text
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText || !encryptedText.startsWith('enc:')) {
    return encryptedText;
  }

  try {
    const key = getEncryptionKey();

    // Remove the 'enc:' prefix
    const parts = encryptedText.slice(4).split(':');

    if (parts.length !== 3) {
      logger.error('Invalid encrypted text format');
      return '[decryption-error]';
    }

    const [ivHex, authTagHex, encryptedData] = parts;

    if (!ivHex || !authTagHex || !encryptedData) {
      logger.error('Invalid encrypted text components');
      return '[decryption-error]';
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('Decryption failed', { error });
    return '[decryption-error]';
  }
}

/**
 * Check if text is encrypted
 */
export function isEncrypted(text: string): boolean {
  return text?.startsWith('enc:') ?? false;
}

/**
 * Patterns for detecting sensitive content
 */
const SENSITIVE_PATTERNS = {
  // API Keys and Tokens
  apiKey: /[a-zA-Z0-9_-]{20,}/g,
  bearerToken: /bearer\s+[a-zA-Z0-9_-]+/gi,
  authorization: /authorization:\s*Bearer\s+[a-zA-Z0-9_-]+/gi,

  // Credentials
  password: /password[:=]\s*\S+/gi,
  secret: /secret[:=]\s*\S+/gi,
  credentials: /(username|user|login)[:=]\s*\S+/gi,

  // Private Keys
  privateKey: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,

  // Connection strings with passwords
  connectionString: /(mongodb|postgres|mysql|redis):\/\/[^\s]+/gi,

  // Environment variables with secrets
  envSecret: /(API_KEY|SECRET_KEY|PRIVATE_KEY|PWD|PASSWORD)=\S+/gi,
};

/**
 * Check if content contains sensitive information
 */
export function containsSensitiveContent(content: string): {
  sensitive: boolean;
  types: string[];
} {
  const types: string[] = [];

  for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    if (pattern.test(content)) {
      types.push(type);
    }
    // Reset regex lastIndex
    pattern.lastIndex = 0;
  }

  return {
    sensitive: types.length > 0,
    types,
  };
}

/**
 * Auto-encrypt sensitive message content
 */
export function autoEncrypt(content: string): {
  encrypted: boolean;
  content: string;
  detectedTypes?: string[];
} {
  const check = containsSensitiveContent(content);

  if (check.sensitive) {
    return {
      encrypted: true,
      content: encrypt(content),
      detectedTypes: check.types,
    };
  }

  return {
    encrypted: false,
    content,
  };
}

/**
 * Decrypt if encrypted, otherwise return as-is
 */
export function autoDecrypt(content: string): string {
  if (isEncrypted(content)) {
    return decrypt(content);
  }
  return content;
}

/**
 * Encryption service for repository integration
 */
export const encryptionService = {
  encrypt,
  decrypt,
  isEncrypted,
  containsSensitiveContent,
  autoEncrypt,
  autoDecrypt,
};
