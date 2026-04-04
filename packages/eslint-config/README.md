# @nirex/eslint-config

Shared ESLint configurations for the Nirex monorepo.

## Configurations

### base

Base ESLint configuration for Node.js packages.

```javascript
import base from '@nirex/eslint-config/base';

export default base;
```

### react-internal

ESLint configuration for React packages.

```javascript
import reactInternal from '@nirex/eslint-config/react-internal';

export default reactInternal;
```

## Usage

Add as a dev dependency:

```bash
pnpm add -D @nirex/eslint-config
```
