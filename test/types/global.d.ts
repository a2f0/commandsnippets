// Type declarations for MSW worker reference attached to window during tests

import type {SetupWorker} from 'msw/browser';

declare global {
  interface Window {
    __MSW_WORKER__?: SetupWorker;
    resetMSWState?: typeof import('../../src/handlers').resetMSWState;
  }
}
