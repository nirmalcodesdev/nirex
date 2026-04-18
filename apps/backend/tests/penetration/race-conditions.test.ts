import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDB, disconnectTestDB, clearCollections } from '../helpers/database.js';
import { createTestApp } from '../helpers/app.js';
import { createTestUser, createSession } from '../helpers/factories.js';
import type { Application } from 'express';
import type { IUserDocument } from '../../src/modules/user/user.model.js';

describe('Security - Race Conditions', () => {
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

  describe('Concurrent Token Refresh', () => {
    it('should handle concurrent refresh requests safely', async () => {
      // Login to get initial tokens
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: (testUser as any).plainPassword,
        });

      const refreshToken = loginResponse.body.data.refreshToken;

      // Send 5 concurrent refresh requests with same token
      const refreshPromises = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken })
      );

      const responses = await Promise.all(refreshPromises);

      // Count successful responses
      const successful = responses.filter(r => r.status === 200);
      const reuseDetected = responses.filter(r => r.body.code === 'TOKEN_REUSE_DETECTED');
      const invalid = responses.filter(r => r.body.code === 'TOKEN_INVALID');

      // Only one should succeed, others should fail
      expect(successful.length + reuseDetected.length + invalid.length).toBe(5);

      // At most one success (might be 0 due to race)
      expect(successful.length).toBeLessThanOrEqual(1);

      // If reuse detected, all user sessions should be revoked
      if (reuseDetected.length > 0) {
        // Try to use the new token from successful refresh
        if (successful.length > 0) {
          const newToken = successful[0].body.data.refreshToken;
          const retryResponse = await request(app)
            .post('/api/v1/auth/refresh')
            .send({ refreshToken: newToken });

          // Should fail due to nuclear revocation
          expect(retryResponse.status).toBe(401);
        }
      }
    });

    it('should prevent double-spending of refresh tokens', async () => {
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: (testUser as any).plainPassword,
        });

      const refreshToken = loginResponse.body.data.refreshToken;

      // First refresh
      const firstRefresh = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      const newToken = firstRefresh.body.data.refreshToken;

      // Immediately try to use old token again
      const secondAttempt = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(secondAttempt.body.code).toBe('TOKEN_REUSE_DETECTED');

      // New token should also be invalid due to nuclear revocation
      const thirdAttempt = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: newToken })
        .expect(401);

      expect(thirdAttempt.body.code).toBe('TOKEN_INVALID');
    });
  });

  describe('Concurrent Registration', () => {
    it('should prevent duplicate user creation on concurrent registration', async () => {
      const registerData = {
        email: 'concurrent@example.com',
        fullName: 'Concurrent User',
        password: 'SecurePass123!',
      };

      // Send 5 concurrent registration requests
      const registerPromises = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/v1/auth/register')
          .send(registerData)
      );

      const responses = await Promise.all(registerPromises);

      const successful = responses.filter(r => r.status === 201);
      const failed = responses.filter(r => r.status !== 201);

      // Only one should succeed
      expect(successful.length).toBe(1);
      expect(failed.length).toBe(4);
    });
  });

  describe('Concurrent Session Operations', () => {
    it('should handle concurrent logout and refresh', async () => {
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: (testUser as any).plainPassword,
        });

      const accessToken = loginResponse.body.data.accessToken;
      const refreshToken = loginResponse.body.data.refreshToken;

      // Concurrent logout and refresh
      const [logoutResponse, refreshResponse] = await Promise.all([
        request(app)
          .post('/api/v1/auth/logout')
          .set('Authorization', `Bearer ${accessToken}`),
        request(app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken }),
      ]);

      // One should succeed, the other might fail depending on order
      expect([logoutResponse.status, refreshResponse.status]).toContain(200);

      // After both operations, the refresh token should be invalid
      const finalCheck = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(finalCheck.status).toBe(401);
    });
  });

  describe('Concurrent Password Changes', () => {
    it('should handle concurrent password changes', async () => {
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: (testUser as any).plainPassword,
        });

      const accessToken = loginResponse.body.data.accessToken;

      // Concurrent password change attempts
      const changePromises = Array(3).fill(null).map((_, i) =>
        request(app)
          .post('/api/v1/auth/change-password')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            currentPassword: (testUser as any).plainPassword,
            newPassword: `NewPass${i}23!`,
          })
      );

      const responses = await Promise.all(changePromises);

      // At least one should succeed
      const successful = responses.filter(r => r.status === 200);
      expect(successful.length).toBeGreaterThanOrEqual(1);

      // Try to login with any of the new passwords
      for (let i = 0; i < 3; i++) {
        const loginAttempt = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'test@example.com',
            password: `NewPass${i}23!`,
          });

        if (loginAttempt.status === 200) {
          // Found the winning password
          expect(loginAttempt.body.data.accessToken).toBeDefined();
          break;
        }
      }
    });
  });
});
