import {
  analyticsDocumentSchema,
  backupSchema,
  DATA_VERSION_HEADER,
  EXPECTED_USER_HEADER,
} from '@commandsnippets/api-shared';
import {eq} from 'drizzle-orm';
import {beforeEach, expect, it} from 'vitest';
import {entryReuses, tags, tagsEntries, textEntries} from '../src/db/schema';
import {
  ApiClient,
  clientFor,
  db,
  staffClient,
  tagFactory,
  tagTextEntryFactory,
  textEntryFactory,
  textEntryReusedFactory,
  userFactory,
} from './helpers';

const query =
  '/api/v1/user/analytics?from=2024-01-01&to=2024-02-29&interval=day';
let client: ApiClient;
let entryId: number;
let tagId: number;
let otherTagId: number;

beforeEach(async () => {
  const user = await userFactory({}, {examples: false});
  client = await clientFor(user);
  const entry = await textEntryFactory({user, subject: 'First'});
  entryId = entry.id;
  const tag = await tagFactory({user, name: 'shell'});
  tagId = tag.id;
  const otherTag = await tagFactory({user, name: 'git'});
  otherTagId = otherTag.id;
  for (const value of [tag, otherTag]) {
    const link = await tagTextEntryFactory({
      user,
      tag: value,
      text_entry: entry,
    });
    await db()
      .update(tagsEntries)
      .set({date_created: '2024-02-01T00:00:00.000000'})
      .where(eq(tagsEntries.id, link.id));
    await db()
      .update(tags)
      .set({date_created: '2024-01-07T12:00:00.000000'})
      .where(eq(tags.id, value.id));
  }
  await db()
    .update(textEntries)
    .set({date_created: '2024-01-01T00:00:00.000000'})
    .where(eq(textEntries.id, entry.id));
  const untagged = await textEntryFactory({user, subject: 'Alone'});
  await db()
    .update(textEntries)
    .set({date_created: '2024-02-29T23:59:59.999999'})
    .where(eq(textEntries.id, untagged.id));
  for (const date of [
    '2024-01-31T23:59:59.999999',
    '2024-02-01T00:00:00.000000',
    '2024-03-01T00:00:00.000000',
  ]) {
    const reuse = await textEntryReusedFactory({user, text_entry: entry});
    await db()
      .update(entryReuses)
      .set({date_created: date})
      .where(eq(entryReuses.id, reuse.id));
  }
  const outsider = await userFactory({}, {examples: false});
  const outside = await textEntryFactory({user: outsider});
  await db()
    .update(textEntries)
    .set({date_created: '2024-01-01T00:00:00.000000'})
    .where(eq(textEntries.id, outside.id));
});

function pathWith(suffix: string) {
  const url = new URL(query, 'https://test');
  for (const [key, value] of new URLSearchParams(suffix))
    url.searchParams.set(key, value);
  return url.pathname + url.search;
}

async function read(activity: string, suffix = '') {
  const response = await client.get(pathWith(`activity=${activity}${suffix}`));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  const body = await response.json();
  expect(analyticsDocumentSchema.parse(body)).toEqual(body);
  return analyticsDocumentSchema.parse(body).data;
}

it('counts entry creations once across current tags and includes untagged entries and both endpoints', async () => {
  const data = await read('created');
  expect(data).toMatchObject({
    total: 2,
    entries: 2,
    tags: 2,
    timeline: [
      {date: '2024-01-01', count: 1},
      {date: '2024-02-29', count: 1},
    ],
  });
  expect(data.top_tags.map(row => row.count)).toEqual([1, 1]);
  expect((await read('created', `&tag=${tagId}`)).total).toBe(1);
  expect(
    (await read('created', `&tag=${tagId}`)).top_tags.map(row => row.count)
  ).toEqual([1, 1]);
});

it.each(['created', 'tags_created', 'tagged', 'reused'])(
  'includes history older than ten years for %s and resolves concrete bounds',
  async activity => {
    for (const table of [textEntries, tags, tagsEntries, entryReuses]) {
      await db()
        .update(table)
        .set({date_created: '2001-02-03T12:00:00.000000'});
    }
    expect((await read(activity)).total).toBe(0);
    const data = await read(activity, `&from=all&interval=month&tag=${tagId}`);
    const total = activity === 'reused' ? 3 : 1;
    expect(data).toMatchObject({
      from: '2001-02-03',
      to: '2024-02-29',
      total,
      timeline: [{date: '2001-02-01', count: total}],
    });
    expect(await read(activity, '&from=all&tag=99999999')).toMatchObject({
      from: '2024-02-29',
      to: '2024-02-29',
      total: 0,
      timeline: [],
    });
    expect(await read(activity, '&from=all&to=2001-02-02')).toMatchObject({
      from: '2001-02-02',
      total: 0,
    });
  }
);

it('slices tag creation separately, including empty tags, and groups Monday weeks', async () => {
  const data = await read('tags_created', '&interval=week');
  expect(data).toMatchObject({
    total: 2,
    entries: 0,
    tags: 2,
    timeline: [{date: '2024-01-01', count: 2}],
    top_entries: [],
  });
  expect((await read('tags_created', `&tag=${tagId}`)).total).toBe(1);
  await db()
    .update(tagsEntries)
    .set({is_deleted: true})
    .where(eq(tagsEntries.tag_id, tagId));
  expect((await read('tags_created')).total).toBe(2);
});

