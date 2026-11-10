/** Reuse event times and retries match the API, not the upload order. */
import {
  CLIENT_UPDATED_HEADER,
  CODES,
  DATA_VERSION_HEADER,
  type TextEntryReusedCreateDocument,
  textEntryDocumentSchema,
  textEntryReusedDocumentSchema,
  textEntryReusedListDocumentSchema,
} from '@commandsnippets/api-shared';
import {beforeEach, expect, it, vi} from 'vitest';

import {setRuntimeEntriesOverride} from '../../../src/msw/handlers';
import {JSON_API} from '../../util/documents';
import {API, serveMockApi} from '../../util/msw';

serveMockApi();
const UPLOADED_AT = '2026-11-10T12:00:00.123Z';
const headers = {...JSON_API, [DATA_VERSION_HEADER]: '1'};

beforeEach(() => {
  setRuntimeEntriesOverride(null);
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse(UPLOADED_AT));
});

const recordReuse = (
  at?: string,
  clientId: string | null = 'offline-copy',
  entryId = '1'
) =>
  fetch(`${API}/entry_reuses?include=text_entry`, {
    method: 'POST',
    headers: {
      ...headers,
      ...(at === undefined ? {} : {[CLIENT_UPDATED_HEADER]: at}),
    },
    body: JSON.stringify({
      data: {
        type: 'TextEntryReused',
        attributes: clientId === null ? {} : {client_id: clientId},
        relationships: {text_entry: {data: {type: 'TextEntry', id: entryId}}},
      },
    } satisfies TextEntryReusedCreateDocument),
  });

const getEntry = async (id = '1') => {
  const response = await fetch(`${API}/entries/${id}`);
  expect(response.status).toBe(200);
  return textEntryDocumentSchema.parse(await response.json()).data;
};

const listReuses = async (query = '') => {
  const response = await fetch(`${API}/entry_reuses${query}`);
  expect(response.status).toBe(200);
  return textEntryReusedListDocumentSchema.parse(await response.json());
};

it.each([
  ['2024-03-01T12:34:56.123456+02:00', '2024-03-01T10:34:56.123456'],
  ['2024-03-01T10:34:56Z', '2024-03-01T10:34:56'],
])(
  'records the original copy time %s before the entry was uploaded',
  async (at, expected) => {
    const created = await fetch(`${API}/entries`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: {
          type: 'TextEntry',
          attributes: {subject: 'offline entry', body: 'copied before upload'},
        },
      }),
    });
    expect(created.status).toBe(201);
    const entry = textEntryDocumentSchema.parse(await created.json()).data;
    const response = await recordReuse(at, 'offline-copy', entry.id);
    expect(response.status).toBe(201);
    const {data} = textEntryReusedDocumentSchema.parse(await response.json());
    expect(data.attributes.date_created).toBe(expected);
    expect(data.attributes.date_created < entry.attributes.date_created).toBe(
      true
    );
    expect((await getEntry(entry.id)).attributes).toEqual({
      ...entry.attributes,
      reused_count: 1,
    });
  }
);

it('clamps a future copy time to the upload clock', async () => {
  const response = await recordReuse('2099-01-01T00:00:00.123456Z');
  expect(response.status).toBe(201);
  const {data} = textEntryReusedDocumentSchema.parse(await response.json());
  expect(data.attributes.date_created).toBe('2026-11-10T12:00:00.123000');
});

it.each([
  '',
  'not-a-datetime',
  '0000-01-01T00:00:00+01:00',
  '0001-01-01T00:00:00+01:00',
  '9999-12-31T23:00:00-01:00',
])('rejects malformed copy time %j without a reuse', async at => {
  const before = await getEntry();
  const response = await recordReuse(at);
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    errors: [
      {
        status: '400',
        code: CODES.invalid,
        detail: `${CLIENT_UPDATED_HEADER} is not a datetime.`,
        source: {pointer: '/data'},
      },
    ],
  });
  expect(await getEntry()).toEqual(before);
  const listed = await listReuses();
  expect(listed.data).toEqual([]);
  expect(listed.meta.pagination.count).toBe(0);
});

it.each([
  ['2024-03-01T12:34:56.123456Z', '2024-03-01T12:34:56.123456'],
  ['2099-01-01T00:00:00Z', '2026-11-10T12:00:00.123000'],
])(
  'preserves the first copy time and count when retrying %s',
  async (at, expected) => {
    const before = await getEntry();
    const first = await recordReuse(at);
    expect(first.status).toBe(201);
    const recorded = textEntryReusedDocumentSchema.parse(await first.json());
    expect(recorded.data.attributes.date_created).toBe(expected);

    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-11T12:00:00Z'));
    const second = await recordReuse('2026-11-11T10:00:00Z');
    expect(second.status).toBe(201);
    expect(textEntryReusedDocumentSchema.parse(await second.json())).toEqual(
      recorded
    );
    expect((await getEntry()).attributes).toEqual({
      ...before.attributes,
      reused_count: before.attributes.reused_count + 1,
    });
    const listed = await listReuses();
    expect(listed.data).toEqual([recorded.data]);
    expect(listed.meta.pagination.count).toBe(1);
  }
);

it('rejects a malformed retry even when its client id was recorded', async () => {
  const first = await recordReuse('2024-03-01T12:34:56Z');
  expect(first.status).toBe(201);
  const {data} = textEntryReusedDocumentSchema.parse(await first.json());
  const entry = await getEntry();
  expect((await recordReuse('not-a-datetime')).status).toBe(400);
  expect((await listReuses()).data).toEqual([data]);
  expect(await getEntry()).toEqual(entry);
});

it('keeps legacy copies without timestamps or client ids distinct', async () => {
  const before = await getEntry();
  const first = await recordReuse(undefined, null);
  expect(first.status).toBe(201);
  const original = textEntryReusedDocumentSchema.parse(await first.json()).data;
  expect(original.attributes.date_created).toBe('2026-11-10T12:00:00.123000');
  const second = await recordReuse(undefined, null);
  expect(second.status).toBe(201);
  const repeated = textEntryReusedDocumentSchema.parse(
    await second.json()
  ).data;
  expect(repeated.id).not.toBe(original.id);
  expect(
    repeated.attributes.date_created > original.attributes.date_created
  ).toBe(true);
  expect((await getEntry()).attributes).toEqual({
    ...before.attributes,
    reused_count: before.attributes.reused_count + 2,
  });
  expect((await listReuses()).data).toEqual([original, repeated]);
});

it('sorts and filters queued copies by event time rather than upload order', async () => {
  const recorded = [];
  for (const [at, clientId, entryId] of [
    ['2024-03-02T00:00:00.123456Z', 'latest', '1'],
    ['2024-03-01T00:00:00.123456Z', 'earliest', '2'],
    ['2024-03-02T00:00:00.123455Z', 'middle', '1'],
  ]) {
    const response = await recordReuse(at, clientId, entryId);
    expect(response.status).toBe(201);
    recorded.push(
      textEntryReusedDocumentSchema.parse(await response.json()).data
    );
  }
  const [latest, earliest, middle] = recorded;
  expect((await listReuses('?sort=-date_created')).data).toEqual([
    latest,
    middle,
    earliest,
  ]);
  expect((await listReuses('?sort=date_created')).data).toEqual([
    earliest,
    middle,
    latest,
  ]);
  const filtered = await listReuses(
    '?filter[text_entry.id]=1&sort=-date_created&include=text_entry'
  );
  expect(filtered.data).toEqual([latest, middle]);
  expect(filtered.meta.pagination.count).toBe(2);
  expect(filtered.included).toEqual([await getEntry()]);
});
