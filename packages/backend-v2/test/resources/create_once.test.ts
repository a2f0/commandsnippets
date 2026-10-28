/**
 * Creates made once per `client_id` (resources/viewset.ts's `createOnce`):
 * a retry whose insert loses the race with its earlier attempt (whose answer
 * was lost) is answered with the row that attempt made, as it was.
 */
import {and, eq} from 'drizzle-orm';
import {beforeEach, describe, expect, it} from 'vitest';
import {entryReuses, textEntries, type User} from '../../src/db/schema';
import {
  ApiClient,
  db,
  json,
  refreshEntry,
  setUpBase,
  textEntryFactory,
  tokenFor,
} from '../helpers';
import {raceBeforeInsert} from '../support/races';

let user: User;
let client: ApiClient;

beforeEach(async () => {
  ({user1: user, user1Client: client} = await setUpBase());
});

const entryCreate = (clientId: string, subject: string) => ({
  data: {
    type: 'TextEntry',
    attributes: {subject, body: 'body', client_id: clientId},
  },
});

const reuseCreate = (entryId: number, clientId: string) => ({
  data: {
    type: 'TextEntryReused',
    attributes: {client_id: clientId},
    relationships: {
      text_entry: {data: {type: 'TextEntry', id: String(entryId)}},
    },
  },
});

describe('a create retried as its first attempt is made', () => {
  it('answers with the entry the first attempt made', async () => {
    let firstId: string | undefined;
    // Just before this attempt inserts, the first one makes the entry.
    const racing = new ApiClient(
      await tokenFor(user.id),
      raceBeforeInsert('text_entries_textentry', async () => {
        const first = await client.post(
          '/api/v1/entries',
          entryCreate('local-raced', 'first')
        );
        firstId = (await json(first)).data.id;
      })
    );
    const response = await racing.post(
      '/api/v1/entries',
      entryCreate('local-raced', 'retry')
    );
    expect(response.status).toBe(201);
    const {data} = await json(response);
    expect(firstId).toBeDefined();
    expect(data.id).toBe(firstId);
    expect(data.attributes.subject).toBe('first');
    expect(
      await db()
        .select({id: textEntries.id})
        .from(textEntries)
        .where(
          and(
            eq(textEntries.user_id, user.id),
            eq(textEntries.client_id, 'local-raced')
          )
        )
    ).toEqual([{id: Number(firstId)}]);
  });

  it('answers with the reuse the first attempt counted', async () => {
    const entry = await textEntryFactory({user});
    let firstId: string | undefined;
    const racing = new ApiClient(
      await tokenFor(user.id),
      raceBeforeInsert('text_entries_textentryreused', async () => {
        const first = await client.post(
          '/api/v1/entry_reuses',
          reuseCreate(entry.id, 'reuse-raced')
        );
        firstId = (await json(first)).data.id;
      })
    );
    const response = await racing.post(
      '/api/v1/entry_reuses',
      reuseCreate(entry.id, 'reuse-raced')
    );
    expect(response.status).toBe(201);
    expect(firstId).toBeDefined();
    expect((await json(response)).data.id).toBe(firstId);
    expect(
      await db()
        .select({id: entryReuses.id})
        .from(entryReuses)
        .where(eq(entryReuses.client_id, 'reuse-raced'))
    ).toEqual([{id: Number(firstId)}]);
    expect((await refreshEntry(entry.id))?.reused_count).toBe(1);
  });
});
