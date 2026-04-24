import { z } from 'zod';
import { usageRangeSchema } from '../usage/schemas.js';

export const dashboardOverviewQuerySchema = z.object({
  usage_range: usageRangeSchema.default('30d'),
  include_recent_notifications: z.coerce.boolean().default(true),
  notifications_limit: z.coerce.number().int().min(1).max(20).default(5),
});

export type DashboardOverviewQuerySchema = z.infer<typeof dashboardOverviewQuerySchema>;
