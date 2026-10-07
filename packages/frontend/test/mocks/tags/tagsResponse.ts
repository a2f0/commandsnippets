import type {TagListDocument} from '@commandsnippets/api-shared';
import type {JsonObject} from '@wdio/types';

import {onePage} from '../../../src/msw/documents';

/** GET /api/v1/tags: the test user's four tags, and the user. */
export const tagsResponse: TagListDocument & JsonObject = {
  ...onePage('http://localhost:9001/api/v1/tags', 4),
  data: [
    {
      type: 'Tag',
      id: '1',
      attributes: {
        name: 'test-tag-1',
        date_created: '2020-05-07T18:20:00',
        date_updated: '2020-05-07T18:20:00',
        date_last_used: '2020-05-07T18:20:00',
        // The four junctions of test/mocks/entries/entriesResponse.ts.
        is_public: false,
        entry_count: 4,
        order: 0,
        is_deleted: false,
      },
      relationships: {
        user: {
          data: {
            type: 'User',
            id: '1',
          },
        },
      },
    },
    {
      type: 'Tag',
      id: '2',
      attributes: {
        name: 'test-tag-2',
        date_created: '2021-05-07T18:20:00',
        date_updated: '2021-05-07T18:20:00',
        date_last_used: '2021-05-07T18:20:00',
        is_public: false,
        entry_count: 0,
        order: 1,
        is_deleted: false,
      },
      relationships: {
        user: {
          data: {
            type: 'User',
            id: '1',
          },
        },
      },
    },
    {
      type: 'Tag',
      id: '3',
      attributes: {
        name: 'test-tag-3',
        date_created: '2022-05-07T18:20:00',
        date_updated: '2022-05-07T18:20:00',
        date_last_used: '2021-05-07T18:20:00',
        is_public: false,
        entry_count: 0,
        order: 2,
        is_deleted: false,
      },
      relationships: {
        user: {
          data: {
            type: 'User',
            id: '1',
          },
        },
      },
    },
    {
      type: 'Tag',
      id: '4',
      attributes: {
        name: 'test-tag-4',
        date_created: '2022-05-08T18:20:00',
        date_updated: '2022-05-08T18:20:00',
        date_last_used: '2021-05-08T18:20:00',
        is_public: false,
        entry_count: 0,
        order: 3,
        is_deleted: false,
      },
      relationships: {
        user: {
          data: {
            type: 'User',
            id: '1',
          },
        },
      },
    },
  ],
  included: [
    {
      type: 'User',
      id: '1',
      attributes: {
        username: 'test',
        is_staff: true,
        date_updated: '2020-04-13T18:20:00',
        date_restored: null,
      },
    },
  ],
};
