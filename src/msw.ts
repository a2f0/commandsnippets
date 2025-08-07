// MSW setup for development and test
async function enableMocking() {
  if (
    process.env['NODE_ENV'] !== 'development' &&
    process.env['NODE_ENV'] !== 'test'
  ) {
    return;
  }

  const {worker} = await import('./mswWorker');

  // Verify that MSW is intercepting the entries endpoint
  try {
    const testResponse = await fetch('http://localhost:9001/api/v1/entries', {
      method: 'GET',
    });

    if (testResponse.ok) {
      console.log('✅ MSW successfully intercepting entries endpoint');
    } else {
      console.warn(
        '⚠️ MSW entries endpoint returned non-200 status:',
        testResponse.status
      );
    }
  } catch (error) {
    console.error(
      '❌ Failed to verify MSW entries endpoint interception:',
      error
    );
  }

  return worker.start({
    onUnhandledRequest: 'bypass', // Don't warn about unhandled requests
  });
}

export {enableMocking};
