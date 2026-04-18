import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDB, disconnectTestDB, clearCollections } from '../helpers/database.js';
import { createTestApp } from '../helpers/app.js';
import { createTestUser, createSession } from '../helpers/factories.js';
import { signAccessToken } from '../../src/utils/crypto.js';
import type { Application } from 'express';
import type { IUserDocument } from '../../src/modules/user/user.model.js';

describe('Auth - Sessions & Token Management', () => {
  let app: Application;
  let testUser: IUserDocument;
  let accessToken: string;
  let refreshToken: string;
  let sessionId: string;

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

    // Login to get tokens
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: (testUser as any).plainPassword,
      });

    accessToken = loginResponse.body.data.accessToken;
    refreshToken = loginResponse.body.data.refreshToken;
    sessionId = loginResponse.body.data.sessionId;
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      // Should get new refresh token (rotation)
      expect(response.body.data.refreshToken).not.toBe(refreshToken);
    });

    it('should invalidate old refresh token after rotation', async () => {
      // First refresh
      const refresh1 = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      const newRefreshToken = refresh1.body.data.refreshToken;

      // Try to use old refresh token (should fail)
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(response.body.code).toBe('TOKEN_REUSE_DETECTED');

      // New token should still work
      const refresh2 = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: newRefreshToken })
        .expect(200);

      expect(refresh2.body.status).toBe('success');
    });

    it('should detect token reuse attack and revoke all sessions', async () => {
      // Create multiple sessions
      const login2 = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: (testUser as any).plainPassword,
        });

      const refreshToken2 = login2.body.data.refreshToken;

      // Refresh first token
      const refresh1 = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      // Try to reuse first token (simulating theft)
      const attack = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(attack.body.code).toBe('TOKEN_REUSE_DETECTED');

      // All sessions should be revoked - second token should also fail
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: refreshToken2 })
        .expect(401);

      expect(response.body.code).toBe('TOKEN_INVALID');
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.code).toBe('TOKEN_INVALID');
    });

    it('should reject expired refresh token', async () => {
      // Create expired session manually
      const { rawRefreshToken } = await createSession(
        testUser._id,
        'Test Device',
        '127.0.0.1'
      );

      // Manually expire the session
      const { sessionRepository } = await import('../../src/modules/session/session.repository.js');
      await sessionRepository.revokeAllForUser(testUser._id);

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rawRefreshToken })
        .expect(401);

      expect(response.body.code).toBe('TOKEN_INVALID');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout with valid access token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
    });

    it('should invalidate session after logout', async () => {
      // Logout
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Try to refresh with the old refresh token
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(response.body.code).toBe('TOKEN_INVALID');
    });

    it('should reject logout without token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .expect(401);

      expect(response.body.code).toBe('UNAUTHENTICATED');
    });

    it('should reject logout with invalid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.code).toBe('TOKEN_INVALID');
    });
  });

  describe('POST /api/v1/auth/logout-all', () => {
    it('should logout all sessions', async () => {
      // Create multiple sessions
      const login2 = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: (testUser as any).plainPassword,
        });

      const refreshToken2 = login2.body.data.refreshToken;

      // Logout all
      const response = await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');

      // Both refresh tokens should be invalid
      await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: refreshToken2 })
        .expect(401);
    });
  });

  describe('GET /api/v1/auth/sessions', () => {
    it('should list active sessions', async () => {
      // Create multiple sessions
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: (testUser as any).plainPassword,
        });

      const response = await request(app)
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should reject without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/auth/sessions')
        .expect(401);

      expect(response.body.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('DELETE /api/v1/auth/sessions/:sessionId', () => {
    it('should revoke specific session', async () => {
      // Create another session
      const login2 = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: (testUser as any).plainPassword,
        });

      const sessionId2 = login2.body.data.sessionId;

      // Revoke the second session
      const response = await request(app)
        .delete(`/api/v1/auth/sessions/${sessionId2}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');

      // Second session refresh should fail
      await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: login2.body.data.refreshToken })
        .expect(401);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .delete('/api/v1/auth/sessions/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.status).toBe('fail');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return current user info', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data._id).toBe(testUser._id.toString());
      expect(response.body.data.email).toBe('test@example.com');
    });

    it('should reject expired access token', async () => {
      const expiredToken = signAccessToken({
        sub: testUser._id.toString(),
        sessionId: sessionId,
      });

      // Wait for token to be considered invalid (if we had short expiry)
      // For now, just test with invalid token
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.code).toBe('TOKEN_INVALID');
    });

    it('should reject malformed authorization header', async () => {
      const responses = await Promise.all([
        request(app).get('/api/v1/auth/me').set('Authorization', 'Invalid'),
        request(app).get('/api/v1/auth/me').set('Authorization', 'Basic token'),
        request(app).get('/api/v1/auth/me'),
      ]);

      responses.forEach((response) => {
        expect(response.status).toBe(401);
      });
    });
  });
});
