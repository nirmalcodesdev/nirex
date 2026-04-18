import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDB, disconnectTestDB, clearCollections } from '../helpers/database.js';
import { createTestApp } from '../helpers/app.js';
import { createTestUser } from '../helpers/factories.js';
import type { Application } from 'express';
import type { IUserDocument } from '../../src/modules/user/user.model.js';

describe('Security - Timing Attack Prevention', () => {
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

  describe('Login Timing Consistency', () => {
    it('should have similar timing for existing and non-existing emails', async () => {
      const iterations = 10;
      const existingEmailTimes: number[] = [];
      const nonExistingEmailTimes: number[] = [];

      // Time requests for existing email
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'test@example.com',
            password: 'WrongPassword123!',
          });
        existingEmailTimes.push(performance.now() - start);
      }

      // Time requests for non-existing email
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: `nonexistent${i}@example.com`,
            password: 'WrongPassword123!',
          });
        nonExistingEmailTimes.push(performance.now() - start);
      }

      // Calculate averages
      const existingAvg = existingEmailTimes.reduce((a, b) => a + b, 0) / iterations;
      const nonExistingAvg = nonExistingEmailTimes.reduce((a, b) => a + b, 0) / iterations;

      // Times should be within 50% of each other (timing-safe comparison)
      const ratio = Math.max(existingAvg, nonExistingAvg) / Math.min(existingAvg, nonExistingAvg);
      expect(ratio).toBeLessThan(1.5);
    });

    it('should have similar timing for correct and incorrect passwords', async () => {
      const iterations = 10;
      const correctPasswordTimes: number[] = [];
      const incorrectPasswordTimes: number[] = [];

      // Time requests with correct password
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'test@example.com',
            password: (testUser as any).plainPassword,
          });
        correctPasswordTimes.push(performance.now() - start);
      }

      // Time requests with incorrect password
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'test@example.com',
            password: 'WrongPassword123!',
          });
        incorrectPasswordTimes.push(performance.now() - start);
      }

      // Calculate averages
      const correctAvg = correctPasswordTimes.reduce((a, b) => a + b, 0) / iterations;
      const incorrectAvg = incorrectPasswordTimes.reduce((a, b) => a + b, 0) / iterations;

      // Times should be within 50% of each other
      const ratio = Math.max(correctAvg, incorrectAvg) / Math.min(correctAvg, incorrectAvg);
      expect(ratio).toBeLessThan(1.5);
    });
  });

  describe('Password Reset Timing', () => {
    it('should have similar timing for existing and non-existing emails in forgot-password', async () => {
      const iterations = 5;
      const existingEmailTimes: number[] = [];
      const nonExistingEmailTimes: number[] = [];

      // Time requests for existing email
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email: 'test@example.com' });
        existingEmailTimes.push(performance.now() - start);
        await new Promise(r => setTimeout(r, 100)); // Small delay between requests
      }

      // Time requests for non-existing email
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email: `nonexistent${i}@example.com` });
        nonExistingEmailTimes.push(performance.now() - start);
        await new Promise(r => setTimeout(r, 100));
      }

      // Calculate averages
      const existingAvg = existingEmailTimes.reduce((a, b) => a + b, 0) / iterations;
      const nonExistingAvg = nonExistingEmailTimes.reduce((a, b) => a + b, 0) / iterations;

      // Times should be similar (within 100ms or 50%)
      const diff = Math.abs(existingAvg - nonExistingAvg);
      expect(diff).toBeLessThan(100);
    });
  });

  describe('Registration Timing', () => {
    it('should have similar timing for new and existing email registration', async () => {
      const iterations = 5;
      const newEmailTimes: number[] = [];
      const existingEmailTimes: number[] = [];

      // First, register a user
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'existing@example.com',
          fullName: 'Existing User',
          password: 'SecurePass123!',
        });

      // Clear collections and start fresh for timing test
      await clearCollections();

      // Time requests for new emails
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: `newuser${i}@example.com`,
            fullName: 'New User',
            password: 'SecurePass123!',
          });
        newEmailTimes.push(performance.now() - start);
      }

      // Time requests for existing email
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: 'newuser0@example.com',
            fullName: 'Existing User',
            password: 'SecurePass123!',
          });
        existingEmailTimes.push(performance.now() - start);
      }

      // Calculate averages
      const newAvg = newEmailTimes.reduce((a, b) => a + b, 0) / iterations;
      const existingAvg = existingEmailTimes.reduce((a, b) => a + b, 0) / iterations;

      // Times should be within 50% of each other
      const ratio = Math.max(newAvg, existingAvg) / Math.min(newAvg, existingAvg);
      expect(ratio).toBeLessThan(1.5);
    });
  });

  describe('Token Verification Timing', () => {
    it('should have similar timing for valid and invalid tokens', async () => {
      const iterations = 10;
      const validTokenTimes: number[] = [];
      const invalidTokenTimes: number[] = [];

      // Login to get valid token
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: (testUser as any).plainPassword,
        });

      const validToken = loginResponse.body.data.accessToken;

      // Time requests with valid token
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await request(app)
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${validToken}`);
        validTokenTimes.push(performance.now() - start);
      }

      // Time requests with invalid token
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await request(app)
          .get('/api/v1/auth/me')
          .set('Authorization', 'Bearer invalid-token-12345');
        invalidTokenTimes.push(performance.now() - start);
      }

      // Calculate averages
      const validAvg = validTokenTimes.reduce((a, b) => a + b, 0) / iterations;
      const invalidAvg = invalidTokenTimes.reduce((a, b) => a + b, 0) / iterations;

      // Times should be similar (within 50%)
      const ratio = Math.max(validAvg, invalidAvg) / Math.min(validAvg, invalidAvg);
      expect(ratio).toBeLessThan(1.5);
    });
  });
});