it('counts tag assignments on their own date, attributes each to its assigned tag, and excludes removed assignments', async () => {
  expect(await read('tagged')).toMatchObject({
    total: 2,
    entries: 1,
    tags: 2,
    timeline: [{date: '2024-02-01', count: 2}],
  });
  expect((await read('tagged', `&tag=${tagId}`)).top_tags).toEqual([
    {id: String(tagId), name: 'shell', count: 1},
  ]);
  await db()
    .update(tagsEntries)
    .set({is_deleted: true})
    .where(eq(tagsEntries.tag_id, tagId));
  expect((await read('tagged')).total).toBe(1);
});

it('counts actual reuse events by date, filters tags without multiplying totals, and groups months', async () => {
  expect(await read('reused', '&interval=month')).toMatchObject({
    total: 2,
    entries: 1,
    tags: 2,
    timeline: [
      {date: '2024-01-01', count: 1},
      {date: '2024-02-01', count: 1},
    ],
    top_entries: [{id: String(entryId), name: 'First', count: 2}],
  });
  expect((await read('reused', `&tag=${tagId}`)).total).toBe(2);
  expect(
    (await read('reused', `&tag=${tagId}`)).top_tags.map(row => row.count)
  ).toEqual([2, 2]);
  expect((await read('reused', '&tag=99999999')).total).toBe(0);
});

it.each(['', '&from=all'])(
  'excludes deleted tags and entries from every chart (%s)',
  async range => {
    await db()
      .update(tags)
      .set({is_deleted: true})
      .where(eq(tags.id, otherTagId));
    expect((await read('created', range)).tags).toBe(1);
    expect((await read('tags_created', range)).total).toBe(1);
    await db()
      .update(textEntries)
      .set({is_deleted: true})
      .where(eq(textEntries.id, entryId));
    expect((await read('created', range)).total).toBe(1);
    expect((await read('tagged', range)).total).toBe(0);
    expect((await read('reused', range)).total).toBe(0);
  }
);

it.each(['2024-01-01', 'all'])(
  'refuses anonymous reads and stale account/version headers; staff see only their own data (%s)',
  async from => {
    const path = pathWith(`activity=created&from=${from}`);
    expect((await new ApiClient().get(path)).status).toBe(403);
    expect(
      (await client.get(path, {[EXPECTED_USER_HEADER]: 'someone-else'})).status
    ).toBe(409);
    expect((await client.get(path, {[DATA_VERSION_HEADER]: '2'})).status).toBe(
      409
    );
    const staff = await staffClient();
    expect(
      analyticsDocumentSchema.parse(await (await staff.client.get(path)).json())
        .data.total
    ).toBe(0);
  }
);

it.each([
  'activity=unknown',
  'activity=reused&from=2024-02-30',
  'activity=created&to=2023-01-01',
  'activity=created&to=2040-01-01',
  'activity=created&tag=0',
  'activity=created&interval=year',
  'activity=created&user=2',
])('validates query: %s', async suffix => {
  expect((await client.get(pathWith(suffix))).status).toBe(400);
});

it.each(['', '&from=all'])(
  'reads only the active data version after restoring, without combining histories (%s)',
  async range => {
    const backup = backupSchema.parse(
      await (await client.get('/api/v1/user/backup')).json()
    );
    backup.entry_reuses = [];
    const restored = await client.post('/api/v1/user/restore', backup);
    expect(restored.status).toBe(200);
    expect(await read('reused', range)).toMatchObject({version: 2, total: 0});
    expect(await read('created', range)).toMatchObject({version: 2, total: 2});
    expect(
      (
        await client.get(pathWith(`activity=created${range}`), {
          [DATA_VERSION_HEADER]: '1',
        })
      ).status
    ).toBe(409);
  }
);

it('refuses repeated parameters with a query-level error', async () => {
  const response = await client.get(
    `${query}&activity=created&activity=reused`
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    errors: [{source: {pointer: '/data'}}],
  });
});

it('returns the top ten rankings in descending event order with stable ties', async () => {
  const user = await userFactory({}, {examples: false});
  client = await clientFor(user);
  for (let index = 0; index < 12; index += 1) {
    const name = `rank-${String(index).padStart(2, '0')}`;
    const entry = await textEntryFactory({user, subject: name});
    const tag = await tagFactory({user, name});
    await tagTextEntryFactory({user, tag, text_entry: entry});
    for (let count = 0; count < Math.floor(index / 2) + 1; count += 1) {
      const reuse = await textEntryReusedFactory({user, text_entry: entry});
      await db()
        .update(entryReuses)
        .set({date_created: '2024-01-01T00:00:00.000000'})
        .where(eq(entryReuses.id, reuse.id));
    }
  }
  const data = await read('reused');
  const expected = [10, 11, 8, 9, 6, 7, 4, 5, 2, 3].map(index => ({
    name: `rank-${String(index).padStart(2, '0')}`,
    count: Math.floor(index / 2) + 1,
  }));
  expect(data.total).toBe(42);
  for (const rows of [data.top_entries, data.top_tags])
    expect(rows.map(({name, count}) => ({name, count}))).toEqual(expected);
});

it('breaks identical entry names and counts by numeric id before and after the top-ten limit', async () => {
  const user = await userFactory({}, {examples: false});
  client = await clientFor(user);
  const ids: string[] = [];
  for (let index = 0; index < 12; index += 1) {
    const entry = await textEntryFactory({user, subject: 'same name'});
    ids.push(String(entry.id));
    const reuse = await textEntryReusedFactory({user, text_entry: entry});
    await db()
      .update(entryReuses)
      .set({date_created: '2024-01-01T00:00:00.000000'})
      .where(eq(entryReuses.id, reuse.id));
  }
  expect((await read('reused')).top_entries.map(row => row.id)).toEqual(
    ids.slice(0, 10)
  );
});
