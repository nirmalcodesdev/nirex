# @nirex/cli

Command-line interface for the Nirex monorepo.

## Features

- **Commander.js** - Command-line framework
- **Chalk** - Terminal styling
- **TypeScript** - Type-safe development

## Getting Started

### Local Development

```bash
pnpm dev
```

### Using the CLI

After building:

```bash
pnpm build
node dist/index.js --help
```

## Scripts

- `pnpm dev` - Run in development mode
- `pnpm build` - Build for production
- `pnpm start` - Run production build
- `pnpm lint` - Run ESLint
- `pnpm test` - Run tests

## Commands

### `hello [name]`

Say hello to a user.

```bash
nirex hello World
```

## Project Structure

```
src/
└── index.ts        # CLI entry point
```
