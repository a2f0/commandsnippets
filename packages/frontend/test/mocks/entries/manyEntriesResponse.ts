import type {
  TagTextEntry,
  TextEntry,
  TextEntryListDocument,
} from '@commandsnippets/api-shared';
import type {JsonObject} from '@wdio/types';

import {onePage} from '../../../src/msw/documents';

const user = {data: {type: 'User', id: '1'}} as const;

const pad = (n: number) => n.toString().padStart(2, '0');
/** Entry `i`'s revision (distinct and valid for up to 3599 entries). */
const revisionOf = (i: number, fraction: string) =>
  `2024-12-01T${pad(10 + Math.floor(i / 3600))}:${pad(Math.floor(i / 60) % 60)}:${pad(i % 60)}.${fraction}`;

const holyGrailBody = (i: number) =>
  `Test entry ${i} - This is a longer entry body to test the Holy Grail layout with scrollable content. The bottom toolbar should remain sticky at the bottom of the viewport regardless of how much content is in the entries list. This entry contains enough text to ensure the list will scroll.`;

/**
 * `count` entries, all in tag 1 (bodies by `body`, the Holy Grail layout's
 * by default), with their junctions.
 */
export const generateManyEntries = (
  count: number,
  body: (i: number) => string = holyGrailBody
): TextEntryListDocument & JsonObject => {
  const entries: Array<TextEntry & JsonObject> = [];
  const throughModels: TagTextEntry[] = [];

  for (let i = 1; i <= count; i++) {
    entries.push({
      type: 'TextEntry',
      id: `${i}`,
      attributes: {
        body: body(i),
        subject: `Holy Grail Test Entry ${i}`,
        date_updated: revisionOf(i, '995003'),
        date_created: revisionOf(i, '994989'),
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
        date_updated: revisionOf(i, '995003'),
        date_created: revisionOf(i, '994989'),
        is_deleted: false,
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
