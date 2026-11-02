import {vi} from 'vitest';
import * as environmentModule from '../../src/lib/environment';

/**
 * The app reads its environment (`src/lib/environment.ts`) as `name` until
 * the test ends (`restoreMocks`). Only reads at call time see it: values
 * modules derived from it when they loaded (storage keys, the login cookie
 * names `useCookieLogout` watches) keep the test environment's.
 */
export function stubEnvironment(name: string): void {
  vi.spyOn(environmentModule, 'environment', 'get').mockReturnValue(name);
}
