// Global type declarations for MSW worker and utilities
// Used by both the application (src/) and tests (test/)

import type {SetupWorker} from 'msw/browser';
import type {HttpMethod} from '../src/msw/requestCounter';

declare global {
  interface Window {
    // Electron API exposed via preload script
    electron?: {
      process?: {
        platform?: string;
        versions?: {
          electron?: string;
          [key: string]: string | undefined;
        };
      };
    };

    // Custom API exposed via preload script
    api?: {
      onProtocolUrl?: (callback: (url: string) => void) => () => void;
    };

    // MSW worker instance - available in dev/test environments
    __MSW_WORKER__?: SetupWorker;

    // Reset function to restore original mock state
    resetMSWState?: () => void;

    // Runtime entries override function for tests
    setRuntimeEntriesOverride?: (
      override:
        | import('../src/lib/api/responses/types').ITextEntryJsonApiResponse
        | null
    ) => void;

    // Request counting utilities
    __MSW_REQUESTS__?: {
      getCount: (method: HttpMethod, url: string) => number;
      getAll: () => Array<{method: HttpMethod; url: string; count: number}>;
      reset: () => void;
    };

    // MSW utilities for testing
    msw?: {
      http: typeof import('msw').http;
      HttpResponse: typeof import('msw').HttpResponse;
    };

    // Test debugging
    lastApiResponse?: unknown;
  }
}
