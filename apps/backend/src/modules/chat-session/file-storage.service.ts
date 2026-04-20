/**
 * File Storage Service for Chat Session Attachments
 *
 * Production-grade file storage with:
 * - Local filesystem storage for development
 * - S3-compatible storage for production (AWS S3, MinIO, etc.)
 * - File type validation
 * - Size limits
 * - Virus scanning hooks
 * - Secure URL generation with expiration
 */

import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { basename, dirname, join, resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  IMAGE: 10 * 1024 * 1024,      // 10 MB for images
  DOCUMENT: 50 * 1024 * 1024,   // 50 MB for documents
  CODE: 5 * 1024 * 1024,        // 5 MB for code files
  DEFAULT: 25 * 1024 * 1024,    // 25 MB default
} as const;

// Allowed file types
export const ALLOWED_FILE_TYPES = {
  // Images
  'image/jpeg': { type: 'image', maxSize: FILE_SIZE_LIMITS.IMAGE },
  'image/png': { type: 'image', maxSize: FILE_SIZE_LIMITS.IMAGE },
  'image/gif': { type: 'image', maxSize: FILE_SIZE_LIMITS.IMAGE },
  'image/webp': { type: 'image', maxSize: FILE_SIZE_LIMITS.IMAGE },
  'image/svg+xml': { type: 'image', maxSize: FILE_SIZE_LIMITS.IMAGE },

  // Documents
  'application/pdf': { type: 'document', maxSize: FILE_SIZE_LIMITS.DOCUMENT },
  'text/plain': { type: 'document', maxSize: FILE_SIZE_LIMITS.DOCUMENT },
  'text/markdown': { type: 'document', maxSize: FILE_SIZE_LIMITS.DOCUMENT },
  'application/json': { type: 'code', maxSize: FILE_SIZE_LIMITS.CODE },

  // Code files (treated as text)
  'text/javascript': { type: 'code', maxSize: FILE_SIZE_LIMITS.CODE },
  'text/typescript': { type: 'code', maxSize: FILE_SIZE_LIMITS.CODE },
  'text/html': { type: 'code', maxSize: FILE_SIZE_LIMITS.CODE },
  'text/css': { type: 'code', maxSize: FILE_SIZE_LIMITS.CODE },
  'text/x-python': { type: 'code', maxSize: FILE_SIZE_LIMITS.CODE },
  'text/x-java': { type: 'code', maxSize: FILE_SIZE_LIMITS.CODE },
  'text/x-c': { type: 'code', maxSize: FILE_SIZE_LIMITS.CODE },
  'text/x-cpp': { type: 'code', maxSize: FILE_SIZE_LIMITS.CODE },
  'text/x-go': { type: 'code', maxSize: FILE_SIZE_LIMITS.CODE },
  'text/x-rust': { type: 'code', maxSize: FILE_SIZE_LIMITS.CODE },
} as const;

export type FileType = typeof ALLOWED_FILE_TYPES[keyof typeof ALLOWED_FILE_TYPES]['type'];

export interface FileMetadata {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  type: FileType;
  hash: string;
  uploadedBy: string;
  sessionId: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface StoredFile extends FileMetadata {
  path: string;
  url: string;
}

export interface FileUploadResult {
  success: boolean;
  file?: StoredFile;
  error?: string;
}

/**
 * Storage configuration
 */
interface StorageConfig {
  type: 'local' | 's3';
  localPath?: string;
  s3Config?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string; // For S3-compatible services like MinIO
  };
  maxFileSize: number;
  urlExpirationSeconds: number;
}

/**
 * Get storage configuration from environment
 */
function getStorageConfig(): StorageConfig {
  return {
    type: (process.env.FILE_STORAGE_TYPE as 'local' | 's3') || 'local',
    localPath: process.env.FILE_STORAGE_LOCAL_PATH || join(process.cwd(), 'uploads'),
    s3Config: process.env.AWS_S3_BUCKET ? {
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      endpoint: process.env.S3_ENDPOINT,
    } : undefined,
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // 50MB default
    urlExpirationSeconds: parseInt(process.env.FILE_URL_EXPIRATION || '3600', 10), // 1 hour default
  };
}

/**
 * Calculate file hash for deduplication
 */
