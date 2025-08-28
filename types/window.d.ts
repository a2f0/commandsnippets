// Global type declarations for MSW worker and utilities
// Used by both the application (src/) and tests (test/)

import type {SetupWorker} from 'msw/browser';
import type {HttpMethod} from '../src/msw/requestCounter';

declare global {
  interface Window {
    // MSW worker instance - available in dev/test environments
    __MSW_WORKER__?: SetupWorker;

    // Reset function to restore original mock state
    resetMSWState?: () => void;

    // Request counting utilities
    __MSW_REQUESTS__?: {
      getCount: (method: HttpMethod, url: string) => number;
      getAll: () => Array<{method: HttpMethod; url: string; count: number}>;
      reset: () => void;
    };

    // MSW utilities for testing
    msw?: {
      http: {
        get: (
          url: string,
          handler: (params: {
            params: Record<string, string | string[]>;
          }) => unknown
        ) => unknown;
      };
      HttpResponse: {
        json: (data: unknown, options?: {status: number}) => unknown;
      };
    };
  }
}
