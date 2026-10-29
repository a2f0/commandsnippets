/**
 * The mock API's starting data: the signed-in test user (`test`) and their
 * tags and entries, Alice's data (user 7, which staff read through the admin
 * API) and the admin page's users. Never changed: the state (`state.ts`)
 * starts from copies of it.
 */
import type {
  AdminAuditAction,
  Tag,
  TagListDocument,
  TagTextEntry,
  TextEntryListDocument,
  User,
} from '@commandsnippets/api-shared';

// The signed-in test user, as `included` holds it.
export const testUser: User = {
  type: 'User',
  id: '1',
  attributes: {
    username: 'test',
    is_staff: true,
    date_updated: '2020-04-13T18:20:00',
    data_version: 1,
  },
};

export const ownedByTestUser = {user: {data: {type: 'User', id: '1'}}} as const;

// Mock data for tags (matches test/mocks/tags/tagsResponse.ts)
// Keep original immutable for resets
export const originalTags: TagListDocument['data'] = [
  {
    type: 'Tag',
    id: '1',
    attributes: {
      name: 'test-tag-1',
      is_public: false,
      entry_count: 2,
      order: 0,
      date_updated: '2020-05-07T18:20:00',
      date_created: '2020-05-07T18:20:00',
      date_last_used: '2020-05-07T18:20:00',
      is_deleted: false,
    },
    relationships: ownedByTestUser,
  },
  {
    type: 'Tag',
    id: '2',
    attributes: {
      name: 'test-tag-2',
      is_public: false,
      entry_count: 0,
      order: 1,
      date_updated: '2021-05-07T18:20:00',
      date_created: '2021-05-07T18:20:00',
      date_last_used: '2021-05-07T18:20:00',
      is_deleted: false,
    },
    relationships: ownedByTestUser,
  },
  {
    type: 'Tag',
    id: '3',
    attributes: {
      name: 'test-tag-3',
      is_public: false,
      entry_count: 0,
      order: 2,
      date_updated: '2022-05-07T18:20:00',
      date_created: '2022-05-07T18:20:00',
      date_last_used: '2022-05-07T18:20:00',
      is_deleted: false,
    },
    relationships: ownedByTestUser,
  },
  {
    type: 'Tag',
    id: '4',
    attributes: {
      name: 'test-tag-4',
      is_public: false,
      entry_count: 0,
      order: 3,
      date_updated: '2022-05-08T18:20:00',
      date_created: '2022-05-08T18:20:00',
      date_last_used: '2022-05-08T18:20:00',
      is_deleted: false,
    },
    relationships: ownedByTestUser,
  },
];

// Original immutable entries for resets
export const originalEntriesResponse: Pick<
  TextEntryListDocument,
  'data' | 'included'
> = {
  data: [
    {
      type: 'TextEntry',
      id: '1',
      attributes: {
        body: 'test entry 1',
        subject: 'test-entry-1-subject',
        date_updated: '2022-05-14T02:33:53.995003',
        date_created: '2022-05-14T02:33:53.994989',
        is_public: false,
        reused_count: 0,
        is_deleted: false,
        tag_count: 1,
      },
      relationships: {
        ...ownedByTestUser,
        text_entry_to_tag: {
          data: [{type: 'TagTextEntryThroughModel', id: '1'}],
          meta: {count: 1},
        },
      },
    },
    {
      type: 'TextEntry',
      id: '2',
      attributes: {
        body: 'test entry 2',
        subject: 'test-entry-2-subject',
        date_updated: '2022-05-14T02:33:53.995003',
        date_created: '2022-05-14T02:33:53.994989',
        is_public: false,
        reused_count: 0,
        is_deleted: false,
        tag_count: 1,
      },
      relationships: {
        ...ownedByTestUser,
        text_entry_to_tag: {
          data: [{type: 'TagTextEntryThroughModel', id: '2'}],
          meta: {count: 1},
        },
      },
    },
    {
      // In no tag: the untagged list's.
      type: 'TextEntry',
      id: '3',
      attributes: {
        body: 'test entry 3',
        subject: 'test-entry-3-subject',
        date_updated: '2022-05-14T02:33:53.995003',
        date_created: '2022-05-14T02:33:53.994989',
        is_public: false,
        reused_count: 0,
        is_deleted: false,
        tag_count: 0,
      },
      relationships: {
        ...ownedByTestUser,
        text_entry_to_tag: {data: [], meta: {count: 0}},
      },
    },
  ],
  included: [
    {
      type: 'TagTextEntryThroughModel',
      id: '1',
      attributes: {
        order: 1,
        date_updated: '2020-04-13T18:20:00',
        date_created: '2020-04-13T18:20:00',
        is_deleted: false,
      },
      relationships: {
        tag: {data: {type: 'Tag', id: '1'}},
        text_entry: {data: {type: 'TextEntry', id: '1'}},
        ...ownedByTestUser,
      },
    },
    {
      type: 'TagTextEntryThroughModel',
      id: '2',
      attributes: {
        order: 2,
        date_updated: '2020-04-13T18:20:00',
        date_created: '2020-04-13T18:20:00',
        is_deleted: false,
      },
      relationships: {
        tag: {data: {type: 'Tag', id: '1'}},
        text_entry: {data: {type: 'TextEntry', id: '2'}},
        ...ownedByTestUser,
      },
    },
    testUser,
  ],
};

