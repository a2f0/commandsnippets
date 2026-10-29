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
  const [{configure}, {resetApp}, {resetMockApi}] = await Promise.all([
    import('@testing-library/react'),
    import('./util/signIn'),
    import('./util/msw'),
  ]);
  // How long `findBy*` and `waitFor` wait: the app's first load (the sync of
  // the tags, entries and junctions into IndexedDB) can take longer than
  // Testing Library's default second while other suites run. Below Vitest's
  // 5 second test timeout, so a wait in vain fails with what it waited for.
  configure({asyncUtilTimeout: 3000});
  beforeEach(() => resetMockApi());
  afterEach(() => resetApp());
}
