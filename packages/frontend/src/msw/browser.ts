// Browser-specific MSW utilities for exposing worker and utilities globally

import {textEntryListDocumentSchema} from '@commandsnippets/api-shared';
import {resetMSWState, setRuntimeEntriesOverride} from './handlers';
import {
  getAllRequestCounts,
  getRequestCount,
  resetRequestCounts,
} from './requestCounter';
import {worker} from './worker';

/**
 * Where a test's runtime entries override is kept for the tab, so it holds
 * across page loads: a test sets it, then loads the page signed in, whose
 * first sync reads it.
 */
const ENTRIES_OVERRIDE_KEY = 'msw-entries-override';

/** The override a test set before this page loaded, if one did. */
function savedEntriesOverride() {
  const saved = sessionStorage.getItem(ENTRIES_OVERRIDE_KEY);
  return saved === null
    ? null
    : textEntryListDocumentSchema.parse(JSON.parse(saved));
}

/**
 * Exposes MSW worker and utilities to the global window object
 * This allows tests to access MSW functionality
 */
export function exposeMSWToGlobal(): void {
  // Store worker reference globally for tests to access
  window.__MSW_WORKER__ = worker;

  // Expose reset function and runtime override for tests
  window.resetMSWState = () => {
    sessionStorage.removeItem(ENTRIES_OVERRIDE_KEY);
    resetMSWState();
  };
  window.setRuntimeEntriesOverride = override => {
    if (override === null) {
      sessionStorage.removeItem(ENTRIES_OVERRIDE_KEY);
    } else {
      sessionStorage.setItem(ENTRIES_OVERRIDE_KEY, JSON.stringify(override));
    }
    setRuntimeEntriesOverride(override);
  };
  const saved = savedEntriesOverride();
  if (saved !== null) {
    setRuntimeEntriesOverride(saved);
  }

  // Attach request counting helpers under a namespaced global for clarity
  window.__MSW_REQUESTS__ = {
    getCount: getRequestCount,
    getAll: getAllRequestCounts,
    reset: resetRequestCounts,
  };
}
