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

### `check-plan-expiry`

Verifies billing expiry behavior using the live backend billing endpoints.

```bash
# with env vars
set NIREX_API_BASE_URL=http://localhost:3001/api/v1
set NIREX_API_KEY=your_api_key_here
pnpm check-plan-expiry

# with explicit args
pnpm check-plan-expiry --base-url http://localhost:3001/api/v1 --api-key your_api_key_here
```

Optional flags:

- `--skip-checkout-probe` (read-only check, no checkout session call)
- `--plan-id pro|free|enterprise` (default: `pro`)
- `--billing-cycle month|year` (default: `month`)
- `--timeout-ms 15000` (default: `15000`)

## Project Structure

```
src/
└── index.ts        # CLI entry point
```
