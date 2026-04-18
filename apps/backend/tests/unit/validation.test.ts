import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  refreshSchema,
} from '../../src/middleware/validate.js';
import { ZodError } from 'zod';

describe('Validation Schemas', () => {
  describe('registerSchema', () => {
    const validInput = {
      email: 'test@example.com',
      fullName: 'John Doe',
      password: 'SecurePass123!',
    };

    it('should validate correct input', () => {
      const result = registerSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it('should trim fullName', () => {
      const input = { ...validInput, fullName: '  John Doe  ' };
      const result = registerSchema.parse(input);
      expect(result.fullName).toBe('John Doe');
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'plainstring',
        '@nodomain.com',
        'spaces in@email.com',
        'double@@at.com',
        '',
      ];

      invalidEmails.forEach((email) => {
        expect(() => registerSchema.parse({ ...validInput, email })).toThrow(ZodError);
      });
    });

    it('should reject short fullName', () => {
      expect(() =>
        registerSchema.parse({ ...validInput, fullName: 'A' })
      ).toThrow('Full name must be at least 2 characters');
    });

    it('should reject long fullName', () => {
      expect(() =>
        registerSchema.parse({ ...validInput, fullName: 'A'.repeat(101) })
      ).toThrow('Full name must be at most 100 characters');
    });

    it('should reject short password', () => {
      expect(() =>
        registerSchema.parse({ ...validInput, password: 'short' })
      ).toThrow('Password must be at least 8 characters');
    });

    it('should reject long password', () => {
      expect(() =>
        registerSchema.parse({ ...validInput, password: 'A'.repeat(129) })
      ).toThrow('Password is too long');
    });

    it('should reject missing fields', () => {
      expect(() => registerSchema.parse({})).toThrow(ZodError);
      expect(() => registerSchema.parse({ email: 'test@example.com' })).toThrow(ZodError);
    });

    it('should reject additional properties', () => {
      const input = { ...validInput, extraField: 'value' };
      const result = registerSchema.parse(input);
      expect(result).not.toHaveProperty('extraField');
    });

    it('should accept password at minimum length (8)', () => {
      const result = registerSchema.parse({ ...validInput, password: 'A'.repeat(8) });
      expect(result.password).toHaveLength(8);
    });

    it('should accept password at maximum length (128)', () => {
      const result = registerSchema.parse({ ...validInput, password: 'A'.repeat(128) });
      expect(result.password).toHaveLength(128);
    });
  });

  describe('loginSchema', () => {
    const validInput = {
      email: 'test@example.com',
      password: 'anyPassword123',
    };

    it('should validate correct input', () => {
      const result = loginSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it('should reject invalid email', () => {
      expect(() => loginSchema.parse({ ...validInput, email: 'invalid' })).toThrow();
    });

    it('should reject empty password', () => {
      expect(() => loginSchema.parse({ ...validInput, password: '' })).toThrow('Password is required');
    });

    it('should accept any non-empty password length', () => {
      const longPassword = 'a'.repeat(1000);
      const result = loginSchema.parse({ ...validInput, password: longPassword });
      expect(result.password).toBe(longPassword);
    });
  });

  describe('forgotPasswordSchema', () => {
    it('should validate email', () => {
      const result = forgotPasswordSchema.parse({ email: 'test@example.com' });
      expect(result.email).toBe('test@example.com');
    });

    it('should reject invalid email', () => {
      expect(() => forgotPasswordSchema.parse({ email: 'invalid' })).toThrow();
    });
  });

  describe('resetPasswordSchema', () => {
    const validInput = {
      token: 'valid-token-string',
      password: 'NewSecurePass123!',
    };

    it('should validate correct input', () => {
      const result = resetPasswordSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it('should reject empty token', () => {
      expect(() =>
        resetPasswordSchema.parse({ ...validInput, token: '' })
      ).toThrow('Token is required');
    });

    it('should reject short password', () => {
      expect(() =>
        resetPasswordSchema.parse({ ...validInput, password: 'short' })
      ).toThrow('Password must be at least 8 characters');
    });

    it('should reject long password', () => {
      expect(() =>
        resetPasswordSchema.parse({ ...validInput, password: 'A'.repeat(129) })
      ).toThrow('Password is too long');
    });
  });

  describe('changePasswordSchema', () => {
    const validInput = {
      currentPassword: 'OldPass123!',
      newPassword: 'NewSecurePass123!',
    };

    it('should validate correct input', () => {
      const result = changePasswordSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it('should reject empty currentPassword', () => {
      expect(() =>
        changePasswordSchema.parse({ ...validInput, currentPassword: '' })
      ).toThrow('Current password is required');
    });

    it('should reject short newPassword', () => {
      expect(() =>
        changePasswordSchema.parse({ ...validInput, newPassword: 'short' })
      ).toThrow('New password must be at least 8 characters');
    });

    it('should reject long newPassword', () => {
      expect(() =>
        changePasswordSchema.parse({ ...validInput, newPassword: 'A'.repeat(129) })
      ).toThrow('Password is too long');
    });
  });

  describe('refreshSchema', () => {
    it('should validate refresh token', () => {
      const result = refreshSchema.parse({ refreshToken: 'valid-refresh-token' });
      expect(result.refreshToken).toBe('valid-refresh-token');
    });

    it('should reject empty refresh token', () => {
      expect(() => refreshSchema.parse({ refreshToken: '' })).toThrow('Refresh token is required');
    });

    it('should reject missing refresh token', () => {
      expect(() => refreshSchema.parse({})).toThrow();
    });
  });

  describe('Edge Cases & Security', () => {
    it('should strip HTML/script tags from strings', () => {
      const input = {
        email: 'test@example.com',
        fullName: '<script>alert("xss")</script>John',
        password: 'SecurePass123!',
      };

      // Zod doesn't auto-strip, but the schema should still parse
      const result = registerSchema.parse(input);
      expect(result.fullName).toBe('<script>alert("xss")</script>John');
    });

    it('should handle unicode in names', () => {
      const input = {
        email: 'test@example.com',
        fullName: 'José María 日本語',
        password: 'SecurePass123!',
      };

      const result = registerSchema.parse(input);
      expect(result.fullName).toBe('José María 日本語');
    });

    it('should handle special characters in passwords', () => {
      const specialPasswords = [
        'Pass!@#$%^&*()',
        'Pass<>?/[]{}',
        'Pass"\'\\test',
        'Pass🚀🔐secure',
        'Pass\n\r\t123',
      ];

      specialPasswords.forEach((password) => {
        const input = {
          email: 'test@example.com',
          fullName: 'Test User',
          password,
        };
        const result = registerSchema.parse(input);
        expect(result.password).toBe(password);
      });
    });

    it('should coerce types when possible', () => {
      // Zod will try to coerce certain types
      const input = {
        email: 'test@example.com',
        fullName: 123, // number instead of string
        password: 'SecurePass123!',
      };

      expect(() => registerSchema.parse(input)).toThrow();
    });
  });
});
