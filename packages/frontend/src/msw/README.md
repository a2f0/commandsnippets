# MSW (Mock Service Worker) Module

This directory contains the MSW setup that mocks the API in the browser. Only
test mode (`bun run server-test`, which the E2E tests use) turns it on; the
development server talks to a real API.

## File Structure

```
src/msw/
├── index.ts          # Main export file - import MSW from here
├── enableMocking.ts  # Main initialization function
├── config.ts         # Configuration constants and utilities
├── worker.ts         # MSW service worker setup
├── handlers.ts       # All API mock handlers
├── documents.ts      # Pagination, timestamps and errors as the API renders them
├── requests.ts       # Request documents parsed (and refused) as the API does
├── browser.ts        # Window globals the E2E tests use
├── healthCheck.ts    # Health check utilities
├── requestCounter.ts # Request counting utilities for testing
└── README.md         # This file
```

## Usage

### In Application Code

`src/index.tsx` is what limits MSW to test mode:

```typescript
// src/index.tsx
// MSW only initializes in test mode (not in development)
if (import.meta.env.MODE === 'test') {
  const {enableMocking} = await import('./msw');
  await enableMocking();
}
```

### In Tests

```typescript
// Tests automatically get access to:
// window.__MSW_WORKER__ - The MSW worker instance
// window.resetMSWState - Function to reset mock data
// window.setRuntimeEntriesOverride - Function to replace the entries response
// window.__MSW_REQUESTS__ - Request counts (getCount, getAll, reset)

afterEach(async () => {
  await browser.resetMSWHandlers();
});
```

## Key Components

### `enableMocking.ts`
Main initialization function that:
1. Returns early unless the build is development or test
   (`MSW_CONFIG.isEnabled`). This check alone would also mock the development
   server; the test-only gate is the caller in `src/index.tsx`.
2. Starts MSW service worker
3. Exposes utilities globally
4. Performs health check

### `handlers.ts`
Contains all API mock handlers:
- Tags CRUD operations
- Entries CRUD operations
- Tagging and untagging entries (`/tags_entries`)
- Health check endpoint
- Authentication endpoints
- Stateful mock data with reset capability

The write handlers keep that state as the API keeps its database. A rename,
an edit or a new junction gets a new revision (`date_updated`, past every
other of the user's rows in its table), and tagging and untagging do what the
API's triggers do (the entry's `tag_count`, the tag's `entry_count` and
`date_last_used`) and advance the entry's revision and junction linkage. Their
request documents are checked as the API checks them (`requests.ts`), with the
same error documents. `__tests__/src/msw/handlers.spec.ts` covers this.

Every response is what the API would send, typed with
`@commandsnippets/api-shared`'s document types and built with
`documents.ts`. `__tests__/src/msw/contract.spec.ts` parses each one with
api-shared's schemas, and fails on a handler it does not check: add a new
handler's request there.

### `config.ts`
Centralized configuration:
- Service worker URL
- Request handling options
- Environment detection
- Health check settings

### `browser.ts`
Browser-specific utilities:
- Exposes MSW worker to `window.__MSW_WORKER__`
- Exposes reset function to `window.resetMSWState`
- Exposes `window.setRuntimeEntriesOverride` and the request counters
  (`window.__MSW_REQUESTS__`)

### `healthCheck.ts`
Health check utilities to verify MSW is working

### `worker.ts`
Creates the MSW service worker with all handlers

### `requestCounter.ts`
Provides request counting utilities for test assertions:
- Tracks API calls by method and URL
- Used in E2E tests to verify API interactions

## Benefits of This Structure

1. **Separation of Concerns**: Each file has a single responsibility
2. **Reusable Components**: Individual functions can be imported as needed
3. **Testable**: Each module can be tested independently
4. **Maintainable**: Clear organization makes updates easier
5. **Type Safe**: Full TypeScript support throughout
