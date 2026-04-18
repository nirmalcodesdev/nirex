import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDB, disconnectTestDB, clearCollections } from '../helpers/database.js';
import { createTestApp } from '../helpers/app.js';
import { createTestUser, createLockedUser, createUnverifiedUser } from '../helpers/factories.js';
import type { Application } from 'express';
import type { IUserDocument } from '../../src/modules/user/user.model.js';

describe('Auth - Login', () => {
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
    testUser = await createTestUser({
      email: 'test@example.com',
      password: 'SecurePass123!',
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: (testUser as any).plainPassword,
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.userId).toBe(testUser._id.toString());
      expect(response.body.data.sessionId).toBeDefined();
    });

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.status).toBe('fail');
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
      // Generic message to prevent user enumeration
      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should reject non-existent email with same message', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'AnyPassword123!',
        })
        .expect(401);

      expect(response.body.status).toBe('fail');
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should reject unverified email', async () => {
      const unverifiedUser = await createUnverifiedUser({
        email: 'unverified@example.com',
        password: 'SecurePass123!',
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'unverified@example.com',
          password: (unverifiedUser as any).plainPassword,
        })
        .expect(403);

      expect(response.body.status).toBe('fail');
      expect(response.body.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('should reject locked account', async () => {
      const lockedUser = await createLockedUser(15, {
        email: 'locked@example.com',
        password: 'SecurePass123!',
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'locked@example.com',
          password: (lockedUser as any).plainPassword,
        })
        .expect(429);

      expect(response.body.status).toBe('fail');
      expect(response.body.code).toBe('ACCOUNT_LOCKED');
      expect(response.body.message).toContain('Account is temporarily locked');
    });

    it('should track failed login attempts', async () => {
      // Make 4 failed attempts
      for (let i = 0; i < 4; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'test@example.com',
            password: 'WrongPassword123!',
          })
          .expect(401);
      }

      // 5th attempt should still work (lock at 5+)
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!',
        });

      // After 5 failed attempts, account should be locked
      expect(response.status).toBe(429);
    });

    it('should reset failed attempts on successful login', async () => {
      // Make some failed attempts
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!',
        });

      // Successful login
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: (testUser as any).plainPassword,
        })
        .expect(200);

      // Failed attempts should be reset - another wrong password shouldn't lock
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!',
        });

      expect(response.status).toBe(401); // Not locked
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123',
        })
        .expect(422);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject empty password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: '',
        })
        .expect(422);

      expect(response.body.message).toContain('Password is required');
    });

    it('should create session with device info', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: (testUser as any).plainPassword,
        })
        .set('User-Agent', 'Test Browser 1.0')
        .expect(200);

      expect(response.body.data.sessionId).toBeDefined();
    });

    it('should return different tokens for different sessions', async () => {
      const response1 = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: (testUser as any).plainPassword,
        })
        .expect(200);

      const response2 = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: (testUser as any).plainPassword,
        })
        .expect(200);

      expect(response1.body.data.accessToken).not.toBe(response2.body.data.accessToken);
      expect(response1.body.data.refreshToken).not.toBe(response2.body.data.refreshToken);
      expect(response1.body.data.sessionId).not.toBe(response2.body.data.sessionId);
    });
  });
});
