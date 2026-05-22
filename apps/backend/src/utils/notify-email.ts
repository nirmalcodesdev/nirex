import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Fire a transactional email without throwing. Email failures must never break
 * the underlying user action (e.g. signup, key creation). Errors are logged
 * with structured context so they show up in observability.
 *
 * Env-gated so operators can disable a whole class of emails without code
 * changes — useful during incidents (e.g. mail provider outage) or for
 * compliance regions where transactional email needs explicit opt-in.
 */
export async function sendNotificationEmailSafely(input: {
  category: 'security' | 'billing' | 'usage';
  notificationType: string;
  send: () => Promise<void>;
  context?: Record<string, unknown>;
}): Promise<void> {
  const enabled =
    input.category === 'security'
      ? env.SECURITY_EMAIL_NOTIFICATIONS_ENABLED
      : input.category === 'usage'
        ? env.USAGE_EMAIL_NOTIFICATIONS_ENABLED
        : env.BILLING_EMAIL_NOTIFICATIONS_ENABLED;

  if (!enabled) {
    return;
  }

  try {
    await input.send();
  } catch (error) {
    logger.error(`${input.category} email notification failed`, {
      service: input.category,
      operation: `${input.category}.email_notification`,
      notificationType: input.notificationType,
      ...(input.context ?? {}),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
