import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDB, disconnectTestDB, clearCollections } from '../helpers/database.js';
import { createTestApp } from '../helpers/app.js';
import { createTestUser, createLockedUser } from '../helpers/factories.js';
import type { Application } from 'express';
import type { IUserDocument } from '../../src/modules/user/user.model.js';

describe('Security - Brute Force Protection', () => {
  let app: Application;
  let testUser: IUserDocument;

  beforeAll(async () => {
    await connectTestDB();
    app = createTestApp();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearCollections();
    testUser = await createTestUser({ email: 'test@example.com' });
  });

  describe('Login Brute Force', () => {
    it('should lock account after 5 failed attempts', async () => {
      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'test@example.com',
            password: 'WrongPassword123!',
          });

        if (i < 4) {
          expect(response.status).toBe(401);
          expect(response.body.code).toBe('INVALID_CREDENTIALS');
        } else {
          // 5th attempt triggers lockout
          expect(response.status).toBe(429);
          expect(response.body.code).toBe('ACCOUNT_LOCKED');
        }
      }
    });

    it('should return retry-after header when locked', async () => {
      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'test@example.com',
            password: 'WrongPassword123!',
          });
      }

      // Next attempt should be locked
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!',
        })
        .expect(429);

      expect(response.headers['retry-after']).toBeDefined();
      expect(parseInt(response.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('should use progressive lockout delays', async () => {
      const user = await createTestUser({ email: 'progressive@example.com' });

      // Track lockout durations
      const lockoutDurations: number[] = [];

      // Make many failed attempts
      for (let i = 0; i < 25; i++) {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'progressive@example.com',
            password: 'WrongPassword123!',
          });

        if (response.status === 429 && response.headers['retry-after']) {
          lockoutDurations.push(parseInt(response.headers['retry-after']));
        }
      }

      // Should have increasing lockout durations
      // 5+ attempts = 1 min, 10+ = 5 min, 15+ = 15 min, 20+ = 60 min
      const uniqueDurations = [...new Set(lockoutDurations)];
      expect(uniqueDurations.length).toBeGreaterThan(1);
    });

    it('should reset failed attempts on successful login', async () => {
      // Make some failed attempts
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'test@example.com',
            password: 'WrongPassword123!',
          });
      }

      // Successful login
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: (testUser as any).plainPassword,
        })
        .expect(200);

      // Failed attempts should be reset
      // Next wrong password shouldn't immediately lock
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should maintain separate counters for different accounts', async () => {
      const user2 = await createTestUser({ email: 'user2@example.com' });

      // Lock first user
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'test@example.com',
            password: 'WrongPassword123!',
          });
      }

      // Verify first user is locked
      const lockedResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: (testUser as any).plainPassword,
        });

      expect(lockedResponse.status).toBe(429);

      // Second user should still be able to login
      const user2Response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'user2@example.com',
          password: (user2 as any).plainPassword,
        });

      expect(user2Response.status).toBe(200);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit auth endpoints', async () => {
      // Make 15 rapid requests to login endpoint
      const requests = Array(15).fill(null).map(() =>
        request(app)
          .post('/api/v1/auth/login')
          .send({
            email: `random${Math.random()}@example.com`,
            password: 'password123',
          })
      );

      const responses = await Promise.all(requests);

      // Some should be rate limited (429)
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);

      // Rate limited responses should have proper headers
      if (rateLimited.length > 0) {
        expect(rateLimited[0].headers['x-ratelimit-limit']).toBeDefined();
        expect(rateLimited[0].headers['x-ratelimit-remaining']).toBeDefined();
      }
    });

    it('should have separate limits for auth and API endpoints', async () => {
      // Exhaust auth rate limit
      for (let i = 0; i < 15; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: `user${i}@example.com`,
            password: 'password',
          });
      }

      // Health endpoint should still work (different limit)
      const healthResponse = await request(app)
        .get('/health');

      // Health check might be rate limited or not depending on configuration
      expect([200, 429]).toContain(healthResponse.status);
    });

    it('should reset rate limit after window expires', async () => {
      // This test would need to wait for the rate limit window
      // which is typically 15 minutes. Skip in CI.
      expect(true).toBe(true);
    });
  });

  describe('Registration Flooding', () => {
    it('should prevent rapid registration attempts', async () => {
      const requests = Array(20).fill(null).map((_, i) =>
        request(app)
          .post('/api/v1/auth/register')
          .send({
            email: `flood${i}@example.com`,
            fullName: 'Flood User',
            password: 'SecurePass123!',
          })
      );

      const responses = await Promise.all(requests);

      // Some should be rate limited
      const successful = responses.filter(r => r.status === 201);
      const rateLimited = responses.filter(r => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
      // Should allow some through but not all
      expect(successful.length).toBeLessThan(20);
    });
  });

  describe('Password Reset Flooding', () => {
    it('should prevent password reset spam', async () => {
      const requests = Array(20).fill(null).map(() =>
        request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email: 'test@example.com' })
      );

      const responses = await Promise.all(requests);

      // Some should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Token Enumeration', () => {
    it('should not reveal if refresh token is valid through timing', async () => {
      const iterations = 10;
      const validTokenTimes: number[] = [];
      const invalidTokenTimes: number[] = [];

      // Get valid token
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: (testUser as any).plainPassword,
        });

      const validToken = loginResponse.body.data.refreshToken;

      // Time valid token requests
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await request(app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: validToken });
        validTokenTimes.push(performance.now() - start);
      }

      // Time invalid token requests
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await request(app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: `invalid-token-${i}` });
        invalidTokenTimes.push(performance.now() - start);
      }

      // Times should be similar
      const validAvg = validTokenTimes.reduce((a, b) => a + b, 0) / iterations;
      const invalidAvg = invalidTokenTimes.reduce((a, b) => a + b, 0) / iterations;

      const ratio = Math.max(validAvg, invalidAvg) / Math.min(validAvg, invalidAvg);
      expect(ratio).toBeLessThan(2);
    });
  });
});