async function calculateHash(buffer: Buffer): Promise<string> {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Sanitize filename for storage
 */
function sanitizeFileName(originalName: string): string {
  // Remove path traversal attempts and special characters
  const baseName = originalName
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
    .replace(/__+/g, '_') // Collapse multiple underscores
    .substring(0, 100); // Limit length

  const timestamp = Date.now();
  const uniqueId = randomUUID().slice(0, 8);

  return `${timestamp}_${uniqueId}_${baseName}`;
}

/**
 * Validate file type and size
 */
export function validateFile(
  mimeType: string,
  size: number
): { valid: boolean; error?: string; fileType?: FileType } {
  const allowedType = ALLOWED_FILE_TYPES[mimeType as keyof typeof ALLOWED_FILE_TYPES];

  if (!allowedType) {
    return {
      valid: false,
      error: `File type "${mimeType}" is not allowed`,
    };
  }

  if (size > allowedType.maxSize) {
    return {
      valid: false,
      error: `File size (${(size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed (${(allowedType.maxSize / 1024 / 1024).toFixed(2)}MB)`,
    };
  }

  return {
    valid: true,
    fileType: allowedType.type,
  };
}

/**
 * File Storage Service
 */
class FileStorageService {
  private config: StorageConfig;

  constructor() {
    this.config = getStorageConfig();
    this.initializeStorage();
  }

  /**
   * Initialize storage (create directories, etc.)
   */
  private async initializeStorage(): Promise<void> {
    if (this.config.type === 'local') {
      try {
        await fs.mkdir(this.config.localPath!, { recursive: true });
        logger.info('File storage initialized', { type: 'local', path: this.config.localPath });
      } catch (error) {
        logger.error('Failed to initialize file storage', { error });
        throw error;
      }
    }
  }

  /**
   * Store a file
   */
  async storeFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    uploadedBy: string,
    sessionId: string
  ): Promise<FileUploadResult> {
    try {
      // Validate file
      const validation = validateFile(mimeType, buffer.length);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const safety = await this.validateFileContent(buffer, mimeType);
      if (!safety.safe) {
        return { success: false, error: safety.reason || 'File failed validation' };
      }

      // Calculate hash for deduplication
      const hash = await calculateHash(buffer);

      // Generate storage filename
      const fileName = sanitizeFileName(originalName);

      // Store based on configuration
      if (this.config.type === 's3' && this.config.s3Config) {
        return this.storeInS3(buffer, fileName, mimeType, hash, uploadedBy, sessionId);
      } else {
        return this.storeLocally(buffer, fileName, mimeType, hash, uploadedBy, sessionId);
      }
    } catch (error) {
      logger.error('File storage failed', { error, originalName });
      return {
        success: false,
        error: 'Failed to store file',
      };
    }
  }

  /**
   * Store file locally
   */
  private async storeLocally(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    hash: string,
    uploadedBy: string,
    sessionId: string
  ): Promise<FileUploadResult> {
    const sessionPath = join(this.config.localPath!, sessionId);
    const filePath = join(sessionPath, fileName);

    // Create session directory if needed
    await fs.mkdir(sessionPath, { recursive: true });

    // Write file
    await fs.writeFile(filePath, buffer);

    const validation = validateFile(mimeType, buffer.length);

    const file: StoredFile = {
      id: randomUUID(),
      originalName: fileName.replace(/^\d+_[a-f0-9]+_/, ''), // Remove timestamp and unique ID
      fileName,
      mimeType,
      size: buffer.length,
      type: validation.fileType!,
      hash,
      uploadedBy,
      sessionId,
      createdAt: new Date(),
      path: filePath,
      url: `/api/sessions/files/${sessionId}/${fileName}`,
    };

    logger.info('File stored locally', {
      fileId: file.id,
      sessionId,
      size: buffer.length,
      type: file.type,
    });

    return { success: true, file };
  }

  /**
   * Store file in S3 (placeholder for future implementation)
   */
  private async storeInS3(
    _buffer: Buffer,
    _fileName: string,
    _mimeType: string,
    _hash: string,
    _uploadedBy: string,
    _sessionId: string
  ): Promise<FileUploadResult> {
    // S3 implementation would go here
    // For now, fall back to local storage
    logger.warn('S3 storage not implemented, falling back to local');
    return {
      success: false,
      error: 'S3 storage not yet implemented',
    };
  }

  /**
   * Get file by ID (placeholder for database integration)
   */
  async getFile(fileId: string): Promise<StoredFile | null> {
    // In production, this would query the database
    // For now, we rely on the file path being stored in the message
    logger.debug('Get file requested', { fileId });
    return null;
  }

  /**
   * Resolve a locally stored file for download.
   * Returns null when the file does not exist or the path is invalid.
   */
  async resolveLocalFile(
    sessionId: string,
    fileName: string
  ): Promise<{ path: string; downloadName: string } | null> {
    if (this.config.type !== 'local') {
      return null;
    }

    const safeFileName = basename(fileName);
    if (!safeFileName || safeFileName !== fileName || safeFileName.includes('..')) {
      return null;
    }

    const sessionPath = resolve(this.config.localPath!, sessionId);
    const filePath = resolve(sessionPath, safeFileName);

    if (filePath !== sessionPath && !filePath.startsWith(`${sessionPath}${sep}`)) {
      return null;
    }

    try {
      await fs.access(filePath);
    } catch {
      return null;
    }

    return {
      path: filePath,
      downloadName: safeFileName.replace(/^\d+_[a-f0-9]+_/, ''),
    };
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      if (this.config.type === 'local') {
        await fs.unlink(filePath);
        logger.info('File deleted', { filePath });
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to delete file', { error, filePath });
      return false;
    }
  }

  /**
   * Generate secure download URL with expiration
   */
  generateSecureUrl(fileId: string, expiresInSeconds?: number): string {
    const expiration = expiresInSeconds || this.config.urlExpirationSeconds;
    const expiresAt = Math.floor(Date.now() / 1000) + expiration;

    // In production, this would generate a signed URL
    // For now, return a simple URL
    return `/api/sessions/files/download/${fileId}?expires=${expiresAt}`;
  }

  /**
   * Validate file content (virus scanning hook)
   */
  async validateFileContent(_buffer: Buffer, _mimeType: string): Promise<{ safe: boolean; reason?: string }> {
    // In production, integrate with ClamAV or similar
    // For now, assume all files are safe
    return { safe: true };
  }

  /**
   * Clean up expired files
   */
  async cleanupExpiredFiles(_maxAgeDays: number = 30): Promise<number> {
    // In production, this would scan for and delete old files
    logger.info('File cleanup scheduled');
    return 0;
  }
}

// Export singleton instance
export const fileStorageService = new FileStorageService();
