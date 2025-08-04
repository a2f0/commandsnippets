# Tearleads Frontend

A command snippet tool for computer programmers and system administrators. It's a tagging system that allows for user-defined ordering of both Tag and Entry objects, using MobX-State-Tree for local data persistence and synchronization.

## Development

### Prerequisites

- Node.js v20.17.0 (specified in `.nvmrc`)
- pnpm package manager

### Setup

```shell
# Install dependencies
pnpm install

# Install pre-commit hooks
pip install pre-commit
pre-commit install
pre-commit run --all-files

# Start development server
pnpm run dev
```

The development server will be available at `http://localhost:8080/`

### Working on the theme

```shell
pnpm install ../tearleads-theme
```

## Technology Stack

- **Frontend Framework**: React with TypeScript
- **Build Tool**: Vite
- **State Management**: MobX-State-Tree
- **UI Library**: Material-UI (MUI)
- **Package Manager**: pnpm
- **Linting & Formatting**: Biome
- **Testing**: Jest

## Code Quality

Run linting and formatting:

```shell
pnpm run lint
pnpm run format
```

Run TypeScript compilation check:

```shell
npx tsc -b
```

## Wiki

Please see the [wiki](https://github.com/a2f0/tearleads-frontend/wiki) for coding standards and other important information, including bundle sizes.

## Testing

### E2E Tests

Start the server and run tests in a single command:

```shell
pnpm run ci
pnpm run ci-headless
```

Start the testing server (on different port than normal development server), and then run tests manually in a separate command:

```shell
pnpm run server-test
# in a different console tab
pnpm run test
pnpm run test-headless
```

Run a specific spec:

```shell
pnpm run server-test
pnpm run test -- --spec=test/specs/entries/entriesContextMenu.spec.ts
```

### Unit Tests

Run Jest tests:

```shell
pnpm run unit
pnpm run unit -- --watch
pnpm run unit -- __tests__/reorderEntryList.spec.tsx
```
