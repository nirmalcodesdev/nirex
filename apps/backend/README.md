# @nirex/backend

Express.js backend API for the Nirex monorepo. A production-ready authentication and user management service with OAuth support, session management, and security best practices.

## Features

- **Authentication**: Email/password sign-up/sign-in with email verification
- **OAuth**: Google and GitHub OAuth 2.0 integration
- **Session Management**: Multi-device session tracking with bulk termination
- **Security**: Argon2 password hashing, JWT with rotation, rate limiting, token blacklisting
- **Password Management**: Forgot password, reset password, change password
- **Audit Logging**: Comprehensive security event logging

## Tech Stack

- **Runtime**: Node.js 20+ with Express.js
- **Language**: TypeScript 5.9
- **Database**: MongoDB with Mongoose
- **Cache**: Redis (token blacklist, rate limiting)
- **Authentication**: JWT (access + refresh tokens), Passport.js
- **Validation**: Zod schemas (shared with frontend)
- **Testing**: Vitest (unit, integration, e2e, security, penetration)

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
pnpm dev

# Run tests
pnpm test
pnpm test:coverage
pnpm test:security
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_ACCESS_SECRET` | Yes | JWT access token secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | JWT refresh token secret (min 32 chars) |
| `APP_URL` | Yes | Public-facing app URL |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth client secret |
| `SMTP_HOST` | No | SMTP server (defaults to Ethereal) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |

## API Documentation

Base URL: `/api/v1/auth`

### Authentication

All protected endpoints require a valid access token in the `Authorization` header:
```
Authorization: Bearer <access_token>
```

---

### Public Endpoints

#### POST `/sign-up`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "fullName": "John Doe",
  "password": "SecurePassword123"
}
```

**Response (201):**
```json
{
  "status": "success",
  "message": "Account created. Please check your email to verify your address.",
  "data": {
    "userId": "507f1f77bcf86cd799439011"
  }
}
```

**Errors:**
- `400` - Email already exists
- `422` - Validation error (invalid email, short password, etc.)

---

#### GET `/verify-email?token=<token>`
Verify email address with token sent via email.

**Query Parameters:**
- `token` (string, required) - Verification token from email

**Response (200):**
```json
{
  "status": "success",
  "message": "Email verified successfully."
}
```

**Errors:**
- `400` - Invalid or expired token

---

#### POST `/sign-in`
Sign in with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "a1b2c3d4e5f6...",
    "userId": "507f1f77bcf86cd799439011",
    "sessionId": "507f1f77bcf86cd799439012"
  }
}
```

**Errors:**
- `401` - Invalid credentials
- `403` - Email not verified
- `429` - Account locked (too many failed attempts)

---

#### POST `/refresh`
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "a1b2c3d4e5f6..."
}
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "g7h8i9j0k1l2..."
  }
}
```

**Errors:**
- `401` - Invalid or expired refresh token
- `401` - Token reuse detected (all sessions revoked)

---

#### POST `/forgot-password`
Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "status": "success",
  "message": "If an account with that email exists, a reset link has been sent."
}
```

**Note:** Always returns success to prevent email enumeration.

---

#### POST `/reset-password`
Reset password with token from email.

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "password": "NewSecurePassword123"
}
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Password reset successfully."
}
```

**Errors:**
- `400` - Invalid or expired token

---

#### GET `/check`
Check if user is authenticated (useful for app initialization).

**Headers:** Optional `Authorization: Bearer <token>`

**Response (200) - Authenticated:**
```json
{
  "status": "success",
  "data": {
    "isAuthenticated": true,
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "fullName": "John Doe",
      "isEmailVerified": true,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    "session": {
      "id": "507f1f77bcf86cd799439012",
      "deviceInfo": "Mozilla/5.0...",
      "ipAddress": "192.168.1.1",
      "country": "US",
      "lastUsedAt": "2024-01-15T10:30:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

**Response (200) - Not Authenticated:**
```json
{
  "status": "success",
  "data": {
    "isAuthenticated": false,
    "reason": "NO_TOKEN"
  }
}
```

**Reason codes:** `NO_TOKEN`, `TOKEN_EXPIRED`, `TOKEN_REVOKED`, `SESSION_TERMINATED`, `SESSION_REVOKED`, `INVALID_TOKEN`

---

### OAuth Endpoints

#### GET `/oauth/google`
Get Google OAuth authorization URL.

**Query Parameters:**
- `state` (string, optional) - State parameter for OAuth flow

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
    "provider": "google"
  }
}
```

---

#### GET `/oauth/google/callback`
Google OAuth callback endpoint (redirects to frontend).

**Query Parameters:**
- `code` (string) - Authorization code
- `state` (string, optional) - State parameter

**Success Redirect:**
```
{APP_URL}?oauth_success=true&provider=google&access_token=...&refresh_token=...&user_id=...
```

**Error Redirect:**
```
{APP_URL}?oauth_error=...&provider=google
```

---

