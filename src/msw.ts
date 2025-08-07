// MSW setup for development and test
async function enableMocking() {
  if (
    process.env['NODE_ENV'] !== 'development' &&
    process.env['NODE_ENV'] !== 'test'
  ) {
    return;
  }

  const {setupWorker} = await import('msw/browser');
  const {handlers} = await import('./handlers');

  // Create and start the worker
  const worker = setupWorker(...handlers);

  return worker.start({
    onUnhandledRequest: 'bypass', // Don't warn about unhandled requests
  });
}

export {enableMocking};
