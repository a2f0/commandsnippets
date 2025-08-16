// Main MSW initialization function

import {exposeMSWToGlobal} from './browser';
import {MSW_CONFIG} from './config';
import {healthCheck} from './healthCheck';
import {worker} from './worker';

/**
 * Enables MSW mocking for development and test environments
 *
 * This function:
 * 1. Checks if we're in a dev/test environment
 * 2. Starts the MSW service worker
 * 3. Exposes MSW utilities globally for tests
 * 4. Performs a health check to verify everything is working
 *
 * @returns Promise<ServiceWorkerRegistration | undefined>
 */
export async function enableMocking() {
  // Only run in development or test environments
  if (!MSW_CONFIG.isEnabled()) {
    return;
  }

  // Start the MSW worker with configuration
  const registration = await worker.start({
    serviceWorker: MSW_CONFIG.serviceWorker,
    onUnhandledRequest: MSW_CONFIG.onUnhandledRequest,
  });

  // Expose MSW utilities globally for tests
  exposeMSWToGlobal();

  // Verify MSW is working with a health check
  try {
    await healthCheck();
  } catch (_error) {
    // Health check failure is logged but doesn't stop initialization
    // This allows the app to continue working even if health check fails
  }

  return registration;
}
