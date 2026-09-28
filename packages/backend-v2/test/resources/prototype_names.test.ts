/**
 * Object.prototype's names (`constructor`, `toString`, ...) are no one's
 * filter, sort field or relationship: they get the 400 any unknown name gets
 * (they used to reach the lookups, and 500 or quietly misbehave).
 */
import {eq} from 'drizzle-orm';
import {beforeEach, describe, expect, it} from 'vitest';
import {users} from '../../src/db/schema';
import {
  type ApiClient,
  type Base,
  db,
  entriesOf,
  json,
  setUpBase,
  tagsOf,
  textEntryReusedFactory,
} from '../helpers';

const NAMES = [
  'constructor',
  'toString',
  'hasOwnProperty',
  '__proto__',
  'valueOf',
  'isPrototypeOf',
];

/**
 * `path(name)` answers exactly as `path('nope')`, an unknown name: the same
 * 400 and body, with the name in place of `nope`.
 */
async function expectUnknown(
  request: (name: string) => Promise<Response>,
  name: string
) {
  const unknown = await request('nope');
  const prototype = await request(name);
  expect(unknown.status).toBe(400);
  expect(prototype.status, name).toBe(400);
  const expected = JSON.stringify(await json(unknown)).replaceAll('nope', name);
  expect(await prototype.text(), name).toBe(expected);
}

let base: Base;
let client: ApiClient;

beforeEach(async () => {
  base = await setUpBase();
  client = base.user1Client;
  // The admin API needs staff.
  await db()
    .update(users)
    .set({is_staff: true})
    .where(eq(users.id, base.user1.id));
  const [entry] = await entriesOf(base.user1);
  await textEntryReusedFactory({user: base.user1, text_entry: entry as never});
});

const COLLECTIONS: Array<[string, string | null]> = [
  // [path, a relationship to nest an include under]
  ['/api/v1/tags', 'user'],
  ['/api/v1/entries', 'text_entry_to_tag'],
  ['/api/v1/entry_reuses', 'text_entry'],
  ['/api/v1/admin/users', null],
  ['/api/v1/admin/audit_log', null],
];

describe.each(COLLECTIONS)('%s', (path, relationship) => {
  it.each(NAMES)('refuses %s as a sort field', async name => {
    await expectUnknown(n => client.get(`${path}?sort=${n}`), name);
    await expectUnknown(n => client.get(`${path}?sort=-${n}`), name);
  });

  it.each(NAMES)('refuses %s as a filter', async name => {
    await expectUnknown(n => client.get(`${path}?filter[${n}]=x`), name);
  });

  it.each(NAMES)('refuses %s as an include path', async name => {
    await expectUnknown(n => client.get(`${path}?include=${n}`), name);
    if (relationship !== null) {
      await expectUnknown(
        n => client.get(`${path}?include=${relationship}.${n}`),
        name
      );
    }
  });
});

describe('single resources', () => {
  it.each(NAMES)('refuse %s as an include path', async name => {
    const [tag] = await tagsOf(base.user1);
    const [entry] = await entriesOf(base.user1);
    const reuses = await json(await client.get('/api/v1/entry_reuses'));
    for (const path of [
      '/api/v1/user',
      `/api/v1/tags/${tag?.id}`,
      `/api/v1/entries/${entry?.id}`,
      `/api/v1/entry_reuses/${reuses.data[0].id}`,
    ]) {
      await expectUnknown(n => client.get(`${path}?include=${n}`), name);
    }
    await expectUnknown(
      n => client.get(`/api/v1/entries/${entry?.id}?include=user.${n}`),
      name
    );
  });

  it.each(NAMES)(
    'refuse %s as an include path on a created junction',
    async name => {
      const [tag] = await tagsOf(base.user1);
      const [, entry] = await entriesOf(base.user1);
      const document = {
        data: {
          type: 'TagTextEntryThroughModel',
          relationships: {
            tag: {data: {type: 'Tag', id: String(tag?.id)}},
            text_entry: {data: {type: 'TextEntry', id: String(entry?.id)}},
          },
        },
      };
      await expectUnknown(
        n => client.post(`/api/v1/tags_entries?include=${n}`, document),
        name
      );
    }
  );
});
