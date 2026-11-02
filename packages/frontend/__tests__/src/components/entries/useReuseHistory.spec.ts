import type {
  TextEntryReused,
  TextEntryReusedListDocument,
} from '@commandsnippets/api-shared/responses';
import {describe, expect, it} from 'vitest';
import {
  type HistoryPage,
  mergeHistoryPage,
} from '../../../../src/components/entries/useReuseHistory';
import {pagination} from '../../../../src/msw/documents';
import {entry} from '../../../util/storeFixtures';

const URL = 'https://api.test/api/v1/entry_reuses';

function reuse(id: string, entryId: string): TextEntryReused {
  return {
    type: 'TextEntryReused',
    id,
    attributes: {date_created: '2026-01-01T00:00:00.000000'},
    relationships: {
      text_entry: {data: {type: 'TextEntry', id: entryId}},
      user: {data: {type: 'User', id: '1'}},
    },
  };
}

/** Page `page` of 2 of a history of 4 reuses. */
function document(
  page: number,
  data: TextEntryReused[],
  included: TextEntryReusedListDocument['included'] = []
): TextEntryReusedListDocument {
  return {data, included, ...pagination(URL, page, 2, 4)};
}

const first: HistoryPage = {
  reuses: [reuse('r4', '1'), reuse('r3', '2')],
  entries: [entry('1', {}), entry('2', {})],
  page: 1,
  total: 4,
  more: true,
};

describe('mergeHistoryPage', () => {
  it('starts the history afresh with page 1', () => {
    const merged = mergeHistoryPage(
      first,
      1,
      document(1, [reuse('r5', '1')], [entry('1', {})])
    );
    expect(merged.reuses.map(r => r.id)).toEqual(['r5']);
    expect(merged.entries.map(e => e.id)).toEqual(['1']);
    expect(merged).toMatchObject({page: 1, total: 4, more: true});
  });

  it('adds a later page once each, keeping the order read', () => {
    // A copy made meanwhile shifted the pages: r3 comes again.
    const merged = mergeHistoryPage(
      first,
      2,
      document(2, [reuse('r3', '2'), reuse('r2', '3')], [entry('3', {})])
    );
    expect(merged.reuses.map(r => r.id)).toEqual(['r4', 'r3', 'r2']);
    expect(merged.entries.map(e => e.id)).toEqual(['1', '2', '3']);
    expect(merged).toMatchObject({page: 2, more: false});
  });

  it('leaves out deleted entries', () => {
    const merged = mergeHistoryPage(
      null,
      1,
      document(1, [reuse('r1', '9')], [entry('9', {is_deleted: true})])
    );
    expect(merged.entries).toEqual([]);
  });

  it('has no more after an empty page', () => {
    expect(mergeHistoryPage(first, 2, document(1, [])).more).toBe(false);
  });
});
