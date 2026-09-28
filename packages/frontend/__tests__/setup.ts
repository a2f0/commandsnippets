import '@testing-library/jest-dom';

import {webcrypto} from 'node:crypto';
import {vi} from 'vitest';

Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
});

// jsdom does not implement scrollIntoView, which the tag and entry lists call
// when the selection moves. Specs in the node environment have no Element.
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = vi.fn();
}
