import {describe, expect, test} from 'bun:test';
import {dateTimeFilter, integerFilter, textFilter} from '../src/filters';
import {
  listQuerySchema,
  MAX_PAGE_SIZE,
  PAGE_SIZE,
  type QueryEntries,
} from '../src/query';
import {failures, parsed} from './support';

const schema = listQuerySchema({
  filters: {
    name: textFilter,
    user__username: textFilter,
    id: integerFilter,
    date_updated__gt: dateTimeFilter,
  },
  sort: ['name', 'date_created'],
  search: 'supported',
  include: 'resolved',
  cursor: 'supported',
});

/** The query string's pairs, in order. */
const entries = (query: string): QueryEntries => [
  ...new URLSearchParams(query),
];

/** The one error a query gets: `[message, status]`. */
function error(
  query: string,
  querySchema: Parameters<typeof failures>[0] = schema
): [string, number] {
  const [first] = failures(querySchema, entries(query));
  expect(first?.pointer).toBe('/data');
  return [first?.message ?? '', first?.status ?? 400];
}

describe('listQuerySchema', () => {
  test('parses filters, search, sort, page and include', () => {
    expect(
      parsed(
        schema,
        entries(
          'filter[name]=a&filter[user.username]=u&filter[id]=7&filter[name]=b' +
            '&filter[search]=term&sort=-name,date_created&page[number]=2' +
            '&page[size]=10&include=x.y&fields[x]=a'
        )
      )
    ).toEqual({
      filters: [
        {name: 'name', value: 'a'},
        {name: 'name', value: 'b'},
        {name: 'user__username', value: 'u'},
        {name: 'id', value: 7},
      ],
      search: 'term',
      sort: [
        {field: 'name', descending: true},
        {field: 'date_created', descending: false},
      ],
      page: 2,
      pageSize: 10,
      after: null,
      include: 'x.y',
    });
  });

  test('defaults', () => {
    expect(parsed(schema, [])).toEqual({
      filters: [],
      search: null,
      sort: null,
      page: 1,
      pageSize: PAGE_SIZE,
      after: null,
      include: null,
    });
    expect(parsed(schema, entries('sort=&include=&filter=1&page=1'))).toEqual(
      expect.objectContaining({sort: null, include: '', page: 1})
    );
  });

  test('page[size]: capped, and anything invalid means the default', () => {
    const size = (value: string) =>
      parsed(schema, entries(`page[size]=${value}`)).pageSize;
    expect(size('1000')).toBe(MAX_PAGE_SIZE);
    expect(size('0')).toBe(PAGE_SIZE);
    expect(size('abc')).toBe(PAGE_SIZE);
    expect(size('-5')).toBe(PAGE_SIZE);
    expect(size('3')).toBe(3);
  });

  test('page[number]: a positive integer, or a 404', () => {
    expect(parsed(schema, entries('page[number]=007')).page).toBe(7);
    for (const value of ['0', '-1', '1.5', 'abc', '']) {
      expect(error(`page[number]=${value}`)).toEqual(['Invalid page.', 404]);
    }
  });

  test('unknown and repeated parameters, in parameter order', () => {
    expect(error('foo=1&sort=bad')).toEqual([
      'invalid query parameter: foo',
      400,
    ]);
    expect(error('sort=bad&foo=1')).toEqual([
      'invalid query parameter: foo',
      400,
    ]);
    expect(error('foo=1&1=2')).toEqual(['invalid query parameter: foo', 400]);
    expect(error('Sort=x')).toEqual(['invalid query parameter: Sort', 400]);
    expect(error('filter[a b]=1')).toEqual([
      'invalid query parameter: filter[a b]',
      400,
    ]);
    for (const key of ['sort', 'include', 'page[number]', 'fields[x]']) {
      expect(error(`${key}=1&${key}=2`)).toEqual([
        `repeated query parameter not allowed: ${key}`,
        400,
      ]);
    }
    // Filters may repeat.
    expect(
      parsed(schema, entries('filter[id]=1&filter[id]=2')).filters
    ).toEqual([
      {name: 'id', value: 1},
      {name: 'id', value: 2},
    ]);
  });

  test('filters: an empty value, then an unknown name, then each value', () => {
    expect(error('filter[bad]=')).toEqual([
      'missing value for query parameter filter[bad]',
      400,
    ]);
    expect(error('filter[id]=1&filter[id]=')).toEqual([
      'missing value for query parameter filter[id]',
      400,
    ]);
    expect(error('filter[user.bad]=1')).toEqual([
      'invalid filter[user__bad]',
      400,
    ]);
    expect(error('filter[id]=1&filter[id]=x&filter[bad]=1')).toEqual([
      'Enter a number.',
      400,
    ]);
    expect(error('filter[bad]=1&filter[id]=x')).toEqual([
      'invalid filter[bad]',
      400,
    ]);
    expect(error('filter[id]=x&sort=bad&page[number]=0')).toEqual([
      'Enter a number.',
      400,
    ]);
  });

  test('sort: every bad term, named as given', () => {
    expect(error('sort=nope')).toEqual(['invalid sort parameter: nope', 400]);
    expect(error('sort=-name,%20bad%20,worse,date.created')).toEqual([
      'invalid sort parameters: bad,worse,date.created',
      400,
    ]);
    expect(error('sort=name,')).toEqual(['invalid sort parameter: ', 400]);
    expect(error('sort=--name')).toEqual([
      'invalid sort parameter: --name',
      400,
    ]);
    expect(error('sort=bad&page[number]=0')).toEqual([
      'invalid sort parameter: bad',
      400,
    ]);
  });

  test.each([
    'constructor',
    'toString',
    'hasOwnProperty',
    '__proto__',
    'valueOf',
  ])('refuses %s as a filter or sort field, like any unknown name', name => {
    expect(error(`filter[${name}]=x`)).toEqual([
      `invalid filter[${name}]`,
      400,
    ]);
    expect(error(`sort=${name}`)).toEqual([
      `invalid sort parameter: ${name}`,
      400,
    ]);
    expect(error(`sort=-${name}`)).toEqual([
      `invalid sort parameter: -${name}`,
      400,
    ]);
  });

  test('search: supported, ignored, or refused (after other errors)', () => {
    const withSearch = (search: 'ignored' | 'refused') =>
      listQuerySchema({
        filters: {},
        sort: [],
        search,
        include: 'resolved',
        cursor: 'refused',
      });
    expect(parsed(schema, entries('filter[search]=')).search).toBe('');
    expect(
      parsed(withSearch('ignored'), entries('filter[search]=x')).search
    ).toBeNull();
    expect(error('filter[search]=', withSearch('refused'))).toEqual([
      'filter[search] is not supported here.',
      400,
    ]);
    expect(error('filter[search]=x&sort=x', withSearch('refused'))).toEqual([
      'invalid sort parameter: x',
      400,
    ]);
  });

  test('include: passed on, or refused (before a refused search)', () => {
    const refusing = listQuerySchema({
      filters: {},
      sort: [],
      search: 'refused',
      include: 'refused',
      cursor: 'refused',
    });
    expect(error('include=', refusing)).toEqual([
      'include is not supported here.',
      400,
    ]);
    expect(error('filter[search]=x&include=y', refusing)).toEqual([
      'include is not supported here.',
      400,
    ]);
    expect(error('include=y&page[number]=0', refusing)).toEqual([
      'Invalid page.',
      404,
    ]);
    expect(parsed(refusing, []).include).toBeNull();
  });

  test('page[after]: a keyset cursor, on its own', () => {
    expect(
      parsed(
        schema,
        entries('page[after]=2024-01-01T12:34:56.5,7&page[size]=5')
      )
    ).toEqual(
      expect.objectContaining({
        after: {dateUpdated: '2024-01-01T12:34:56.500000', id: 7},
        page: 1,
        pageSize: 5,
      })
    );
    expect(
      parsed(schema, entries('page[after]=1970-01-01T00:00:00,0')).after
    ).toEqual({dateUpdated: '1970-01-01T00:00:00.000000', id: 0});
    // Filters narrow the rows it pages over.
    expect(
      parsed(schema, entries('filter[id]=3&page[after]=2024-01-01,1')).filters
    ).toEqual([{name: 'id', value: 3}]);
    for (const value of [
      '',
      'x',
      '2024-01-01',
      '2024-01-01,',
      'x,1',
      '2024-01-01,-1',
    ]) {
      expect(error(`page[after]=${encodeURIComponent(value)}`)).toEqual([
        `invalid page[after]: ${value} (expected <date_updated>,<id>)`,
        400,
      ]);
    }
    expect(error('page[after]=2024-01-01,1&page[number]=1')).toEqual([
      'page[after] and page[number] cannot be combined.',
      400,
    ]);
    expect(error('page[after]=2024-01-01,1&sort=name')).toEqual([
      'page[after] pages in revision order (date_updated, id): leave out sort.',
      400,
    ]);
    // After the other parameters' own errors.
    expect(error('page[after]=x&page[number]=0')).toEqual([
      'Invalid page.',
      404,
    ]);
    expect(error('page[after]=x&sort=x')).toEqual([
      'invalid sort parameter: x',
      400,
    ]);
    expect(error('page[after]=x&page[after]=y')).toEqual([
      'repeated query parameter not allowed: page[after]',
      400,
    ]);
  });

  test('page[after]: refused where keyset pages are', () => {
    const refusing = listQuerySchema({
      filters: {},
      sort: [],
      search: 'refused',
      include: 'refused',
      cursor: 'refused',
    });
    expect(error('page[after]=2024-01-01,1', refusing)).toEqual([
      'page[after] is not supported here.',
      400,
    ]);
    expect(error('page[after]=x', refusing)).toEqual([
      'invalid page[after]: x (expected <date_updated>,<id>)',
      400,
    ]);
    expect(parsed(refusing, []).after).toBeNull();
  });
});
