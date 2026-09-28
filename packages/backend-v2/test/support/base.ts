/** A port of the Django tests' BaseTestCase. */
import type {User} from '../../src/db/schema';
import {ApiClient} from './client';
import {tokenFor} from './db';
import {userFactory} from './factories';

export interface Base {
  user1: User;
  user2: User;
  user1Client: ApiClient;
  unauthenticatedClient: ApiClient;
}

export async function setUpBase(): Promise<Base> {
  const user1 = await userFactory();
  const user2 = await userFactory();
  return {
    user1,
    user2,
    user1Client: new ApiClient(await tokenFor(user1.id)),
    unauthenticatedClient: new ApiClient(),
  };
}

// biome-ignore lint/suspicious/noExplicitAny: JSON:API documents in tests.
export type Json = any;

export async function json(response: Response): Promise<Json> {
  return response.json();
}
