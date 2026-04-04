# @nirex/frontend

Modern React frontend built with Vite for the Nirex monorepo.

## Features

- **React 19** - Latest React with concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Lightning fast build tool
- **ESLint** - Code linting with React hooks and refresh plugins

## Getting Started

1. Copy the environment variables:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your API URL

3. Start the development server:
   ```bash
   pnpm dev
   ```

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm lint` - Run ESLint

## Project Structure

```
src/
├── assets/         # Static assets
├── App.tsx         # Main application component
├── main.tsx        # Entry point
├── App.css         # Component styles
└── index.css       # Global styles
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:8000/api/v1` |

## Workspace Dependencies

- `@nirex/ui` - Shared UI components
- `@nirex/shared` - Shared utilities and types
