import { z } from 'zod';

export const usageRangeSchema = z.enum(['30d', '90d', 'month_to_date']);
export const usageExportFormatSchema = z.enum(['json', 'csv']);

export const usageOverviewQuerySchema = z.object({
  range: usageRangeSchema.default('30d'),
});

export const usageExportQuerySchema = z.object({
  range: usageRangeSchema.default('30d'),
  format: usageExportFormatSchema.default('json'),
});

export type UsageOverviewQuerySchema = z.infer<typeof usageOverviewQuerySchema>;
export type UsageExportQuerySchema = z.infer<typeof usageExportQuerySchema>;
