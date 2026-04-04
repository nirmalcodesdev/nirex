# @nirex/backend

Express.js backend API for the Nirex monorepo.

## Features

- **Express.js** - Fast, unopinionated web framework
- **TypeScript** - Type-safe development
- **Zod** - Runtime environment validation
- **MongoDB/Mongoose** - Database integration
- **Security** - Helmet, CORS, Morgan logging
- **Error Handling** - Centralized error handling with custom ApiError class

## Getting Started

1. Copy the environment variables:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your configuration

3. Start the development server:
   ```bash
   pnpm dev
   ```

## Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm check-types` - Run TypeScript type checking
- `pnpm test` - Run tests

## Project Structure

```
src/
├── config/         # Configuration files
│   ├── database.ts # MongoDB connection
│   └── env.ts      # Environment validation
├── middlewares/    # Express middlewares
│   └── errorHandler.ts
├── utils/          # Utility classes
│   ├── ApiError.ts
│   ├── ApiResponse.ts
│   └── AsyncHandler.ts
├── app.ts          # Express app configuration
└── index.ts        # Entry point
```

## API Response Format

All API responses follow a standard format:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": { ... }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `8000` |
| `MONGODB_URI` | MongoDB connection string | Required |
| `CORS_ORIGIN` | Allowed CORS origin | `*` |
