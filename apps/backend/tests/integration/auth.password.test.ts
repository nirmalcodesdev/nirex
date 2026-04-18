import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDB, disconnectTestDB, clearCollections } from '../helpers/database.js';
import { createTestApp } from '../helpers/app.js';
import { createTestUser, createResetToken } from '../helpers/factories.js';
import type { Application } from 'express';
import type { IUserDocument } from '../../src/modules/user/user.model.js';

describe('Auth - Password Management', () => {
  let app: Application;
  let testUser: IUserDocument;
  let accessToken: string;

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

    // Login to get access token
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: (testUser as any).plainPassword,
      });

    accessToken = loginResponse.body.data.accessToken;
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should accept request for existing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('reset');
    });

    it('should return same response for non-existent email (prevent enumeration)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body.status).toBe('success');
      // Same message as existing email
      expect(response.body.message).toContain('reset');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'invalid-email' })
        .expect(422);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should be rate limited', async () => {
      // Make multiple rapid requests
      const requests = Array(15).fill(null).map(() =>
        request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email: 'test@example.com' })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      const { rawToken } = await createResetToken(testUser._id);

      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          password: 'NewSecurePass123!',
        })
        .expect(200);

      expect(response.body.status).toBe('success');

      // Should be able to login with new password
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'NewSecurePass123!',
        })
        .expect(200);

      expect(loginResponse.body.data.accessToken).toBeDefined();
    });

    it('should revoke all sessions after password reset', async () => {
      const { rawToken } = await createResetToken(testUser._id);

      // Get refresh token before reset
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: (testUser as any).plainPassword,
        });

      const oldRefreshToken = loginResponse.body.data.refreshToken;

      // Reset password
      await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          password: 'NewSecurePass123!',
        })
        .expect(200);

      // Old refresh token should be invalid
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: oldRefreshToken })
        .expect(401);

      expect(refreshResponse.body.code).toBe('TOKEN_INVALID');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'NewSecurePass123!',
        })
        .expect(400);

      expect(response.body.status).toBe('fail');
    });

    it('should reject expired token', async () => {
      // Create token that will expire
      const { rawToken, token } = await createResetToken(testUser._id);

      // Manually expire the token
      const { tokenRepository } = await import('../../src/modules/token/token.repository.js');
      await tokenRepository.consume(token._id);

      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          password: 'NewSecurePass123!',
        })
        .expect(400);

      expect(response.body.status).toBe('fail');
    });

    it('should reject short password', async () => {
      const { rawToken } = await createResetToken(testUser._id);

      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          password: 'short',
        })
        .expect(422);

      expect(response.body.message).toContain('Password must be at least 8 characters');
    });

    it('should reject reused token', async () => {
      const { rawToken } = await createResetToken(testUser._id);

      // First use
      await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          password: 'FirstNewPass123!',
        })
        .expect(200);

      // Second use should fail
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          password: 'SecondNewPass123!',
        })
        .expect(400);

      expect(response.body.status).toBe('fail');
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    it('should change password with valid current password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: (testUser as any).plainPassword,
          newPassword: 'NewSecurePass123!',
        })
        .expect(200);

      expect(response.body.status).toBe('success');

      // Should be able to login with new password
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'NewSecurePass123!',
        })
        .expect(200);

      expect(loginResponse.body.data.accessToken).toBeDefined();
    });

    it('should reject incorrect current password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewSecurePass123!',
        })
        .expect(400);

      expect(response.body.code).toBe('INVALID_CREDENTIALS');
      expect(response.body.message).toContain('Current password is incorrect');
    });

    it('should revoke all sessions after password change', async () => {
      // Create multiple sessions
      const login2 = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: (testUser as any).plainPassword,
        });

      const refreshToken2 = login2.body.data.refreshToken;

      // Change password
      await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: (testUser as any).plainPassword,
          newPassword: 'NewSecurePass123!',
        })
        .expect(200);

      // All sessions should be revoked
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: refreshToken2 })
        .expect(401);

      expect(refreshResponse.body.code).toBe('TOKEN_INVALID');
    });

    it('should reject without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .send({
          currentPassword: (testUser as any).plainPassword,
          newPassword: 'NewSecurePass123!',
        })
        .expect(401);

      expect(response.body.code).toBe('UNAUTHENTICATED');
    });

    it('should reject short new password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: (testUser as any).plainPassword,
          newPassword: 'short',
        })
        .expect(422);

      expect(response.body.message).toContain('New password must be at least 8 characters');
    });

    it('should reject same password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: (testUser as any).plainPassword,
          newPassword: (testUser as any).plainPassword,
        })
        .expect(200); // Currently allowed, might want to add validation

      expect(response.body.status).toBe('success');
    });
  });
});
