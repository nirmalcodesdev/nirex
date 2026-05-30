/**
 * Circuit Breaker
 *
 * Implements the circuit breaker pattern: after 3 failures, the provider
 * goes into a 60s cooldown before being retried.
 *
 * Config:
 *   failureThreshold = 3     — consecutive failures before opening
 *   cooldownMs = 60_000      — time to wait before trying half-open
 *   halfOpenMaxRequests = 1  — max requests allowed in half-open state
 */

import { logger } from '../../../utils/logger.js';

export type CircuitState = 'closed' | 'open' | 'half_open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;
  private halfOpenRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;

  readonly name: string;
  readonly failureThreshold: number;
  readonly cooldownMs: number;
  readonly halfOpenMaxRequests: number;

  constructor(
    name: string,
    options: {
      failureThreshold?: number;
      cooldownMs?: number;
      halfOpenMaxRequests?: number;
    } = {},
  ) {
    this.name = name;
    this.failureThreshold = options.failureThreshold ?? 3;
    this.cooldownMs = options.cooldownMs ?? 60_000;
    this.halfOpenMaxRequests = options.halfOpenMaxRequests ?? 1;
  }

  get isOpen(): boolean {
    this.transitionIfNeeded();
    return this.state === 'open';
  }

  get currentState(): CircuitState {
    this.transitionIfNeeded();
    return this.state;
  }

  allowRequest(): boolean {
    this.transitionIfNeeded();

    switch (this.state) {
      case 'closed':
        return true;
      case 'open':
        return false;
      case 'half_open':
        if (this.halfOpenRequests < this.halfOpenMaxRequests) {
          this.halfOpenRequests++;
          return true;
        }
        return false;
    }
  }

  recordSuccess(): void {
    this.totalSuccesses++;

    if (this.state === 'half_open') {
      this.reset();
      logger.info(`[CircuitBreaker:${this.name}] circuit closed after successful half-open request`);
    }

    this.failureCount = 0;
  }

  recordFailure(): void {
    this.failureCount++;
    this.totalFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half_open') {
      this.openCircuit();
      logger.warn(`[CircuitBreaker:${this.name}] circuit re-opened after half-open failure`);
    } else if (this.failureCount >= this.failureThreshold) {
      this.openCircuit();
      logger.warn(`[CircuitBreaker:${this.name}] circuit opened after ${this.failureCount} consecutive failures`);
    }
  }

  private openCircuit(): void {
    this.state = 'open';
    this.nextAttemptTime = Date.now() + this.cooldownMs;
    this.halfOpenRequests = 0;
  }

  private reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.halfOpenRequests = 0;
    this.nextAttemptTime = 0;
  }

  private transitionIfNeeded(): void {
    if (this.state === 'open' && Date.now() >= this.nextAttemptTime) {
      this.state = 'half_open';
      this.halfOpenRequests = 0;
      logger.info(`[CircuitBreaker:${this.name}] circuit entered half-open state`);
    }
  }

  getStats(): { state: CircuitState; failures: number; successes: number; totalFailures: number; totalSuccesses: number } {
    return {
      state: this.currentState,
      failures: this.failureCount,
      successes: this.totalSuccesses,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }
}
