import { logger } from '../../utils/logger.js';

type MetricLabels = Record<string, string | number | boolean | null>;

export const billingMetrics = {
  increment(name: string, value: number = 1, labels: MetricLabels = {}): void {
    logger.info('Billing metric increment', {
      service: 'billing',
      metric: name,
      value,
      labels,
    });
  },

  gauge(name: string, value: number, labels: MetricLabels = {}): void {
    logger.info('Billing metric gauge', {
      service: 'billing',
      metric: name,
      value,
      labels,
    });
  },

  histogram(name: string, value: number, labels: MetricLabels = {}): void {
    logger.info('Billing metric histogram', {
      service: 'billing',
      metric: name,
      value,
      labels,
    });
  },
};
