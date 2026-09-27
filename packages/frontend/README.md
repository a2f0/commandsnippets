# Tearleads Frontend

A command snippet tool for computer programmers and system administrators. It's a tagging system that allows for user-defined ordering of both Tag and Entry objects, using MobX-State-Tree for local data persistence and synchronization.

## Development

### Prerequisites

### Setup

```shell
npm i -g pnpm
# Install dependencies
pnpm install

# Install pre-commit hooks
pip install pre-commit
pre-commit install
pre-commit run --all-files

# Start development server
pnpm run dev
```

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

## Deploying

The app is a static single-page app served by a Cloudflare Worker (assets only;
`wrangler.jsonc`): files from `build/`, and `index.html` for any other path, so
client routes like `/:user/:tag` work. `public/_headers` adds security headers
and long-lived caching for the fingerprinted `/assets/`.

```shell
pnpm run deploy:staging      # vite build --mode staging, then wrangler deploy
pnpm run deploy:production
```

Each environment's hostname is a custom domain in `wrangler.jsonc`, attached
by the deploy: `app-staging.commandsnippets.com` for staging, and
`app.commandsnippets.com` for production at cutover. The app picks its
environment (API and OAuth callbacks) from that hostname, so it does not run
on workers.dev.

## Other

- Please see the [wiki](https://github.com/a2f0/tearleads-frontend/wiki) for coding standards and other important information

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

or

```shell
./scripts/runSpec.sh test/specs/tags/tagContextMenu/allowsDeletingATag.spec.ts
```

### Unit Tests

Run unit tests:

```shell
pnpm run unit
pnpm run unit -- --watch
pnpm run unit -- __tests__/reorderEntryList.spec.tsx
```
