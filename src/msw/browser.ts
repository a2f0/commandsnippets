// Browser-specific MSW utilities for exposing worker and utilities globally

import {resetMSWState} from './handlers';
import {
  getAllRequestCounts,
  getRequestCount,
  resetRequestCounts,
} from './requestCounter';
import {worker} from './worker';

/**
 * Exposes MSW worker and utilities to the global window object
 * This allows tests to access MSW functionality
 */
export function exposeMSWToGlobal(): void {
  // Store worker reference globally for tests to access
  window.__MSW_WORKER__ = worker;

  // Expose reset function for tests
  window.resetMSWState = resetMSWState;

  // Attach request counting helpers under a namespaced global for clarity
  window.__MSW_REQUESTS__ = {
    getCount: getRequestCount,
    getAll: getAllRequestCounts,
    reset: resetRequestCounts,
  };
}
