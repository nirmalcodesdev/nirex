import crypto from 'crypto';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError, JwtPayload } from '../types/index.js';

// ─── Password Hashing ────────────────────────────────────────────────────────

// argon2id is the current OWASP/NIST recommended password hashing algorithm.
// It combines argon2i (side-channel resistance) and argon2d (GPU resistance).
// Parameters: m=65536 (64 MiB RAM), t=3 iterations, p=1 thread.
// These meet OWASP's 2024 minimums and produce ~350ms hash time on modern hardware.
const ARGON2_OPTIONS: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

// argon2.verify performs constant-time comparison internally, preventing
// timing attacks that could be used to enumerate valid passwords.
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password, { type: argon2.argon2id });
  } catch {
    // argon2 throws on malformed hashes — treat as failed verification
    return false;
  }
}

// ─── Token Generation ────────────────────────────────────────────────────────

// 32 bytes = 256-bit entropy — computationally infeasible to brute-force.
// URL-safe hex encoding avoids base64 padding issues in query strings.
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Alias used to clearly signal that a refresh token is being generated.
export const generateRefreshToken = generateSecureToken;

// ─── Token Hashing ───────────────────────────────────────────────────────────

// SHA-256 is appropriate for hashing high-entropy tokens (not passwords).
// Tokens are 256-bit random values; SHA-256 provides fast, collision-resistant
// lookups without the slowness of argon2id (which is only needed for low-entropy
// user-chosen passwords).
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

// ─── JWT ─────────────────────────────────────────────────────────────────────

export function signAccessToken(payload: Omit<JwtPayload, 'jti' | 'iat' | 'exp'>): string {
  // HS256 is acceptable for monolithic services where the signing and
  // verifying party are the same process. For microservices, prefer RS256.
  // Add a unique JWT ID (jti) for blacklist tracking
  const payloadWithJti = {
    ...payload,
    jti: generateSecureToken(),
  };

  return jwt.sign(payloadWithJti, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
    }) as JwtPayload;
  } catch (err) {
    // Distinguish between expired and invalid tokens
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('Access token has expired', 401, 'TOKEN_EXPIRED');
    }
    throw new AppError('Invalid access token', 401, 'TOKEN_INVALID');
  }
}
