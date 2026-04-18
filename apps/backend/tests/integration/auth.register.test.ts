import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDB, disconnectTestDB, clearCollections } from '../helpers/database.js';
import { createTestApp } from '../helpers/app.js';
import type { Application } from 'express';

describe('Auth - Register', () => {
  let app: Application;

  beforeAll(async () => {
    await connectTestDB();
    app = createTestApp();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  describe('POST /api/v1/auth/register', () => {
    const validRegisterData = {
      email: 'newuser@example.com',
      fullName: 'New User',
      password: 'SecurePass123!',
    };

    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegisterData)
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data.userId).toBeDefined();
      expect(typeof response.body.data.userId).toBe('string');
    });

    it('should reject duplicate email registration', async () => {
      // First registration
      await request(app)
        .post('/api/v1/auth/register')
        .send(validRegisterData)
        .expect(201);

      // Second registration with same email
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegisterData)
        .expect(400);

      expect(response.body.status).toBe('fail');
      expect(response.body.code).toBe('SIGNUP_FAILED');
      // Should not reveal that email exists
      expect(response.body.message).not.toContain('email');
      expect(response.body.message).not.toContain('exists');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validRegisterData,
          email: 'invalid-email',
        })
        .expect(422);

      expect(response.body.status).toBe('fail');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject short password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validRegisterData,
          password: 'short',
        })
        .expect(422);

      expect(response.body.message).toContain('Password must be at least 8 characters');
    });

    it('should reject short fullName', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validRegisterData,
          fullName: 'A',
        })
        .expect(422);

      expect(response.body.message).toContain('Full name must be at least 2 characters');
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({})
        .expect(422);

      expect(response.body.status).toBe('fail');
    });

    it('should trim fullName whitespace', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validRegisterData,
          fullName: '  John Doe  ',
        })
        .expect(201);

      expect(response.body.status).toBe('success');
    });

    it('should handle SQL/NoSQL injection attempts', async () => {
      const maliciousInputs = [
        { ...validRegisterData, email: { $ne: null } },
        { ...validRegisterData, fullName: '<script>alert(1)</script>' },
        { ...validRegisterData, email: 'test@example.com\'; DROP TABLE users; --' },
      ];

      for (const input of maliciousInputs) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send(input)
          .expect(422);

        expect(response.body.status).toBe('fail');
      }
    });

    it('should enforce rate limiting', async () => {
      // Make 15 rapid requests (limit is 10 per 15 min window)
      const requests = Array(15).fill(null).map(() =>
        request(app)
          .post('/api/v1/auth/register')
          .send({
            email: `user${Math.random()}@example.com`,
            fullName: 'Test User',
            password: 'SecurePass123!',
          })
      );

      const responses = await Promise.all(requests);

      // At least some should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should handle very long input gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validRegisterData,
          fullName: 'A'.repeat(10000),
        })
        .expect(422);

      expect(response.body.status).toBe('fail');
    });

    it('should set security headers', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegisterData);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
    });
  });
});
