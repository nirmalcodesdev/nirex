import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateSecureToken,
  hashToken,
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
} from '../../src/utils/crypto.js';
import jwt from 'jsonwebtoken';

describe('Crypto Utils', () => {
  describe('Password Hashing', () => {
    it('should hash password with argon2id', async () => {
      const password = 'SecurePass123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash.startsWith('$argon2id$')).toBe(true);
    });

    it('should verify correct password', async () => {
      const password = 'SecurePass123!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'SecurePass123!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword('WrongPass123!', hash);
      expect(isValid).toBe(false);
    });

    it('should reject malformed hash gracefully', async () => {
      const isValid = await verifyPassword('password', 'invalid-hash');
      expect(isValid).toBe(false);
    });

    it('should produce different hashes for same password (salting)', async () => {
      const password = 'SecurePass123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle unicode passwords', async () => {
      const password = '🔐СекретныйПароль123!日本語';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should handle long passwords (72+ chars)', async () => {
      const password = 'a'.repeat(100);
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should have acceptable hash time (OWASP recommended)', async () => {
      const password = 'TestPassword123!';
      const start = performance.now();
      await hashPassword(password);
      const duration = performance.now() - start;

      // Should be between 200ms and 1000ms for security/usability balance
      expect(duration).toBeGreaterThan(200);
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Token Generation', () => {
    it('should generate 64-character hex tokens', () => {
      const token = generateSecureToken();
      expect(token).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateSecureToken());
      }
      expect(tokens.size).toBe(100);
    });

    it('generateRefreshToken should be alias for generateSecureToken', () => {
      const token1 = generateSecureToken();
      const token2 = generateRefreshToken();
      expect(token1).toHaveLength(64);
      expect(token2).toHaveLength(64);
    });
  });

  describe('Token Hashing', () => {
    it('should produce SHA-256 hash', () => {
      const token = 'test-token-123';
      const hash = hashToken(token);

      expect(hash).toHaveLength(64); // SHA-256 hex = 64 chars
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });

    it('should produce deterministic hash', () => {
      const token = 'test-token-123';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = hashToken('token1');
      const hash2 = hashToken('token2');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = hashToken('');
      expect(hash).toHaveLength(64);
    });
  });

  describe('JWT Access Tokens', () => {
    it('should sign and verify valid token', () => {
      const payload = { sub: 'user123', sessionId: 'session456' };
      const token = signAccessToken(payload);

      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3); // JWT structure

      const decoded = verifyAccessToken(token);
      expect(decoded.sub).toBe('user123');
      expect(decoded.sessionId).toBe('session456');
    });

    it('should reject tampered token', () => {
      const payload = { sub: 'user123', sessionId: 'session456' };
      const token = signAccessToken(payload);
      const tampered = token.slice(0, -5) + 'XXXXX';

      expect(() => verifyAccessToken(tampered)).toThrow('Invalid or expired access token');
    });

    it('should reject expired token', () => {
      const payload = { sub: 'user123', sessionId: 'session456' };
      // Create already expired token
      const expiredToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET || 'test-secret-32-chars-long!!!!!', {
        expiresIn: '-1s',
        algorithm: 'HS256',
      });

      expect(() => verifyAccessToken(expiredToken)).toThrow('Invalid or expired access token');
    });

    it('should reject token with wrong signature', () => {
      const payload = { sub: 'user123', sessionId: 'session456' };
      const token = jwt.sign(payload, 'wrong-secret-32-chars-long!!!!!!', {
        expiresIn: '15m',
        algorithm: 'HS256',
      });

      expect(() => verifyAccessToken(token)).toThrow('Invalid or expired access token');
    });

    it('should include issued at and expiration', () => {
      const payload = { sub: 'user123', sessionId: 'session456' };
      const token = signAccessToken(payload);
      const decoded = jwt.decode(token) as any;

      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });
  });

  describe('Performance Checks', () => {
    it('should hash password within acceptable time (OWASP recommended)', async () => {
      const password = 'TestPassword123!';
      const start = performance.now();
      await hashPassword(password);
      const duration = performance.now() - start;

      // Should be between 200ms and 1000ms for security/usability balance
      expect(duration).toBeGreaterThan(200);
      expect(duration).toBeLessThan(1000);
    });

    it('should verify password within acceptable time', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      const start = performance.now();
      await verifyPassword(password, hash);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000);
    });
  });
});
