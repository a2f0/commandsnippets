// Types for the jest-dom matchers under Vitest 5.
//
// Vitest 5 no longer reads matcher types from the global `jest.Matchers`
// interface that `import '@testing-library/jest-dom'` augments, and jest-dom's
// own `/vitest` entry augments the old one-parameter `Assertion<T>`, which no
// longer merges with Vitest 5's `Assertion<R, T>`. The matchers still register
// at runtime; only their types are lost. This augments Vitest's documented
// extension point, `Matchers<R, T>`, instead. Remove it once jest-dom ships
// Vitest 5 types (testing-library/jest-dom#738).
// https://vitest.dev/guide/migration
// https://vitest.dev/guide/extending-matchers
import 'vitest';
import type {TestingLibraryMatchers} from '@testing-library/jest-dom/matchers';

// The first parameter types the asymmetric matchers (`expect.stringContaining`
// and friends) that a few jest-dom matchers accept; Vitest returns them
// untyped.
declare module 'vitest' {
  interface Matchers<R, T> extends TestingLibraryMatchers<unknown, R> {}
  interface AsymmetricMatchersContaining
    extends TestingLibraryMatchers<unknown, unknown> {}
}
