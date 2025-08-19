# MSW (Mock Service Worker) Module

This directory contains the complete MSW setup for API mocking in development and test environments.

## File Structure

```
src/msw/
├── index.ts          # Main export file - import MSW from here
├── enableMocking.ts  # Main initialization function
├── config.ts         # Configuration constants and utilities
├── worker.ts         # MSW service worker setup
├── handlers.ts       # All API mock handlers (moved from src/handlers.ts)
├── browser.ts        # Browser-specific utilities (window globals)
├── healthCheck.ts    # Health check utilities
└── README.md         # This file
```

## Usage

### In Application Code

```typescript
// src/index.tsx
const {enableMocking} = await import('./msw');
await enableMocking();
```

### In Tests

```typescript
// Tests automatically get access to:
// window.__MSW_WORKER__ - The MSW worker instance
// window.resetMSWState - Function to reset mock data

afterEach(async () => {
  await browser.resetMSWHandlers();
});
```

## Key Components

### `enableMocking.ts`
Main initialization function that:
1. Checks environment (dev/test only)
2. Starts MSW service worker
3. Exposes utilities globally
4. Performs health check

### `handlers.ts`
Contains all API mock handlers:
- Tags CRUD operations
- Entries CRUD operations
- Health check endpoint
- Authentication endpoints
- Stateful mock data with reset capability

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

### `healthCheck.ts`
Health check utilities to verify MSW is working

### `worker.ts`
Creates the MSW service worker with all handlers

## Benefits of This Structure

1. **Separation of Concerns**: Each file has a single responsibility
2. **Reusable Components**: Individual functions can be imported as needed
3. **Testable**: Each module can be tested independently
4. **Maintainable**: Clear organization makes updates easier
5. **Type Safe**: Full TypeScript support throughout
