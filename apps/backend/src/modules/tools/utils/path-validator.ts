/**
 * Path Validator
 *
 * Validates file paths to prevent directory traversal attacks and
 * enforce workspace boundaries.
 */

import path from 'path';
import { AppError } from '../../../types/index.js';

export interface PathValidationOptions {
  workingDirectory: string;
  allowedPaths?: string[];
  deniedPaths?: string[];
  allowAbsolute?: boolean;
}

/**
 * Validate and resolve a file path within workspace boundaries.
 * Throws AppError if path is invalid or outside allowed boundaries.
 */
export function validatePath(
  filePath: string,
  options: PathValidationOptions,
): string {
  const { workingDirectory, allowedPaths, deniedPaths, allowAbsolute = false } = options;

  // Normalize the path
  const normalizedPath = path.normalize(filePath);

  // Check for null bytes (security)
  if (normalizedPath.includes('\0')) {
    throw new AppError('Path contains null bytes', 400, 'INVALID_PATH');
  }

  // Resolve to absolute path
  const absolutePath = path.isAbsolute(normalizedPath)
    ? normalizedPath
    : path.resolve(workingDirectory, normalizedPath);

  // Check if absolute paths are allowed
  if (path.isAbsolute(filePath) && !allowAbsolute) {
    throw new AppError(
      'Absolute paths are not allowed. Use relative paths from working directory.',
      403,
      'ABSOLUTE_PATH_DENIED',
    );
  }

  // Ensure path is within working directory (prevent traversal)
  if (!absolutePath.startsWith(workingDirectory)) {
    throw new AppError(
      `Path "${filePath}" is outside working directory`,
      403,
      'PATH_TRAVERSAL_DENIED',
    );
  }

  // Check denied paths
  if (deniedPaths) {
    for (const deniedPath of deniedPaths) {
      const deniedAbsolute = path.resolve(workingDirectory, deniedPath);
      if (absolutePath.startsWith(deniedAbsolute)) {
        throw new AppError(
          `Access to path "${filePath}" is denied`,
          403,
          'PATH_DENIED',
        );
      }
    }
  }

  // Check allowed paths (if specified, path must be within one of them)
  if (allowedPaths && allowedPaths.length > 0) {
    const isAllowed = allowedPaths.some((allowedPath) => {
      const allowedAbsolute = path.resolve(workingDirectory, allowedPath);
      return absolutePath.startsWith(allowedAbsolute);
    });

    if (!isAllowed) {
      throw new AppError(
        `Path "${filePath}" is not in allowed paths`,
        403,
        'PATH_NOT_ALLOWED',
      );
    }
  }

  return absolutePath;
}

/**
 * Check if a path matches protected patterns (.git, .env, keys, etc.)
 */
export function isProtectedPath(filePath: string): boolean {
  const normalized = path.normalize(filePath).toLowerCase();
  const segments = normalized.split(path.sep);

  const protectedPatterns = [
    '.git',
    '.env',
    '.npmrc',
    'node_modules',
    '.ssh',
    'id_rsa',
    'id_ed25519',
    '.pem',
    '.key',
    '.p12',
    '.pfx',
    'credentials',
    'secrets',
  ];

  return protectedPatterns.some((pattern) => {
    if (pattern.startsWith('.')) {
      return segments.includes(pattern) || normalized.endsWith(pattern);
    }
    return segments.includes(pattern) || normalized.includes(pattern);
  });
}

/**
 * Validate multiple paths at once
 */
export function validatePaths(
  filePaths: string[],
  options: PathValidationOptions,
): string[] {
  return filePaths.map((p) => validatePath(p, options));
}
