import {describe, expect, test} from 'bun:test';
import {
  type AdminAuditLogListParams,
  type AdminUserListParams,
  adminAuditLogListQuerySchema,
  adminUserListQuerySchema,
  type CommaList,
  type IncludePath,
  includeSchema,
  RELATIONSHIPS,
  type TagListParams,
  type TagTextEntryListParams,
  type TextEntryListParams,
  type TextEntryReusedListParams,
  tagListQuerySchema,
  tagTextEntryListQuerySchema,
  textEntryListQuerySchema,
  textEntryReusedListQuerySchema,
} from '../src/index';
import {parsed} from './support';

/** Whether two types are the same (not merely assignable either way). */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

/** Compiles only when `T` is `true`: a type-level assertion. */
const assert = <T extends true>(): T => true as T;

/** A params object as a client sends it: `URLSearchParams` of it. */
function entries(params: object) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    search.append(key, String(value));
  }
  return [...search];
}

const TEXT_ENTRY_PATHS = [
  'user',
  'text_entry_to_tag',
  'text_entry_to_tag.tag',
  'text_entry_to_tag.text_entry',
  'text_entry_to_tag.user',
  'text_entry_to_tag.tag.user',
  'text_entry_to_tag.text_entry.user',
  'text_entry_to_tag.text_entry.text_entry_to_tag',
] as const;

describe('include paths', () => {
  test('are every path include accepts, up to the depth limit', () => {
    assert<
      Equal<
        IncludePath<typeof RELATIONSHIPS, 'TextEntry'>,
        (typeof TEXT_ENTRY_PATHS)[number]
      >
    >();
    assert<Equal<IncludePath<typeof RELATIONSHIPS, 'Tag'>, 'user'>>();
    assert<Equal<IncludePath<typeof RELATIONSHIPS, 'User'>, never>>();
    for (const path of TEXT_ENTRY_PATHS) {
      expect(
        parsed(includeSchema(RELATIONSHIPS, 'TextEntry'), path)
      ).toBeArray();
    }
  });

  test('come in lists of up to three', () => {
    assert<Equal<TagListParams['include'] & string, CommaList<'user'>>>();
    const list: CommaList<'a' | 'b'> = 'a,b,a';
    expect(list).toBe('a,b,a');
    // @ts-expect-error: four is past what the type spells out.
    const long: CommaList<'a'> = 'a,a,a,a';
    expect(long).toBeString();
  });
});