#### GET `/oauth/github`
Get GitHub OAuth authorization URL.

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "authUrl": "https://github.com/login/oauth/authorize?...",
    "provider": "github"
  }
}
```

---

#### GET `/oauth/github/callback`
GitHub OAuth callback endpoint.

Same behavior as Google callback.

---

### Protected Endpoints

All endpoints below require a valid access token.

#### POST `/sign-out`
Sign out from current session.

**Response (200):**
```json
{
  "status": "success",
  "message": "Signed out successfully."
}
```

---

#### POST `/sign-out-all`
Sign out from all devices/sessions.

**Response (200):**
```json
{
  "status": "success",
  "message": "All sessions terminated."
}
```

---

#### GET `/me`
Get current user profile.

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "fullName": "John Doe",
    "isEmailVerified": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

#### PATCH `/profile`
Update user profile.

**Request Body:**
```json
{
  "fullName": "Jane Doe"
}
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Profile updated successfully.",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "fullName": "Jane Doe",
      "isEmailVerified": true,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T11:00:00.000Z"
    }
  }
}
```

---

#### POST `/change-password`
Change password (requires current password).

**Request Body:**
```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword123"
}
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Password changed successfully. All other sessions have been terminated."
}
```

**Note:** Changing password revokes all other sessions for security.

---

### Session Management

#### GET `/sessions`
List all active sessions for current user.

**Response (200):**
```json
{
  "status": "success",
  "data": [
    {
      "id": "507f1f77bcf86cd799439012",
      "deviceInfo": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
      "ipAddress": "192.168.1.1",
      "country": "US",
      "lastUsedAt": "2024-01-15T10:30:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "expiresAt": "2024-02-14T10:30:00.000Z",
      "isCurrent": true,
      "isActive": true
    }
  ]
}
```

---

#### GET `/devices`
List all devices (alias for `/sessions` with device-focused fields).

**Response (200):** Same as `/sessions`

---

#### DELETE `/sessions/:sessionId`
Revoke a specific session.

**URL Parameters:**
- `sessionId` (string, required) - Session ID to revoke

**Response (200):**
```json
{
  "status": "success",
  "message": "Session revoked."
}
```

---

#### POST `/devices/terminate`
Bulk terminate multiple devices/sessions.

**Request Body:**
```json
{
  "deviceIds": ["507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"],
  "reason": "Lost device"
}
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Terminated 2 device(s). Skipped: 0. Errors: 0.",
  "data": {
    "summary": {
      "total": 2,
      "terminated": 2,
      "skipped": 0,
      "errors": 0
    },
    "details": [
      { "deviceId": "507f1f77bcf86cd799439012", "status": "terminated" },
      { "deviceId": "507f1f77bcf86cd799439013", "status": "terminated" }
    ]
  }
}
```

**Note:** Cannot terminate current session via this endpoint.

---

### Usage Analytics Endpoints

Base URL: `/api/usage` (authenticated)

#### GET `/overview?range=30d|90d|month_to_date`
Returns usage summary, daily chart points, cost breakdown, top projects, and current plan data for the requested window.

#### GET `/export?range=30d|90d|month_to_date&format=json|csv`
Exports the same overview payload as a downloadable report.

**Metric formulas**
- `total_requests`: non-deleted message count in range
- `credits_used`: usage event credits, or fallback `total_tokens / 1000`
- `credits_cost`: token-pricing cost (fallback path) or credit pricing (`$0.05/credit`) when credit events exist
- `trend_pct`: percentage delta vs immediately preceding window of equal duration

---

## Error Responses

All errors follow this format:

```json
{
  "status": "error",
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "errors": {
    "field": "Field-specific error message"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHENTICATED` | 401 | No access token provided |
| `TOKEN_EXPIRED` | 401 | Access token has expired |
| `TOKEN_REVOKED` | 401 | Token has been blacklisted |
| `SESSION_TERMINATED` | 401 | User signed out from all devices |
| `SESSION_REVOKED` | 401 | Session has been revoked |
| `INVALID_CREDENTIALS` | 401 | Invalid email or password |
| `EMAIL_NOT_VERIFIED` | 403 | Email verification required |
| `ACCOUNT_LOCKED` | 429 | Too many failed attempts |
| `VALIDATION_ERROR` | 422 | Input validation failed |
| `EMAIL_ALREADY_EXISTS` | 400 | Email already registered |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

- **Auth endpoints** (`/sign-up`, `/sign-in`, `/forgot-password`, `/reset-password`): 10 requests per 15 minutes
- **API endpoints**: 100 requests per 15 minutes
- **OAuth endpoints**: No rate limiting (handled by providers)

---

## Security Features

1. **Password Security**: Argon2id hashing with 64MB memory cost
2. **Token Rotation**: Refresh tokens rotated on each use
3. **Reuse Detection**: Automatic session revocation if token reuse detected
4. **Account Lockout**: Progressive lockout after failed sign-ins
5. **Token Blacklisting**: Redis-based blacklist for revoked tokens
6. **Session Management**: Track and revoke sessions by device
7. **Audit Logging**: All security events logged to separate audit stream

---

## Project Structure

```
src/
├── app.ts                 # Express app configuration
├── server.ts              # Server entry point
├── config/                # Configuration
│   ├── database.ts        # MongoDB connection
│   ├── redis.ts           # Redis connection
│   ├── env.ts             # Environment validation
│   └── passport.ts        # OAuth configuration
├── middleware/            # Express middleware
│   ├── authenticate.ts    # JWT authentication
│   ├── errorHandler.ts    # Global error handling
│   ├── rateLimiter.ts     # Rate limiting
│   ├── requestLogger.ts   # Request logging
│   └── validate.ts        # Request validation
├── modules/               # Feature modules
│   ├── auth/              # Authentication
│   ├── usage/             # Usage & billing analytics
│   ├── session/           # Session management
│   ├── token/             # Email verification tokens
│   └── user/              # User management
├── types/                 # Type exports
└── utils/                 # Utilities
    ├── crypto.ts          # Encryption, JWT
    ├── logger.ts          # Winston logging
    └── mailer.ts          # Email sending
```

---

## License

MIT
