import {describe, expect, it} from 'vitest';

import {entrySortKey} from '../../../../../src/lib/api/requests/entrySort';
import {defaultState} from '../../../../../src/lib/shared';

describe('entrySortKey', () => {
  it.each([
    'date_updated',
    'subject',
    '-subject',
    'body',
    '-body',
    'date_created',
    '-date_created',
  ])('sends %s, a sort key of the API, as it is', order => {
    expect(entrySortKey(order)).toBe(order);
  });

  it('starts from the default order', () => {
    expect(entrySortKey(defaultState.entrySortOrder)).toBe('date_updated');
  });

  it.each(['order', '-tag_count', 'date_tagged', '', '--body', 'constructor'])(
    'sorts by the default instead of %j, which the API refuses',
    order => {
      expect(entrySortKey(order)).toBe('date_updated');
    }
  );
});
