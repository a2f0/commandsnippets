// Browser-specific MSW utilities for exposing worker and utilities globally

import {worker} from './worker';
import {resetMSWState} from './handlers';

/**
 * Exposes MSW worker and utilities to the global window object
 * This allows tests to access MSW functionality
 */
export function exposeMSWToGlobal(): void {
  // Store worker reference globally for tests to access
  window.__MSW_WORKER__ = worker;
  
  // Expose reset function for tests
  window.resetMSWState = resetMSWState;
}