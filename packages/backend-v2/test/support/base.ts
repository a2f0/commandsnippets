/** A port of the Django tests' BaseTestCase. */
import type {User} from '../../src/db/schema';
import {ApiClient, clientFor} from './client';
import {staffFactory, userFactory} from './factories';

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
    user1Client: await clientFor(user1),
    unauthenticatedClient: new ApiClient(),
  };
}

/** v2: a staff account, `staff`, with no data, and its client. */
export async function staffClient(): Promise<{staff: User; client: ApiClient}> {
  const staff = await staffFactory(
    {username: 'staff', email: 'staff@example.com'},
    {examples: false}
  );
  return {staff, client: await clientFor(staff)};
}

// biome-ignore lint/suspicious/noExplicitAny: JSON:API documents in tests.
export type Json = any;

export async function json(response: Response): Promise<Json> {
  return response.json();
}
