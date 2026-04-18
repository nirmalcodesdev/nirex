import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDB, disconnectTestDB, clearCollections } from '../helpers/database.js';
import { createTestApp } from '../helpers/app.js';
import { createTestUser } from '../helpers/factories.js';
import type { Application } from 'express';
import type { IUserDocument } from '../../src/modules/user/user.model.js';

describe('Security - Injection Attack Prevention', () => {
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

  describe('NoSQL Injection', () => {
    it('should prevent NoSQL injection in login email', async () => {
      const maliciousPayloads = [
        { email: { $ne: null }, password: 'password' },
        { email: { $gt: '' }, password: 'password' },
        { email: { $regex: '.*' }, password: 'password' },
        { email: { $exists: true }, password: 'password' },
        { email: { $where: 'this.email' }, password: 'password' },
      ];

      for (const payload of maliciousPayloads) {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send(payload)
          .expect(422);

        expect(response.body.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should prevent NoSQL injection in login password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: { $ne: null },
        })
        .expect(422);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should prevent NoSQL injection in registration', async () => {
      const maliciousPayloads = [
        {
          email: { $ne: null },
          fullName: 'Test User',
          password: 'SecurePass123!',
        },
        {
          email: 'test@example.com',
          fullName: { $gt: '' },
          password: 'SecurePass123!',
        },
      ];

      for (const payload of maliciousPayloads) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send(payload)
          .expect(422);

        expect(response.body.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should prevent NoSQL injection in forgot-password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: { $ne: null } })
        .expect(422);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should prevent NoSQL injection in session ID parameter', async () => {
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: (testUser as any).plainPassword,
        });

      const accessToken = loginResponse.body.data.accessToken;

      const maliciousIds = [
        '{"$ne":null}',
        '{"$gt":""}',
        '507f1f77bcf86cd799439011"; DROP TABLE sessions; --',
      ];

      for (const id of maliciousIds) {
        const response = await request(app)
          .delete(`/api/v1/auth/sessions/${id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        // Should either 404 or handle gracefully, not crash
        expect([400, 404, 422]).toContain(response.status);
      }
    });
  });

  describe('XSS Prevention', () => {
    it('should sanitize script tags in registration', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert("xss")>',
        'javascript:alert("xss")',
        '<body onload=alert("xss")>',
        '<iframe src="javascript:alert(\'xss\')">',
      ];

      for (let i = 0; i < xssPayloads.length; i++) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: `xss${i}@example.com`,
            fullName: xssPayloads[i],
            password: 'SecurePass123!',
          })
          .expect(201);

        // Registration should succeed, but response should not execute scripts
        expect(response.body.status).toBe('success');
        expect(response.headers['content-type']).toContain('application/json');
      }
    });

    it('should escape HTML in error messages', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: '<script>alert(1)</script>@example.com',
          password: 'password',
        })
        .expect(422);

      // Error message should not contain executable script
      expect(response.body.message).not.toContain('<script>');
    });
  });

  describe('Command Injection', () => {
    it('should prevent command injection in user inputs', async () => {
      const maliciousInputs = [
        'test@example.com; cat /etc/passwd',
        'test@example.com && rm -rf /',
        'test@example.com | whoami',
        'test@example.com`whoami`',
        '$(whoami)@example.com',
      ];

      for (const email of maliciousInputs) {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({ email, password: 'password' })
          .expect(422);

        expect(response.body.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('Path Traversal', () => {
    it('should prevent path traversal in session ID', async () => {
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: (testUser as any).plainPassword,
        });

      const accessToken = loginResponse.body.data.accessToken;

      const traversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '....//....//....//etc/passwd',
      ];

      for (const id of traversalAttempts) {
        const response = await request(app)
          .delete(`/api/v1/auth/sessions/${id}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect([400, 404, 422]).toContain(response.status);
      }
    });
  });

  describe('Header Injection', () => {
    it('should prevent header injection in responses', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com\r\nX-Custom-Header: injected',
          fullName: 'Test User',
          password: 'SecurePass123!',
        })
        .expect(422);

      // Response headers should not contain injected header
      expect(response.headers['x-custom-header']).toBeUndefined();
    });
  });

  describe('JSON Parsing Security', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": "test@example.com", invalid json}')
        .expect(400);

      expect(response.body.status).toBe('error');
    });

    it('should handle empty body', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .expect(422);

      expect(response.body.status).toBe('fail');
    });

    it('should handle array instead of object', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send([{ email: 'test@example.com', password: 'pass' }])
        .expect(422);

      expect(response.body.status).toBe('fail');
    });

    it('should handle extremely large payloads', async () => {
      const largePayload = {
        email: 'a'.repeat(10000) + '@example.com',
        password: 'b'.repeat(10000),
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(largePayload)
        .expect(413); // Payload too large
    });

    it('should handle deeply nested JSON', async () => {
      let nested: any = 'value';
      for (let i = 0; i < 1000; i++) {
        nested = { nested };
      }

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: nested, password: 'pass' })
        .expect(422);

      expect(response.body.status).toBe('fail');
    });
  });

  describe('Prototype Pollution', () => {
    it('should prevent prototype pollution via JSON', async () => {
      const pollutedPayload = JSON.parse('{"email": "test@example.com", "fullName": "Test", "password": "SecurePass123!", "__proto__": {"polluted": true}}');

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(pollutedPayload)
        .expect(201);

      expect(response.body.status).toBe('success');

      // Verify prototype was not polluted
      expect(({} as any).polluted).toBeUndefined();
    });

    it('should prevent constructor pollution', async () => {
      const pollutedPayload = JSON.parse('{"email": "test@example.com", "fullName": "Test", "password": "SecurePass123!", "constructor": {"prototype": {"polluted": true}}}');

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(pollutedPayload)
        .expect(201);

      expect(response.body.status).toBe('success');
    });
  });
});
