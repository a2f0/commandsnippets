import type {
  TextEntry,
  TextEntryListDocument,
} from '@commandsnippets/api-shared';
import type {JsonObject} from '@wdio/types';

import {onePage} from '../../../src/msw/documents';

/** The owner of every resource here: the test user. */
const user = {data: {type: 'User', id: '1'}} as const;

/** Entry `id`'s tags: the one junction of the same id. */
const taggedBy = (
  id: string
): TextEntry['relationships']['text_entry_to_tag'] => ({
  data: [{type: 'TagTextEntryThroughModel', id}],
  meta: {count: 1},
});

/**
 * GET /api/v1/entries: four entries, each tagged test-tag-1 by the junction
 * of its own id, with the tag, the junctions and the user included.
 */
export const entriesResponse: TextEntryListDocument & JsonObject = {
  ...onePage('http://localhost:9001/api/v1/entries', 4),
  data: [
    {
      type: 'TextEntry',
      id: '1',
      attributes: {
        body: 'entry-1-body',
        subject: 'entry-1-subject',
        date_updated: '2019-03-17T18:20:00',
        date_created: '2019-03-17T18:20:00',
        is_public: false,
        reused_count: 0,
        is_deleted: false,
        tag_count: 1,
      },
      relationships: {user, text_entry_to_tag: taggedBy('1')},
    },
    {
      type: 'TextEntry',
      id: '2',
      attributes: {
        body: 'entry-2-body',
        subject: 'entry-2-subject',
        date_updated: '2021-03-17T18:20:00',
        date_created: '2021-03-17T18:20:00',
        is_public: false,
        reused_count: 0,
        is_deleted: false,
        tag_count: 1,
      },
      relationships: {user, text_entry_to_tag: taggedBy('2')},
    },
    {
      type: 'TextEntry',
      id: '3',
      attributes: {
        body: 'entry-3-body',
        subject: 'entry-3-subject',
        date_updated: '2021-03-18T18:20:00',
        date_created: '2021-03-18T18:20:00',
        is_public: false,
        reused_count: 0,
        is_deleted: false,
        tag_count: 1,
      },
      relationships: {user, text_entry_to_tag: taggedBy('3')},
    },
    {
      type: 'TextEntry',
      id: '4',
      attributes: {
        body: 'entry-4-body',
        subject: 'entry-4-subject',
        date_updated: '2021-03-19T18:20:00',
        date_created: '2021-03-19T18:20:00',
        is_public: false,
        reused_count: 0,
        is_deleted: false,
        tag_count: 1,
      },
      relationships: {user, text_entry_to_tag: taggedBy('4')},
    },
  ],
  included: [
    {
      type: 'Tag',
      id: '1',
      attributes: {
        name: 'test-tag-1',
        date_created: '2020-04-15T18:20:00',
        date_last_used: '2020-04-15T18:20:00',
        date_updated: '2020-12-28T17:36:18.397537',
        is_public: false,
        entry_count: 15,
        order: 0,
        is_deleted: false,
      },
      relationships: {user},
    },
    {
      type: 'TagTextEntryThroughModel',
      id: '1',
      attributes: {
        order: 0,
        date_updated: '2020-04-13T18:20:00',
        date_created: '2020-04-13T18:20:00',
        is_deleted: false,
      },
      relationships: {
        tag: {data: {type: 'Tag', id: '1'}},
        text_entry: {data: {type: 'TextEntry', id: '1'}},
        user,
      },
    },
    {
      type: 'TagTextEntryThroughModel',
      id: '2',
      attributes: {
        order: 1,
        date_updated: '2020-04-13T18:20:00',
        date_created: '2020-04-13T18:20:00',
        is_deleted: false,
      },
      relationships: {
        tag: {data: {type: 'Tag', id: '1'}},
        text_entry: {data: {type: 'TextEntry', id: '2'}},
        user,
      },
    },
    {
      type: 'TagTextEntryThroughModel',
      id: '3',
      attributes: {
        order: 2,
        date_updated: '2020-04-14T18:20:00',
        date_created: '2020-04-14T18:20:00',
        is_deleted: false,
      },
      relationships: {
        tag: {data: {type: 'Tag', id: '1'}},
        text_entry: {data: {type: 'TextEntry', id: '3'}},
        user,
      },
    },
    {
      type: 'TagTextEntryThroughModel',
      id: '4',
      attributes: {
        order: 3,
        date_updated: '2020-04-15T18:20:00',
        date_created: '2020-04-15T18:20:00',
        is_deleted: false,
      },
      relationships: {
        tag: {data: {type: 'Tag', id: '1'}},
        text_entry: {data: {type: 'TextEntry', id: '4'}},
        user,
      },
    },
    {
      type: 'User',
      id: '1',
      attributes: {
        username: 'test',
        is_staff: true,
        date_updated: '2020-04-13T18:20:00',
        data_version: 1,
      },
    },
  ],
};