describe('list params', () => {
  test('name every filter, sort, page and include the schema takes', () => {
    assert<
      Equal<
        keyof TextEntryListParams,
        | 'filter[id]'
        | 'filter[tags.name]'
        | 'filter[tags.id]'
        | 'filter[user.username]'
        | 'filter[tag_count]'
        | 'filter[is_deleted]'
        | 'filter[date_updated.gt]'
        | 'filter[search]'
        | 'sort'
        | 'page[number]'
        | 'page[size]'
        | 'page[after]'
        | 'include'
      >
    >();
    assert<
      Equal<
        keyof TagListParams,
        | 'filter[name]'
        | 'filter[user.username]'
        | 'filter[date_updated.gt]'
        | 'sort'
        | 'page[number]'
        | 'page[size]'
        | 'page[after]'
        | 'include'
      >
    >();
    assert<
      Equal<
        keyof TagTextEntryListParams,
        | 'filter[tag.id]'
        | 'filter[text_entry.id]'
        | 'filter[is_deleted]'
        | 'filter[date_updated.gt]'
        | 'sort'
        | 'page[number]'
        | 'page[size]'
        | 'page[after]'
        | 'include'
      >
    >();
    assert<
      Equal<
        keyof TextEntryReusedListParams,
        'sort' | 'page[number]' | 'page[size]' | 'include'
      >
    >();
    assert<
      Equal<
        keyof AdminUserListParams,
        | 'filter[is_active]'
        | 'filter[is_staff]'
        | 'filter[username]'
        | 'filter[search]'
        | 'sort'
        | 'page[number]'
        | 'page[size]'
      >
    >();
    assert<
      Equal<
        keyof AdminAuditLogListParams,
        'filter[target_user_id]' | 'page[number]' | 'page[size]'
      >
    >();
  });

  test("type each filter's value as the filter parses it", () => {
    assert<Equal<TextEntryListParams['filter[id]'], number | undefined>>();
    assert<
      Equal<TextEntryListParams['filter[is_deleted]'], boolean | undefined>
    >();
    assert<
      Equal<TextEntryListParams['filter[tags.name]'], string | undefined>
    >();
    assert<
      Equal<
        AdminAuditLogListParams['filter[target_user_id]'],
        number | undefined
      >
    >();
    assert<Equal<TagListParams['sort'] & string, CommaList<SortKeys>>>();
  });

  test('refuse what the schema refuses', () => {
    // @ts-expect-error: not a filter of entries.
    const untagged: TextEntryListParams = {'filter[untagged]': true};
    // @ts-expect-error: not a sort field of tags.
    const sort: TagListParams = {sort: 'subject'};
    // @ts-expect-error: not a path from tags.
    const include: TagListParams = {include: 'user.x'};
    // @ts-expect-error: the admin API refuses include.
    const admin: AdminUserListParams = {include: 'user'};
    // @ts-expect-error: tags ignore search; sending it is a mistake.
    const search: TagListParams = {'filter[search]': 'x'};
    // @ts-expect-error: entry reuses have no revision order to page in.
    const after: TextEntryReusedListParams = {'page[after]': 'x'};
    // @ts-expect-error: a keyset page has no number...
    const numbered: TagListParams = {'page[after]': 'x', 'page[number]': 2};
    // @ts-expect-error: ...and no sort: it is in revision order.
    const sorted: TextEntryListParams = {'page[after]': 'x', sort: 'subject'};
    expect([
      untagged,
      sort,
      include,
      admin,
      search,
      after,
      numbered,
      sorted,
    ]).toHaveLength(8);
  });

  test('are queries the schemas accept', () => {
    const cases: Array<[object, {safeParse(input: unknown): unknown}]> = [
      [
        {
          'page[number]': 2,
          'page[size]': 10,
          'filter[id]': 3,
          'filter[tags.name]': 'a',
          'filter[tags.id]': 4,
          'filter[user.username]': 'u',
          'filter[tag_count]': 0,
          'filter[is_deleted]': false,
          'filter[date_updated.gt]': '2024-01-01T12:34:56.123456',
          'filter[search]': 'term',
          sort: '-date_created,subject,body',
          include: 'text_entry_to_tag.tag,text_entry_to_tag.user,user',
        } satisfies Required<Omit<TextEntryListParams, 'page[after]'>>,
        textEntryListQuerySchema,
      ],
      [
        {
          'page[number]': 1,
          'page[size]': 100,
          'filter[name]': 'n',
          'filter[user.username]': 'u',
          'filter[date_updated.gt]': '2024-01-01T12:34:56',
          sort: '-order',
          include: 'user',
        } satisfies Required<Omit<TagListParams, 'page[after]'>>,
        tagListQuerySchema,
      ],
      [
        {
          'page[number]': 1,
          'page[size]': 5,
          sort: '-date_created',
          include: 'text_entry.text_entry_to_tag.tag,user',
        } satisfies Required<TextEntryReusedListParams>,
        textEntryReusedListQuerySchema,
      ],
      [
        {
          'page[number]': 1,
          'page[size]': 25,
          'filter[is_active]': true,
          'filter[is_staff]': false,
          'filter[username]': 'alice',
          'filter[search]': 'ali',
          sort: '-last_login',
        } satisfies Required<AdminUserListParams>,
        adminUserListQuerySchema,
      ],
      [
        {
          'page[number]': 1,
          'page[size]': 25,
          'filter[target_user_id]': 7,
        } satisfies Required<AdminAuditLogListParams>,
        adminAuditLogListQuerySchema,
      ],
      // Keyset pages: a cursor instead of a number, in revision order.
      [
        {
          'page[after]': '1970-01-01T00:00:00,0',
          'page[size]': 100,
          'filter[tags.id]': 4,
        } satisfies TextEntryListParams,
        textEntryListQuerySchema,
      ],
      [
        {
          'page[after]': '2024-01-01T12:34:56.123456,3',
          'filter[date_updated.gt]': '2024-01-01T12:34:56',
        } satisfies TagListParams,
        tagListQuerySchema,
      ],
      [
        {
          'page[after]': '2024-01-01T12:34:56,3',
          'page[size]': 100,
          'filter[tag.id]': 2,
          'filter[text_entry.id]': 6,
          'filter[is_deleted]': true,
          'filter[date_updated.gt]': '2024-01-01T12:34:56',
          include: 'text_entry,tag',
        } satisfies Omit<
          Required<TagTextEntryListParams>,
          'page[number]' | 'sort'
        >,
        tagTextEntryListQuerySchema,
      ],
    ];
    for (const [params, schema] of cases) {
      expect(schema.safeParse(entries(params))).toMatchObject({success: true});
    }
  });
});

type SortKeys =
  | 'date_last_used'
  | 'date_created'
  | 'date_updated'
  | 'entry_count'
  | 'name'
  | 'order'
  | '-date_last_used'
  | '-date_created'
  | '-date_updated'
  | '-entry_count'
  | '-name'
  | '-order';
