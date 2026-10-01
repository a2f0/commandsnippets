/**
 * A new entry, saved from the entry list's editor: stored in the user's
 * IndexedDB database and listed at once, in the tag shown when there is one.
 */
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import invariant from 'invariant';
import {vi} from 'vitest';
import {apiClient} from '../../src/lib/api/apiClient';
import {syncSession} from '../../src/lib/sync/session';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {signIn, store, TEST_USER} from '../util/signIn';
import {TestAppRouter} from '../util/TestAppRouter';

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
  // The mock API announces each request.
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

function renderAt(route: string) {
  const history = createMemoryHistory();
  history.push(route);
  render(<TestAppRouter history={history} />);
}

/** The element `#id`, which must be rendered. */
function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  invariant(element, `#${id} is rendered`);
  return element;
}

/** Open the editor at the top of the list, and save `subject`. */
async function saveNewEntry(subject: string) {
  act(() => store.setEntryNew('textEntry-top'));
  fireEvent.change(await waitFor(() => byId('textEntryNewTopSubject')), {
    target: {value: subject},
  });
  fireEvent.change(byId('textEntryNewTopBody'), {
    target: {value: `${subject} body`},
  });
  fireEvent.click(byId('textEntryNewTopSave'));
}

/** The stored entry with `subject`, and the tags it is in. */
async function storedEntry(subject: string) {
  const {db} = syncSession(TEST_USER);
  const entry = await db.entries
    .filter(stored => stored.attributes.subject === subject)
    .first();
  invariant(entry, `${subject} is stored`);
  const junctions = await db.junctions
    .where('[owner+relationships.text_entry.data.id]')
    .equals([TEST_USER, entry.id])
    .toArray();
  return {
    entry,
    tags: junctions.map(({relationships}) => relationships.tag.data.id),
  };
}

describe('A new entry', () => {
  it('saved from the untagged entries is stored in no tag, and listed there', async () => {
    renderAt('/test?entries=untagged');
    // (The mock API's entries are all in tag 1: the list starts empty.)
    await screen.findByText('test-tag-1');
    const tagEntry = vi.spyOn(apiClient, 'tagEntry');

    await saveNewEntry('fresh-subject');

    expect(await screen.findByText('fresh-subject')).toBeInTheDocument();
    expect(store.entryNew).toBeNull();
    expect(tagEntry).not.toHaveBeenCalled();
    expect((await storedEntry('fresh-subject')).tags).toEqual([]);
  });

  it("saved from a tag's entries is stored in it, and listed there", async () => {
    renderAt('/test/test-tag-1');
    await screen.findByText('entry-1-subject');
    const tagEntry = vi.spyOn(apiClient, 'tagEntry');

    await saveNewEntry('tagged-subject');

    expect(await screen.findByText('tagged-subject')).toBeInTheDocument();
    expect(store.entryNew).toBeNull();
    // The queue sends the entry, then tags it with the API's id for it.
    await waitFor(() => expect(tagEntry).toHaveBeenCalled());
    const [, entryId] = tagEntry.mock.calls[0] ?? [];
    expect(tagEntry).toHaveBeenCalledWith('1', entryId, expect.any(String));
    await waitFor(async () =>
      expect((await storedEntry('tagged-subject')).entry.id).toBe(entryId)
    );
    expect((await storedEntry('tagged-subject')).tags).toEqual(['1']);
  });
});
