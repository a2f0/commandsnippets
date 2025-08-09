// Global type declarations for MSW worker and utilities
// Used by both the application (src/) and tests (test/)

import type {SetupWorker} from 'msw/browser';

declare global {
  interface Window {
    // MSW worker instance - available in dev/test environments
    __MSW_WORKER__?: SetupWorker;

    // Reset function to restore original mock state
    resetMSWState?: () => void;
  }
}