export type EntriesState = Pick<TextEntryListDocument, 'data' | 'included'>;

// Alice's data (user 7), which staff read through the admin API: one tag
// with one entry. Staff change no one's data but their own, so it never
// changes.
const ALICE_DATE = '2026-09-01T00:00:00.000000';

export const aliceUser: User = {
  type: 'User',
  id: '7',
  attributes: {
    username: 'alice',
    is_staff: false,
    date_updated: ALICE_DATE,
    data_version: 1,
  },
};

const aliceIs = {data: {type: 'User', id: '7'}} as const;

export const aliceTags: Tag[] = [
  {
    type: 'Tag',
    id: '70',
    attributes: {
      name: 'alices-tag',
      date_created: ALICE_DATE,
      date_last_used: ALICE_DATE,
      date_updated: ALICE_DATE,
      is_public: false,
      entry_count: 1,
      order: 0,
      is_deleted: false,
    },
    relationships: {user: aliceIs},
  },
];

const aliceJunction: TagTextEntry = {
  type: 'TagTextEntryThroughModel',
  id: '700',
  attributes: {
    order: 0,
    date_created: ALICE_DATE,
    date_updated: ALICE_DATE,
    is_deleted: false,
  },
  relationships: {
    tag: {data: {type: 'Tag', id: '70'}},
    text_entry: {data: {type: 'TextEntry', id: '71'}},
    user: aliceIs,
  },
};

export const aliceEntries: EntriesState = {
  data: [
    {
      type: 'TextEntry',
      id: '71',
      attributes: {
        subject: 'alices-entry',
        body: 'echo alice',
        date_created: ALICE_DATE,
        date_updated: ALICE_DATE,
        is_public: false,
        reused_count: 0,
        is_deleted: false,
        tag_count: 1,
      },
      relationships: {
        user: aliceIs,
        text_entry_to_tag: {
          data: [{type: 'TagTextEntryThroughModel', id: '700'}],
          meta: {count: 1},
        },
      },
    },
  ],
  included: [aliceJunction],
};

// Admin page data: the signed-in test user (id 1, staff) and one other.
export interface MockAdminUser {
  id: string;
  username: string;
  email: string;
  is_staff: boolean;
  is_active: boolean;
  date_marked_for_deletion: string | null;
}

export interface MockAuditEntry {
  id: string;
  created: string;
  action: AdminAuditAction;
  target: string;
}

export const originalAdminUsers: MockAdminUser[] = [
  {
    id: '1',
    username: 'test',
    email: 'test@example.com',
    is_staff: true,
    is_active: true,
    date_marked_for_deletion: null,
  },
  {
    id: '7',
    username: 'alice',
    email: 'alice@example.com',
    is_staff: false,
    is_active: true,
    date_marked_for_deletion: null,
  },
];
