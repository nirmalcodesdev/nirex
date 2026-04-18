import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { connectTestDB, disconnectTestDB, clearCollections } from '../helpers/database.js';
import { createTestApp } from '../helpers/app.js';
import { createVerifyToken, createResetToken } from '../helpers/factories.js';
import type { Application } from 'express';

describe('E2E - Complete Auth Flow', () => {
  let app: Application;

  beforeAll(async () => {
    await connectTestDB();
    app = createTestApp();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  it('should complete full registration and login flow', async () => {
    // Step 1: Register
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'newuser@example.com',
        fullName: 'New User',
        password: 'SecurePass123!',
      })
      .expect(201);

    expect(registerResponse.body.data.userId).toBeDefined();
    const userId = registerResponse.body.data.userId;

    // Step 2: Try to login before verification (should fail)
    const preVerifyLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'newuser@example.com',
        password: 'SecurePass123!',
      })
      .expect(403);

    expect(preVerifyLogin.body.code).toBe('EMAIL_NOT_VERIFIED');

    // Step 3: Verify email
    const { User } = await import('../../src/modules/user/user.model.js');
    const user = await User.findById(userId);
    const { rawToken } = await createVerifyToken(user!._id);

    await request(app)
      .get('/api/v1/auth/verify-email')
      .query({ token: rawToken })
      .expect(200);

    // Step 4: Login after verification
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'newuser@example.com',
        password: 'SecurePass123!',
      })
      .expect(200);

    expect(loginResponse.body.data.accessToken).toBeDefined();
    expect(loginResponse.body.data.refreshToken).toBeDefined();

    const accessToken = loginResponse.body.data.accessToken;
    const refreshToken = loginResponse.body.data.refreshToken;

    // Step 5: Access protected endpoint
    const meResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(meResponse.body.data.email).toBe('newuser@example.com');

    // Step 6: Refresh token
    const refreshResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(refreshResponse.body.data.accessToken).toBeDefined();
    const newAccessToken = refreshResponse.body.data.accessToken;

    // Step 7: Use new access token
    const me2Response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${newAccessToken}`)
      .expect(200);

    expect(me2Response.body.data.email).toBe('newuser@example.com');

    // Step 8: Logout
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${newAccessToken}`)
      .expect(200);

    // Step 9: Verify old refresh token is invalid
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('should handle password reset flow', async () => {
    // Step 1: Register and verify user
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'resetuser@example.com',
        fullName: 'Reset User',
        password: 'OldPass123!',
      })
      .expect(201);

    const { User } = await import('../../src/modules/user/user.model.js');
    const user = await User.findOne({ email: 'resetuser@example.com' });

    // Step 2: Request password reset
    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'resetuser@example.com' })
      .expect(200);

    // Step 3: Reset password with token
    const { rawToken } = await createResetToken(user!._id);

    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: rawToken,
        password: 'NewPass123!',
      })
      .expect(200);

    // Step 4: Try old password (should fail)
    await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'resetuser@example.com',
        password: 'OldPass123!',
      })
      .expect(401);

    // Step 5: Login with new password
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'resetuser@example.com',
        password: 'NewPass123!',
      })
      .expect(200);

    expect(loginResponse.body.data.accessToken).toBeDefined();
  });

  it('should handle multi-device session management', async () => {
    // Register user
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'multidevice@example.com',
        fullName: 'Multi Device User',
        password: 'SecurePass123!',
      })
      .expect(201);

    const { User } = await import('../../src/modules/user/user.model.js');
    const user = await User.findOne({ email: 'multidevice@example.com' });
    const { rawToken } = await createVerifyToken(user!._id);
    await request(app)
      .get('/api/v1/auth/verify-email')
      .query({ token: rawToken })
      .expect(200);

    // Login from device 1
    const device1 = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'multidevice@example.com',
        password: 'SecurePass123!',
      })
      .set('User-Agent', 'Device 1')
      .expect(200);

    // Login from device 2
    const device2 = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'multidevice@example.com',
        password: 'SecurePass123!',
      })
      .set('User-Agent', 'Device 2')
      .expect(200);

    // Login from device 3
    const device3 = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'multidevice@example.com',
        password: 'SecurePass123!',
      })
      .set('User-Agent', 'Device 3')
      .expect(200);

    // List sessions from device 1
    const sessionsResponse = await request(app)
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${device1.body.data.accessToken}`)
      .expect(200);

    expect(sessionsResponse.body.data.length).toBe(3);

    // Revoke device 2 session from device 1
    const session2Id = device2.body.data.sessionId;
    await request(app)
      .delete(`/api/v1/auth/sessions/${session2Id}`)
      .set('Authorization', `Bearer ${device1.body.data.accessToken}`)
      .expect(200);

    // Device 2 should be logged out
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: device2.body.data.refreshToken })
      .expect(401);

    // Device 1 and 3 should still work
    await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${device1.body.data.accessToken}`)
      .expect(200);

    // Logout all from device 1
    await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${device1.body.data.accessToken}`)
      .expect(200);

    // All sessions should be invalid
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: device1.body.data.refreshToken })
      .expect(401);

    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: device3.body.data.refreshToken })
      .expect(401);
  });

  it('should handle account lockout and recovery', async () => {
    // Register and verify user
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'lockout@example.com',
        fullName: 'Lockout User',
        password: 'SecurePass123!',
      })
      .expect(201);

    const { User } = await import('../../src/modules/user/user.model.js');
    const user = await User.findOne({ email: 'lockout@example.com' });
    const { rawToken } = await createVerifyToken(user!._id);
    await request(app)
      .get('/api/v1/auth/verify-email')
      .query({ token: rawToken })
      .expect(200);

    // Failed login attempts
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'lockout@example.com',
          password: 'WrongPassword123!',
        });
    }

    // Account should be locked
    const lockedResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'lockout@example.com',
        password: 'SecurePass123!',
      })
      .expect(429);

    expect(lockedResponse.body.code).toBe('ACCOUNT_LOCKED');

    // Wait for lockout (manually reset for test)
    await User.updateOne(
      { email: 'lockout@example.com' },
      { $set: { failedLoginAttempts: 0, lockedUntil: null } }
    );

    // Should be able to login now
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'lockout@example.com',
        password: 'SecurePass123!',
      })
      .expect(200);

    expect(loginResponse.body.data.accessToken).toBeDefined();
  });
});
