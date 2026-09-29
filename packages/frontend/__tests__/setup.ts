import '@testing-library/jest-dom';

import {webcrypto} from 'node:crypto';
import {afterEach, beforeEach, vi} from 'vitest';

Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
});

// jsdom does not implement scrollIntoView, which the tag and entry lists call
// when the selection moves. Specs in the node environment have no Element.
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = vi.fn();
}

// Every jsdom test starts signed out, with no IndexedDB data and the mock
// API's data as __tests__/util/msw.ts has it. (The app's modules read
// `window` when they load, so node-environment specs skip this.)
if (typeof window !== 'undefined') {
  const [{resetApp}, {resetMockApi}] = await Promise.all([
    import('./util/signIn'),
    import('./util/msw'),
  ]);
  beforeEach(() => resetMockApi());
  afterEach(() => resetApp());
}
