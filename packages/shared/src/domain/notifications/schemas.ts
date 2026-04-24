import { z } from 'zod';

export const notificationKindSchema = z.enum([
  'system',
  'billing',
  'usage',
  'security',
  'project',
]);

export const notificationSeveritySchema = z.enum([
  'info',
  'success',
  'warning',
  'error',
]);

export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().trim().min(1).max(500).optional(),
  include_read: z.coerce.boolean().default(true),
  include_archived: z.coerce.boolean().default(false),
  kinds: z.preprocess(
    (value) => {
      if (typeof value !== 'string') return [];
      return value.split(',').map((part) => part.trim()).filter(Boolean);
    },
    z.array(notificationKindSchema).max(10),
  ),
  severities: z.preprocess(
    (value) => {
      if (typeof value !== 'string') return [];
      return value.split(',').map((part) => part.trim()).filter(Boolean);
    },
    z.array(notificationSeveritySchema).max(10),
  ),
});

export const createNotificationSchema = z.object({
  kind: notificationKindSchema,
  severity: notificationSeveritySchema.default('info'),
  title: z.string().trim().min(1).max(160),
  message: z.string().trim().min(1).max(2000),
  action_url: z.string().url().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
  dedupe_key: z.string().trim().min(3).max(120).optional(),
  expires_at: z.string().datetime().optional(),
});

export const notificationIdParamSchema = z.object({
  notificationId: z.string().trim().min(1),
});

export type ListNotificationsQuerySchema = z.infer<typeof listNotificationsQuerySchema>;
export type CreateNotificationSchema = z.infer<typeof createNotificationSchema>;
export type NotificationIdParamSchema = z.infer<typeof notificationIdParamSchema>;
