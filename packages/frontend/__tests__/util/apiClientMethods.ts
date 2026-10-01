import {apiClient} from '../../src/lib/api/apiClient';

/**
 * The API client's methods, shared by every client: the app's (`apiClient`)
 * and those whose writes name one user (`apiClient.writesAs`, the queue's).
 * Spy on these to see a call whichever client makes it.
 */
export const apiClientMethods: typeof apiClient =
  Object.getPrototypeOf(apiClient);
