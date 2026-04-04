# Nirex

A production-ready monorepo starter built with Turborepo, TypeScript, React, and Express.

## 🚀 Features

- **Monorepo Architecture** - Powered by [Turborepo](https://turbo.build/) for efficient task running and caching
- **Type Safety** - Full TypeScript support across all packages and apps
- **Modern Frontend** - React 19 + Vite for lightning-fast development
- **Robust Backend** - Express.js with MongoDB, Zod validation, and comprehensive error handling
- **Shared Packages** - Reusable UI components and utilities
- **CLI Tool** - Command-line interface for automation
- **Code Quality** - ESLint, Prettier, and type checking configured

## 📁 Project Structure

```
.
├── apps/
│   ├── backend/          # Express.js API server
│   ├── frontend/         # React + Vite frontend
│   └── cli/              # Command-line interface
├── packages/
│   ├── shared/           # Shared utilities and types
│   ├── ui/               # React UI component library
│   ├── eslint-config/    # Shared ESLint configurations
│   └── typescript-config/# Shared TypeScript configurations
├── package.json          # Root package.json
├── turbo.json            # Turborepo configuration
└── pnpm-workspace.yaml   # pnpm workspace configuration
```

## 🛠️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 9.0.0
- [MongoDB](https://www.mongodb.com/) (for backend)

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd nirex
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables:
   ```bash
   cp apps/backend/.env.example apps/backend/.env
   cp apps/frontend/.env.example apps/frontend/.env
   ```

4. Update the `.env` files with your configuration

### Development

Run all apps in development mode:

```bash
pnpm dev
```

Or run specific apps:

```bash
pnpm dev --filter @nirex/backend
pnpm dev --filter @nirex/frontend
```

### Building

Build all apps and packages:

```bash
pnpm build
```

### Testing

Run tests across all packages:

```bash
pnpm test
```

### Linting & Type Checking

```bash
pnpm lint          # Run ESLint
pnpm check-types   # Run TypeScript type checking
pnpm format        # Format code with Prettier
```

## 📦 Apps & Packages

### Apps

| App | Description | Port |
|-----|-------------|------|
| `@nirex/backend` | Express.js API with MongoDB | 8000 |
| `@nirex/frontend` | React + Vite frontend | 5173 |
| `@nirex/cli` | Command-line interface | - |

### Packages

| Package | Description |
|---------|-------------|
| `@nirex/shared` | Shared constants, types, and utilities |
| `@nirex/ui` | Reusable React UI components |
| `@nirex/eslint-config` | Shared ESLint configurations |
| `@nirex/typescript-config` | Shared TypeScript configurations |

## 🔧 Configuration

### Environment Variables

#### Backend (`apps/backend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `8000` |
| `MONGODB_URI` | MongoDB connection string | Required |
| `CORS_ORIGIN` | Allowed CORS origin | `*` |

#### Frontend (`apps/frontend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:8000/api/v1` |

## 📝 Scripts

### Root

- `pnpm dev` - Start all apps in development mode
- `pnpm build` - Build all apps and packages
- `pnpm lint` - Lint all packages
- `pnpm check-types` - Type check all packages
- `pnpm format` - Format code with Prettier

### Backend

- `pnpm dev` - Start with hot reload
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm test` - Run tests

### Frontend

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- [Turborepo](https://turbo.build/) - For the monorepo tooling
- [Vite](https://vitejs.dev/) - For the frontend build tool
- [Express.js](https://expressjs.com/) - For the backend framework
