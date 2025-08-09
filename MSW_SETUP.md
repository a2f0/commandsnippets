# Unified MSW Setup - One Master MSW to Serve Them All

This project uses Mock Service Worker (MSW) to provide consistent API mocking across both development (Vite) and testing (WDIO) environments. **We have a single, unified MSW configuration that serves both environments.**

## Architecture

### Single Source of Truth

```
src/
├── handlers.ts        # All API mock handlers (single source of truth)
├── mswWorker.ts      # MSW worker setup
├── msw.ts            # Unified initialization function
└── index.tsx         # App entry point that initializes MSW

test/
└── wdio.shared.conf.ts  # Test config that uses the same MSW instance

public/
└── mockServiceWorker.js  # MSW service worker (auto-generated)
```

## Key Components

### 1. `src/handlers.ts` - The Heart of MSW
- **Purpose**: Single source of truth for ALL API mock handlers
- **Contains**: Mock responses for tags, entries, health checks, auth, etc.
- **Features**:
  - Stateful handlers (can modify data during runtime)
  - `resetMSWState()` function to restore original state between tests
  - Supports multiple API base URLs (localhost, staging, production)
  - Full CRUD operations (GET, POST, DELETE)

### 2. `src/mswWorker.ts` - Worker Setup
```typescript
import {setupWorker} from 'msw/browser';
import {handlers} from './handlers';

export const worker = setupWorker(...handlers);
```

### 3. `src/msw.ts` - Unified Initialization
```typescript
async function enableMocking() {
  // Only run in dev/test environments
  if (process.env['NODE_ENV'] !== 'development' &&
      process.env['NODE_ENV'] !== 'test') {
    return;
  }

  const {worker} = await import('./mswWorker');

  // Start MSW and expose globally for tests
  await worker.start();
  (window as any).__MSW_WORKER__ = worker;
  (window as any).resetMSWState = resetMSWState;
}
```

### 4. `test/wdio.shared.conf.ts` - Test Integration
```typescript
// Custom commands for tests
browser.addCommand('waitForMSW', async () => {
  await browser.waitUntil(async () => {
    const mswReady = await browser.execute(() => {
      return !!window.__MSW_WORKER__ &&
             !!navigator.serviceWorker?.controller;
    });
    return mswReady;
  });
});

browser.addCommand('resetMSWHandlers', async () => {
  await browser.execute(() => {
    if (window.resetMSWState) {
      window.resetMSWState();
    }
  });
});
```

## How It Works

### In Development (Vite)
1. `src/index.tsx` imports and calls `enableMocking()` from `src/msw.ts`
2. MSW service worker starts and intercepts all API calls
3. Mock data is served from `src/handlers.ts`
4. Changes to handlers are reflected immediately

### In Tests (WDIO)
1. **Same MSW instance** is started when the app loads
2. Tests wait for MSW using `browser.waitForMSW()`
3. Tests can reset handlers using `browser.resetMSWHandlers()`
4. All tests use the **same mock data** from `src/handlers.ts`

## Benefits of Unified Setup

1. **Single Source of Truth**: One set of handlers for ALL environments
2. **Perfect Consistency**: Identical mock data in dev and tests
3. **Easy Maintenance**: Update mocks in one place, affects everything
4. **Stateful Testing**: Can modify mock data during tests (e.g., delete a tag)
5. **Clean State**: Reset capability between tests
6. **No Duplication**: No separate test mocks to maintain

## Usage Examples

### In Development
```bash
# Start dev server with MSW
NODE_ENV=development pnpm run dev

# MSW automatically intercepts API calls
# Check console for: "✅ MSW health check successful"
```

### In Tests
```javascript
describe('My Feature', () => {
  afterEach(async () => {
    // Reset MSW state after each test
    await browser.resetMSWHandlers();
  });

  it('should fetch data from MSW', async () => {
    await BasePage.open('');

    // Verify MSW is providing data
    const apiCheck = await browser.execute(async () => {
      const response = await fetch('http://localhost:9001/api/v1/tags');
      const data = await response.json();
      return { ok: response.ok, count: data.data?.length };
    });

    expect(apiCheck.ok).toBe(true);
    expect(apiCheck.count).toBe(4); // MSW provides 4 tags
  });
});
```

## Adding New Handlers

To add new API mocks, simply update `src/handlers.ts`:

```typescript
// In src/handlers.ts
handlers.push(
  http.get(`${baseUrl}/new-endpoint`, () => {
    console.log('✅ MSW intercepted new endpoint');
    return HttpResponse.json({
      data: 'mock response',
      timestamp: new Date().toISOString()
    });
  })
);
```

**That's it!** The new handler is automatically available in:
- Development server
- All WDIO tests
- Any environment where MSW is initialized

## Current Mock Data

### Tags
- 4 test tags (test-tag-1 through test-tag-4)
- Different dates for sorting tests
- Stateful deletion support

### Entries
- 2 test entries with subjects and bodies
- Support for tagging/untagging
- Stateful deletion support

### Endpoints
- `GET /api/v1/health` - Health check
- `GET /api/v1/tags` - List tags
- `POST /api/v1/tags` - Create tag
- `DELETE /api/v1/tags/:id` - Delete tag
- `GET /api/v1/entries` - List entries
- `POST /api/v1/entries` - Create entry
- `DELETE /api/v1/entries/:id` - Delete entry
- `GET /api/v1/tags/:id/entries` - Get entries by tag
- `DELETE /api/v1/tags_entries/:id` - Untag entry
- `POST /api/v1/tags/reorder` - Reorder tags
- `POST /api/v1/tags_entries/reorder` - Reorder entries
- `POST /api-token-deauth` - Logout

## Troubleshooting

### MSW Not Working?
1. **Check Console**: Look for "✅ MSW health check successful"
2. **Check Network Tab**: Requests should show as "(ServiceWorker)"
3. **Check Environment**: Ensure `NODE_ENV=development` or `NODE_ENV=test`
4. **Check Service Worker**: Go to DevTools > Application > Service Workers

### Tests Failing?
1. **Wait for MSW**: Ensure tests wait for MSW before making requests
2. **Reset State**: Always reset handlers in `afterEach`
3. **Check Timing**: Add pauses after navigation for content to load

### Common Issues
1. **Race Conditions**: Use `browser.waitForMSW()` before tests
2. **Stale Data**: Use `browser.resetMSWHandlers()` between tests
3. **Missing Handlers**: Check `src/handlers.ts` for the endpoint

## Migration from Browser Mocks

We've successfully migrated from WebdriverIO browser mocks to MSW:
- ✅ No more `browser.mock()` calls
- ✅ No more mock response files in `test/mocks/`
- ✅ Single source of truth in `src/handlers.ts`
- ✅ Better reliability and consistency
- ✅ Faster test execution

## Success Metrics

- **8+ test files** successfully migrated to MSW
- **100% consistency** between dev and test environments
- **Zero duplication** of mock data
- **Single file** to update when API changes
