import type {
  TagTextEntry,
  TextEntry,
  TextEntryListDocument,
} from '@commandsnippets/api-shared';
import type {JsonObject} from '@wdio/types';

import {onePage} from '../../../src/msw/documents';

const user = {data: {type: 'User', id: '1'}} as const;

// Generate many entries for Holy Grail layout testing
const generateManyEntries = (
  count: number
): TextEntryListDocument & JsonObject => {
  const entries: TextEntry[] = [];
  const throughModels: TagTextEntry[] = [];

  for (let i = 1; i <= count; i++) {
    entries.push({
      type: 'TextEntry',
      id: `${i}`,
      attributes: {
        body: `Test entry ${i} - This is a longer entry body to test the Holy Grail layout with scrollable content. The bottom toolbar should remain sticky at the bottom of the viewport regardless of how much content is in the entries list. This entry contains enough text to ensure the list will scroll.`,
        subject: `Holy Grail Test Entry ${i}`,
        date_updated: `2024-12-${i.toString().padStart(2, '0')}T10:30:${i.toString().padStart(2, '0')}.995003`,
        date_created: `2024-12-${i.toString().padStart(2, '0')}T10:30:${i.toString().padStart(2, '0')}.994989`,
        reused_count: 0,
        is_deleted: false,
        tag_count: 1,
      },
      relationships: {
        user,
        text_entry_to_tag: {
          data: [{type: 'TagTextEntryThroughModel', id: `${i}`}],
          meta: {count: 1},
        },
      },
    });

    throughModels.push({
      type: 'TagTextEntryThroughModel',
      id: `${i}`,
      attributes: {
        order: i,
        date_updated: `2024-12-${i.toString().padStart(2, '0')}T10:30:${i.toString().padStart(2, '0')}.995003`,
        date_created: `2024-12-${i.toString().padStart(2, '0')}T10:30:${i.toString().padStart(2, '0')}.994989`,
      },
      relationships: {
        tag: {data: {type: 'Tag', id: '1'}},
        text_entry: {data: {type: 'TextEntry', id: `${i}`}},
        user,
      },
    });
  }

  return {
    ...onePage('http://localhost:9001/api/v1/entries', count),
    data: entries,
    included: [
      ...throughModels,
      {
        type: 'User',
        id: '1',
        attributes: {
          username: 'test',
          is_staff: true,
          date_updated: '2020-04-13T18:20:00',
        },
      },
    ],
  };
};

export const manyEntriesResponse = generateManyEntries(25);
