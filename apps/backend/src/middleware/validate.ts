import type { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { AppError } from '../types/index.js';

// Re-export all validation schemas from shared package
export {
  signInSchema,
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  refreshSchema,
  updateProfileSchema,
  terminateDevicesSchema,
  emailSchema,
  passwordSchema,
  uuidSchema,
  objectIdSchema,
  tokenSchema,
  verifyEmailSchema,
  oauthCallbackSchema,
  deleteSessionSchema,
  listSessionsSchema,
} from '../types/index.js';

type RequestSegment = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, segment: RequestSegment = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[segment]);
      // Overwrite with the parsed (coerced + stripped) data
      (req as any)[segment] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => {
          const path = e.path.join('.') || 'value';
          return `${path}: ${e.message}`;
        });
        next(new AppError(`Validation failed: ${errors.join('; ')}`, 422, 'VALIDATION_ERROR'));
      } else {
        next(err);
      }
    }
  };
}

// Note: All validation schemas are now imported from the shared package (@nirex/shared)
// to ensure consistent validation across frontend and backend.
//
// Backend-specific schemas (if needed in the future) should be defined here
// and extend/combine shared schemas.
