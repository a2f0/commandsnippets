/**
 * A new entry, saved from the entry list's editor: stored in the user's
 * IndexedDB database and listed at once, in the tag shown when there is one.
 */
import {TEXT_ENTRY_SUBJECT_MAX_LENGTH} from '@commandsnippets/api-shared';
import {act, cleanup, fireEvent, screen, waitFor} from '@testing-library/react';
import invariant from 'invariant';
import {vi} from 'vitest';
import {syncSession} from '../../src/lib/sync/session';
import {apiClientMethods} from '../util/apiClientMethods';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {serveMockApi} from '../util/msw';
import {observeSyncWork} from '../util/observeSyncWork';
import {signIn, store, TEST_USER} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

serveMockApi();
let finishSync: () => Promise<void>;
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
  finishSync = observeSyncWork(TEST_USER).finish;
  // The mock API announces each request.
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(async () => {
  cleanup();
  await finishSync();
});

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
function storedEntry(subject: string) {
  return act(async () => {
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
  });
}

describe('A new entry', () => {
  it('saved from the untagged entries is stored in no tag, and listed there', async () => {
    await renderAppAt('/test?entries=untagged', {act: true});
    // (The mock API's entries are all in tag 1: the list starts empty.)
    await screen.findByText('test-tag-1');
    const tagEntry = vi.spyOn(apiClientMethods, 'tagEntry');

    await saveNewEntry('fresh-subject');

    expect(await screen.findByText('fresh-subject')).toBeInTheDocument();
    expect(store.entryNew).toBeNull();
    expect(tagEntry).not.toHaveBeenCalled();
    expect((await storedEntry('fresh-subject')).tags).toEqual([]);
  });

  it("saved from a tag's entries is stored in it, and listed there", async () => {
    await renderAppAt('/test/test-tag-1', {act: true});
    await screen.findByText('entry-1-subject');
    const tagEntry = vi.spyOn(apiClientMethods, 'tagEntry');

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

  it('saved twice before it is stored (a double click) is stored once', async () => {
    await renderAppAt('/test?entries=untagged', {act: true});
    await screen.findByText('test-tag-1');

    await saveNewEntry('twice-subject');
    fireEvent.click(byId('textEntryNewTopSave'));

    expect(await screen.findByText('twice-subject')).toBeInTheDocument();
    await waitFor(() => expect(store.entryNew).toBeNull());
    const {db} = syncSession(TEST_USER);
    const stored = await act(async () =>
      db.entries
        .filter(row => row.attributes.subject === 'twice-subject')
        .count()
    );
    expect(stored).toBe(1);
  });

  it('that failed to save stays open, and saves once corrected', async () => {
    await renderAppAt('/test?entries=untagged', {act: true});
    await screen.findByText('test-tag-1');
    const failed = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Longer than a subject may be: refused before anything is stored.
    await saveNewEntry('x'.repeat(TEXT_ENTRY_SUBJECT_MAX_LENGTH + 1));

    await waitFor(() =>
      expect(failed).toHaveBeenCalledWith(
        'Failed to create entry:',
        expect.anything()
      )
    );
    expect(store.entryNew).toBe('textEntry-top');
    // It says why, and keeps what was typed.
    expect(byId('textEntryNewTopError')).toHaveTextContent(/^Not saved: /);
    expect(byId('textEntryNewTopBody')).toHaveValue(
      `${'x'.repeat(TEXT_ENTRY_SUBJECT_MAX_LENGTH + 1)} body`
    );
    fireEvent.change(byId('textEntryNewTopSubject'), {
      target: {value: 'corrected-subject'},
    });
    fireEvent.click(byId('textEntryNewTopSave'));

    expect(await screen.findByText('corrected-subject')).toBeInTheDocument();
    await waitFor(() => expect(store.entryNew).toBeNull());
    expect((await storedEntry('corrected-subject')).entry).toBeDefined();
  });
});
