// MSW setup for development and test environments
// This file provides a simple async function to enable MSW mocking
// The actual MSW worker and handlers are defined in:
// - src/mswWorker.ts (worker setup)
// - src/handlers.ts (API mock handlers)
// - src/index.tsx (initialization for both dev and test)

async function enableMocking() {
  if (
    process.env['NODE_ENV'] !== 'development' &&
    process.env['NODE_ENV'] !== 'test'
  ) {
    return;
  }

  const {worker} = await import('./mswWorker');

  // Start the MSW worker
  const registration = await worker.start({
    serviceWorker: {
      url: '/mockServiceWorker.js',
    },
    onUnhandledRequest: 'bypass', // Don't warn about unhandled requests
  });

  // Store worker reference globally for tests to access
  window.__MSW_WORKER__ = worker;

  // Expose reset function for tests
  const {resetMSWState} = await import('./handlers');
  window.resetMSWState = resetMSWState;

  // Verify MSW is working by testing the health endpoint
  try {
    const testResponse = await fetch('http://localhost:9001/api/v1/health');
    const data = await testResponse.json();
    console.log('✅ MSW health check successful:', data);
  } catch (error) {
    console.error('❌ MSW health check failed:', error);
  }

  return registration;
}

export {enableMocking};
