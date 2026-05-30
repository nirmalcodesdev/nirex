import { z } from 'zod';

export const usageRangeSchema = z.enum(['30d', '90d', 'month_to_date']);
export const usageExportFormatSchema = z.enum(['json', 'csv']);

export const DEFAULT_CREDITS_LIMIT = 10000;


export const usageOverviewQuerySchema = z.object({
  range: usageRangeSchema.default('30d'),
});

export const usageExportQuerySchema = z.object({
  range: usageRangeSchema.default('30d'),
  format: usageExportFormatSchema.default('json'),
});

export const requestLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  range: usageRangeSchema.default('30d'),
});

export type UsageOverviewQuerySchema = z.infer<typeof usageOverviewQuerySchema>;
export type UsageExportQuerySchema = z.infer<typeof usageExportQuerySchema>;
export type RequestLogsQuerySchema = z.infer<typeof requestLogsQuerySchema>;
