import {CODES, DATA_ACCESS_HEADER} from '@commandsnippets/api-shared';
import {CURSOR_START} from '@commandsnippets/api-shared/cursor';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {publicSyncApi} from '../../../../src/lib/api/publicApi';
import {PublicViewChangedError} from '../../../../src/lib/sync/publicView';
import {errorDocument, onePage} from '../../../../src/msw/documents';

const API = 'http://localhost:9001/api/v1/users/alice';

/** Answer every fetch with `status` and `body` (a string as it is). */
const reply = (status: number, body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
      })
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe('publicSyncApi', () => {
  // The sync's reads, of the owner's public routes.
  const after = encodeURIComponent(CURSOR_START);
  const keyset = {links: {next: null}, data: []};
  const numbered = (path: string) => ({
    ...onePage(`${API}${path}`, 0),
    data: [],
  });
  const reads: Array<[string, () => Promise<unknown>, string, unknown]> = [
    [
      'getTagsAfter',
      () => publicSyncApi('alice').getTagsAfter(CURSOR_START),
      `${API}/tags?page%5Bafter%5D=${after}&page%5Bsize%5D=100`,
      keyset,
    ],
    [
      'getEntriesAfter',
      () => publicSyncApi('alice').getEntriesAfter(CURSOR_START),
      `${API}/entries?page%5Bafter%5D=${after}&page%5Bsize%5D=100` +
        '&include=text_entry_to_tag',
      keyset,
    ],
    [
      'getEntryCount',
      () => publicSyncApi('alice').getEntryCount(),
      `${API}/entries?page%5Bsize%5D=1`,
      numbered('/entries'),
    ],
    [
      'getTagJunctionsAfter',
      () => publicSyncApi('alice').getTagJunctionsAfter('5', CURSOR_START),
      `${API}/tags_entries?filter%5Btag.id%5D=5&page%5Bafter%5D=${after}` +
        '&page%5Bsize%5D=100&include=text_entry%2Ctext_entry.text_entry_to_tag',
      keyset,
    ],
    [
      'getNewestJunction',
      () => publicSyncApi('alice').getNewestJunction(),
      `${API}/tags_entries?sort=-date_updated&page%5Bsize%5D=1`,
      numbered('/tags_entries'),
    ],
  ];

  it.each(reads)(
    '%s reads its page with public access pinned',
    async (_name, call, url, body) => {
      const fetchSpy = reply(200, body);
      await call();
      const [requested, init] = fetchSpy.mock.calls[0] ?? [];
      expect(requested).toBe(url);
      expect(new Headers(init?.headers).get(DATA_ACCESS_HEADER)).toBe('public');
    }
  );

  it('restarts on a 409 view_changed', async () => {
    reply(409, errorDocument(409, CODES.viewChanged, 'The view changed.'));
    const read = publicSyncApi('alice').getTagsAfter(CURSOR_START);
    await expect(read).rejects.toBeInstanceOf(PublicViewChangedError);
    await expect(read).rejects.toMatchObject({restart: true});
  });

  it('fails a 409 whose body is not JSON as a request, not a parse', async () => {
    // A proxy's page, say: neither a view change nor a SyntaxError.
    reply(409, '<h1>Conflict</h1>');
    const read = publicSyncApi('alice').getTagsAfter(CURSOR_START);
    await expect(read).rejects.toThrow(
      new Error('Public data request failed: 409')
    );
    await expect(read).rejects.not.toBeInstanceOf(SyntaxError);
    await expect(read).rejects.not.toBeInstanceOf(PublicViewChangedError);
  });

  it('reads a 404 as a view no longer available', async () => {
    reply(404, '');
    const read = publicSyncApi('alice').getTagsAfter(CURSOR_START);
    await expect(read).rejects.toBeInstanceOf(PublicViewChangedError);
    await expect(read).rejects.toMatchObject({restart: false});
  });
});
