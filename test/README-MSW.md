# MSW (Mock Service Worker) for Browser Tests

This project uses MSW to mock API responses in browser-based tests (WebdriverIO). This allows you to control network requests and responses from your tests without needing a real backend.

## Setup

The MSW setup consists of:

1. **`public/mockServiceWorker.js`** - The MSW worker file that runs in the browser
2. **`public/handlers.js`** - Default API handlers that provide mock responses
3. **`test/util/mswBrowser.ts`** - Utility class for controlling MSW from tests
4. **`src/index.tsx`** - Modified to start MSW in development/test mode

## How to Use

### Basic Usage

MSW is automatically started in development and test environments. The default handlers provide mock responses for:

- `GET /api/v1/tags` - Returns mock tag data
- `GET /api/v1/entries` - Returns mock entry data
- `POST /api/v1/tags_entries/reorder` - Returns success response
- `POST /api/v1/tags/reorder` - Returns success response
- `POST /api-token-deauth` - Returns success response

### Controlling MSW from Tests

The `browser.msw` object provides several methods for controlling MSW:

```typescript
describe('My Test', () => {
  beforeEach(async () => {
    // Start MSW worker
    await browser.msw.startWorker();
  });

  afterEach(async () => {
    // Reset handlers to defaults
    await browser.msw.resetHandlers();
  });

  it('should handle custom responses', async () => {
    // Mock a specific API response
    await browser.msw.mockApiResponse(
      'GET',
      'http://localhost:9001/api/v1/tags',
      {
        data: [
          {
            type: 'Tag',
            id: 'custom-tag',
            attributes: {
              name: 'Custom Tag',
              order: 1,
            },
          },
        ],
      }
    );

    // Your test code here...
  });

  it('should handle network errors', async () => {
    // Mock a network error
    await browser.msw.mockNetworkError('http://localhost:9001/api/v1/tags');

    // Your test code here...
  });

  it('should handle different status codes', async () => {
    // Mock a 404 response
    await browser.msw.mockApiResponse(
      'GET',
      'http://localhost:9001/api/v1/nonexistent',
      { error: 'Not found' },
      404
    );

    // Your test code here...
  });
});
```

### Available Methods

- `startWorker()` - Start the MSW worker in the browser
- `stopWorker()` - Stop the MSW worker
- `resetHandlers()` - Reset all handlers to defaults
- `mockApiResponse(method, endpoint, response, status)` - Mock a specific API response
- `mockNetworkError(endpoint)` - Mock a network error for an endpoint
- `addHandler(method, url, response)` - Add a custom handler

### Example Test

See `test/specs/msw-example.spec.ts` for a complete example of how to use MSW in your tests.

## Configuration

The MSW setup supports multiple API base URLs:

- `http://localhost:9001/api/v1`
- `https://api.staging.tearleads.com/api/v1`
- `https://api.tearleads.com/api/v1`

All endpoints are mocked for each base URL automatically.

## Troubleshooting

1. **MSW not starting**: Make sure you're running in development or test mode
2. **Handlers not working**: Check that the endpoint URL matches exactly
3. **Network errors**: Use `browser.currentTestErrors` to check for errors
4. **TypeScript errors**: The MSW files use `any` types to avoid import issues

## Adding New Handlers

To add new API endpoints, modify `public/handlers.js` and add new handlers following the same pattern as the existing ones.
