import type {JsonObject} from '@wdio/types';

import type {ITextEntryJsonApiResponse} from '../../../src/lib/api/responses/types';

// Generate many entries for Holy Grail layout testing
const generateManyEntries = (
  count: number
): ITextEntryJsonApiResponse & JsonObject => {
  const entries = [];
  const throughModels = [];

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
        user: {
          data: {
            type: 'User',
            id: '1',
          },
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
        tag: {
          data: {
            type: 'Tag',
            id: '1',
          },
        },
        text_entry: {
          data: {
            type: 'TextEntry',
            id: `${i}`,
          },
        },
      },
    });
  }

  return {
    links: {
      next: null,
    },
    data: entries,
    included: [
      ...throughModels,
      {
        type: 'User',
        id: '1',
        attributes: {
          username: 'test',
          date_updated: '2020-04-13T18:20:00',
        },
      },
    ],
  };
};

export const manyEntriesResponse = generateManyEntries(25);
