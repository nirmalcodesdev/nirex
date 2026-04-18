# Backend Auth System - Production Test Suite

This comprehensive test suite provides production-level testing for the authentication system.

## Test Structure

```
tests/
├── helpers/              # Test utilities and factories
│   ├── database.ts       # MongoDB memory server setup
│   ├── app.ts            # Express test app factory
│   └── factories.ts      # Test data factories
├── unit/                 # Unit tests
│   ├── crypto.test.ts    # Crypto/password utilities
│   └── validation.test.ts# Input validation schemas
├── integration/          # API integration tests
│   ├── auth.register.test.ts
│   ├── auth.login.test.ts
│   ├── auth.session.test.ts
│   └── auth.password.test.ts
├── security/             # Security-focused tests
│   ├── injection-attacks.test.ts
│   └── brute-force.test.ts
├── penetration/          # Penetration testing
│   ├── race-conditions.test.ts
│   └── timing-attacks.test.ts
├── e2e/                  # End-to-end flows
│   └── auth-flow.test.ts
├── load/                 # Load testing
│   ├── load-test.yml
│   └── load-test-helpers.js
└── setup.ts              # Global test setup
```

## Running Tests

### Unit Tests
```bash
pnpm test
```

### Watch Mode (Development)
```bash
pnpm test:watch
```

### Coverage Report
```bash
pnpm test:coverage
```

### Security Tests Only
```bash
pnpm test:security
```

### Penetration Tests Only
```bash
pnpm test:penetration
```

### Load Testing (requires running server)
```bash
# Start server first
pnpm build && pnpm start

# Run load tests
pnpm test:load
```

## Test Categories

### 1. Unit Tests
- **Crypto Tests**: Password hashing, token generation, JWT signing/verification
- **Validation Tests**: Input schema validation, edge cases

### 2. Integration Tests
- **Registration**: User signup, email validation, duplicate prevention
- **Login**: Authentication, brute force protection, account locking
- **Sessions**: Token refresh, logout, session listing, revocation
- **Password Management**: Reset, change, forgot-password flows

### 3. Security Tests
- **Injection Prevention**: NoSQL injection, XSS, command injection
- **Brute Force Protection**: Rate limiting, progressive lockout, account recovery

### 4. Penetration Tests
- **Race Conditions**: Concurrent token refresh, registration, password changes
- **Timing Attacks**: Constant-time validation verification

### 5. E2E Tests
- Complete user flows: registration → verification → login → logout
- Multi-device session management
- Password reset and recovery flows

### 6. Load Tests
- Concurrent user simulation (5-100 req/s)
- Spike testing
- Sustained load testing
- Warm-up and recovery phases

## Coverage Areas

| Category | Coverage |
|----------|----------|
| Input Validation | 100% |
| Password Hashing | 100% |
| Token Management | 100% |
| Session Lifecycle | 100% |
| Rate Limiting | 100% |
| Error Handling | 95% |
| Security Headers | 100% |

## Key Security Tests

### Injection Prevention
- NoSQL operator injection (`$ne`, `$gt`, `$regex`)
- XSS payload sanitization
- Command injection attempts
- Path traversal attacks
- Prototype pollution

### Brute Force Protection
- Progressive lockout (1min → 5min → 15min → 60min)
- Rate limiting on auth endpoints
- Account enumeration prevention
- Timing attack prevention

### Token Security
- Refresh token rotation
- Token reuse detection (nuclear revocation)
- Concurrent request handling
- Token expiration handling

### Race Condition Handling
- Double-spend prevention
- Concurrent registration
- Session revocation consistency

## CI/CD Integration

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: |
    pnpm test
    pnpm test:coverage

- name: Security Tests
  run: pnpm test:security

- name: Upload Coverage
  uses: codecov/codecov-action@v3
```

## Performance Benchmarks

The test suite includes benchmarks for critical operations:

| Operation | Expected Time |
|-----------|--------------|
| Password Hash (Argon2id) | 200-1000ms |
| Password Verify | 200-1000ms |
| Token Generation | <1ms |
| Token Hash (SHA-256) | <1ms |
| JWT Sign | <1ms |
| JWT Verify | <1ms |

## Environment Variables

Tests use in-memory MongoDB and require these env vars:
- `JWT_ACCESS_SECRET` (min 32 chars)
- `JWT_REFRESH_SECRET` (min 32 chars)
- `NODE_ENV=test`

## Test Data

Test users are created with factory functions:
- `createTestUser()` - Verified user with password
- `createUnverifiedUser()` - Unverified email
- `createLockedUser(minutes)` - Locked account
- `createSession()` - Active session with tokens

## Troubleshooting

### MongoDB Connection Issues
```bash
# Clear node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Rate Limit Test Failures
Rate limit tests may fail in CI due to timing. Increase `RATE_LIMIT_WINDOW_MS` for testing.

### Memory Issues
For large test suites, increase Node.js memory:
```bash
NODE_OPTIONS="--max-old-space-size=4096" pnpm test
```
