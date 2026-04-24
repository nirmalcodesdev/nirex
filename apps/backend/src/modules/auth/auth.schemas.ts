import { z } from 'zod';
import { signInSchema } from '../../middleware/validate.js';

export const signInWithTwoFactorSchema = signInSchema.extend({
  twoFactorCode: z
    .string()
    .trim()
    .min(6)
    .max(32)
    .optional(),
});

export const twoFactorVerifySchema = z.object({
  code: z.string().trim().min(6).max(32),
});
