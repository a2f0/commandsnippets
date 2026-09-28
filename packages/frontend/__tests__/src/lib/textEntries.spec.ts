import {
  CODES,
  type TextEntryListDocument,
  type User,
} from '@commandsnippets/api-shared';
import {HttpResponse, http} from 'msw';
import {setupServer} from 'msw/node';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {ITextEntryJsonApi} from '../../../src/lib/api/responses/types';
import {CommandsnippetsDexie} from '../../../src/lib/db/adapters/dexie';
import {db} from '../../../src/lib/db/db';
import {fetchAllEntriesForUser, sort} from '../../../src/lib/textEntries';
import {errorDocument, pagination} from '../../../src/msw/documents';
import {
  createStore,
  entry,
  junction,
  tag,
  testUser,
} from '../../util/storeFixtures';

const username = testUser.attributes.username;

function subjects(entries: ITextEntryJsonApi[]) {
  return entries.map(e => e.attributes.subject);
}

describe('sort', () => {
  describe('by date', () => {
    // Created in one order and updated in another.
    const entries = [
      entry('1', {
        subject: 'created-last',
        date_created: '2021-01-01T00:00:00',
        date_updated: '2019-01-01T00:00:00',
      }),
      entry('2', {
        subject: 'created-first',
        date_created: '2019-01-01T00:00:00',
        date_updated: '2021-01-01T00:00:00',
      }),
      entry('3', {
        subject: 'created-second',
        date_created: '2020-01-01T00:00:00',
        date_updated: '2020-06-01T00:00:00',
      }),
    ];

    it.each([
      ['date_created', ['created-first', 'created-second', 'created-last']],
      ['-date_created', ['created-last', 'created-second', 'created-first']],
      ['date_updated', ['created-last', 'created-second', 'created-first']],
      ['-date_updated', ['created-first', 'created-second', 'created-last']],
    ])('sorts by %s', (sortOrder, expected) => {
      const sorted = sort(username, null, entries, sortOrder, createStore());

      expect(subjects(sorted)).toEqual(expected);
    });
  });

  describe('by text', () => {
    // Case-insensitive; the subjects and bodies sort in different orders.
    const entries = [
      entry('1', {subject: 'bravo', body: 'Charlie'}),
      entry('2', {subject: 'Charlie', body: 'alpha'}),
      entry('3', {subject: 'alpha', body: 'bravo'}),
    ];

    it.each([
      ['subject', ['3', '1', '2']],
      ['-subject', ['2', '1', '3']],
      ['body', ['2', '3', '1']],
      ['-body', ['1', '3', '2']],
    ])('sorts by %s', (sortOrder, expected) => {
      const sorted = sort(username, null, entries, sortOrder, createStore());

      expect(sorted.map(e => e.id)).toEqual(expected);
    });
  });

  describe('with a search', () => {
    const entries = [
      entry('1', {subject: 'Deploy script', body: 'kubectl apply'}),
      entry('2', {subject: 'notes', body: 'git REBASE'}),
      entry('3', {subject: 'other', body: 'other'}),
    ];
    const tagged = [
      tag('1', {name: 'shell'}),
      ...entries,
      junction('1', '1', '1'),
      junction('2', '1', '2'),
      junction('3', '1', '3'),
    ];

    it.each([
      ['an untagged list', null],
      ['a tag list', 'shell'],
    ])('%s matches the subject or body in any case', (_list, tagName) => {
      const store = createStore(tagged);
      const found = (search: string) => {
        store.setEntrySearchString(search);
        const sorted = sort(username, tagName, entries, 'date_updated', store);
        return sorted.map(e => e.id);
      };

      expect(found('DEPLOY')).toEqual(['1']);
      expect(found('Rebase')).toEqual(['2']);
      expect(found('apply')).toEqual(['1']);
    });
  });
});

// The Debug menu's "Populate IndexedDB": every entry of the user's, with the
// tags, junctions and users included, copied into the Dexie database.
describe('fetchAllEntriesForUser', () => {
  const ENTRIES = 'http://localhost:9001/api/v1/entries';
  const date = '2020-01-01T00:00:00';
  const owner = {user: {data: {type: 'User', id: '1'}}} as const;
  const user: User = {
    type: 'User',
    id: '1',
    attributes: {username: 'test', is_staff: false, date_updated: date},
  };

  /** Page `number` of 2: entry `number`, tagged with tag 5 by junction `number`. */
  const page = (url: string, number: number): TextEntryListDocument => {
    const id = String(number);
    return {
      ...pagination(url, number, 2, 2),
      data: [
        {
          type: 'TextEntry',
          id,
          attributes: {
            body: `body-${id}`,
            subject: `subject-${id}`,
            date_updated: date,
            date_created: date,
            reused_count: 0,
            is_deleted: false,
            tag_count: 1,
          },
          relationships: {
            ...owner,
            text_entry_to_tag: {
              data: [{type: 'TagTextEntryThroughModel', id}],
              meta: {count: 1},
            },
          },
        },
      ],
      included: [
        {
          type: 'Tag',
          id: '5',
          attributes: {
            name: 'shell',
            date_created: date,
            date_last_used: date,
            date_updated: date,
            entry_count: 2,
            order: 0,
            is_deleted: false,
          },
          relationships: owner,
        },
        {
          type: 'TagTextEntryThroughModel',
          id,
          attributes: {order: number, date_updated: date, date_created: date},
          relationships: {
            tag: {data: {type: 'Tag', id: '5'}},
            text_entry: {data: {type: 'TextEntry', id}},
            ...owner,
          },
        },
        user,
      ],
    };
  };

  const pagesRequested: string[] = [];
  const server = setupServer(
    http.get(ENTRIES, ({request}) => {
      const requested = new URL(request.url).searchParams.get('page[number]');
      pagesRequested.push(requested ?? '');
      const number = Number(requested);
      if (number !== 1 && number !== 2) {
        return HttpResponse.json(
          errorDocument(404, CODES.notFound, 'Invalid page.'),
          {status: 404}
        );
      }
      return HttpResponse.json(page(request.url, number));
    })
  );
  // The IndexedDB database `db` writes to, to read what it stored.
  const stored = new CommandsnippetsDexie();

  beforeAll(() => server.listen({onUnhandledRequest: 'error'}));
  afterAll(() => server.close());
  beforeEach(async () => {
    pagesRequested.length = 0;
    await Promise.all(
      [stored.users, stored.tags, stored.entries, stored.junction].map(table =>
        table.clear()
      )
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches every page, from the first', async () => {
    await fetchAllEntriesForUser('test');

    expect(pagesRequested).toEqual(['1', '2']);
    expect((await stored.entries.toArray()).map(({id}) => id)).toEqual([
      '1',
      '2',
    ]);
    expect(await stored.tags.toArray()).toEqual([
      expect.objectContaining({id: '5', userId: '1'}),
    ]);
    expect(await stored.users.toArray()).toEqual([
      expect.objectContaining({id: '1', username: 'test'}),
    ]);
  });

  it("stores each junction as its user's, between its tag and entry", async () => {
    await fetchAllEntriesForUser('test');

    expect(await stored.junction.toArray()).toEqual([
      expect.objectContaining({id: '1', userId: '1', tagId: '5', entryId: '1'}),
      expect.objectContaining({id: '2', userId: '1', tagId: '5', entryId: '2'}),
    ]);
  });

  it('waits for each junction to be stored', async () => {
    vi.spyOn(db, 'putJunction').mockRejectedValue(
      new Error('IndexedDB is full')
    );

    await expect(fetchAllEntriesForUser('test')).rejects.toThrow(
      'IndexedDB is full'
    );
  });
});
