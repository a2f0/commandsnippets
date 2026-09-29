/**
 * Selecting a tag lists its entries from the store at once. They are synced
 * in the background only when the tag's revision (from the tags sync) is
 * newer than the one they were last synced at, and listed again only when a
 * sync changed them. The tags are synced again when the app comes back into
 * view.
 */
import type {TagTextEntry, TextEntry} from '@commandsnippets/api-shared';
import {act, render, screen, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import invariant from 'invariant';
import {applySnapshot} from 'mobx-state-tree';
import {HttpResponse, http} from 'msw';
import {vi} from 'vitest';
import {TAGS_REFRESH_INTERVAL_MS} from '../../src/components/tags/TagListWrapper';
import {apiClient} from '../../src/lib/api/apiClient';
import {defaultState} from '../../src/lib/shared';
import {onePage} from '../../src/msw/documents';
import {entriesResponse} from '../../test/mocks/entries/entriesResponse';
import {tagsResponse} from '../../test/mocks/tags/tagsResponse';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {store} from '../util/loggedInStore';
import {server} from '../util/msw';
import {TestAppRouter} from '../util/TestAppRouter';

const API = 'http://localhost:9001/api/v1';

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());
beforeEach(() => {
  assignLoggedInCookie();
  applySnapshot(store, {...defaultState, loggedInUser: 'test'});
});

/** Give the background syncs time to run. */
function settle() {
  return new Promise(resolve => setTimeout(resolve, 50));
}

/** A promise, and the function that settles it. */
function gate() {
  let open = () => {};
  const opened = new Promise<void>(resolve => {
    open = resolve;
  });
  return {open, opened};
}

const [fixtureTag1, fixtureTag2] = tagsResponse.data;
const [fixtureEntry1] = entriesResponse.data;
const fixtureJunction1 = entriesResponse.included?.find(
  (resource): resource is TagTextEntry =>
    resource.type === 'TagTextEntryThroughModel' && resource.id === '1'
);
invariant(
  fixtureTag1 && fixtureTag2 && fixtureEntry1 && fixtureJunction1,
  'the fixtures hold them'
);

/** Entry 1, edited elsewhere at `2030-01-01`. */
const editedEntry1: TextEntry = {
  ...fixtureEntry1,
  attributes: {
    ...fixtureEntry1.attributes,
    subject: 'entry-1-edited',
    date_updated: '2030-01-01T00:00:00',
  },
};

/** GET /tags answering with `tags`, each at revision `2030-01-01`. */
const tagsAdvanced = (...tags: (typeof tagsResponse.data)[number][]) =>
  http.get(`${API}/tags`, ({request}) =>
    HttpResponse.json({
      ...onePage(request.url, tags.length),
      data: tags.map(tag => ({
        ...tag,
        attributes: {...tag.attributes, date_updated: '2030-01-01T00:00:00'},
      })),
    })
  );

describe('Selecting a tag', () => {
  it('lists a synced tag from the store without a request', async () => {
    const history = createMemoryHistory();
    history.push('/test/test-tag-1');
    const {rerender} = render(<TestAppRouter history={history} />);
    const show = (route: string) =>
      act(() => {
        history.push(route);
        rerender(<TestAppRouter history={history} />);
      });
    await screen.findByText('entry-1-subject');
    const getEntries = vi.spyOn(apiClient, 'getEntries');

    // Another tag, never synced: it is.
    show('/test/test-tag-2');
    await waitFor(() => expect(getEntries).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByText('entry-1-subject')).not.toBeInTheDocument()
    );

    // Back to the first: listed at once, and not asked for again.
    show('/test/test-tag-1');
    expect(screen.getAllByRole('entry')).toHaveLength(4);
    await settle();
    expect(getEntries).toHaveBeenCalledTimes(1);
  });

  it('lists a first sync that finishes after the list is shown again', async () => {
    let release = () => {};
    const released = new Promise<void>(resolve => {
      release = resolve;
    });
    server.use(
      http.get(`${API}/entries`, async () => {
        await released;
        return HttpResponse.json(entriesResponse);
      })
    );
    const history = createMemoryHistory();
    history.push('/test/test-tag-1');
    const {rerender} = render(<TestAppRouter history={history} />);
    await waitFor(() =>
      expect(store.findTag('test', 'test-tag-1')).toBeDefined()
    );

    // The tag list navigates to the tag it selects once the tags load: the
    // list is shown again while the tag's first sync runs.
    act(() => {
      history.push('/test/test-tag-1');
      rerender(<TestAppRouter history={history} />);
    });
    release();

    expect(await screen.findAllByRole('entry')).toHaveLength(4);
  });

  it('syncs the listed tag when the tags sync brings a newer revision, listing what changed', async () => {
    const history = createMemoryHistory();
    history.push('/test/test-tag-1');
    render(<TestAppRouter history={history} />);
    await screen.findByText('entry-1-subject');
    await settle();

    // Entry 1 was edited elsewhere, which advanced its tag.
    const [tag] = tagsResponse.data;
    const [entry] = entriesResponse.data;
    const junction = entriesResponse.included?.find(
      resource =>
        resource.type === 'TagTextEntryThroughModel' && resource.id === '1'
    );
    invariant(tag && entry && junction, 'the fixtures hold them');
    const edited: TextEntry = {
      ...entry,
      attributes: {
        ...entry.attributes,
        subject: 'entry-1-edited',
        date_updated: '2030-01-01T00:00:00',
      },
    };
    server.use(
      http.get(`${API}/tags`, ({request}) =>
        HttpResponse.json({
          ...onePage(request.url, 1),
          data: [
            {
              ...tag,
              attributes: {
                ...tag.attributes,
                date_updated: '2030-01-01T00:00:00',
              },
            },
          ],
        })
      ),
      http.get(`${API}/entries`, ({request}) =>
        HttpResponse.json({
          ...onePage(request.url, 1),
          data: [edited],
          included: [junction],
        })
      )
    );
    const getEntries = vi.spyOn(apiClient, 'getEntries');

    await act(() => store.fetchTags('test'));

    await screen.findByText('entry-1-edited');
    expect(getEntries).toHaveBeenCalledTimes(1);
    expect(getEntries.mock.calls[0]?.[0]).toMatchObject({
      'filter[tags.id]': 1,
      'filter[date_updated.gt]': '2021-03-19T18:20:00',
    });
    expect(screen.getAllByRole('entry')).toHaveLength(4);
  });

  it('syncs the tags again when the app comes back into view, then the tag shown', async () => {
    const history = createMemoryHistory();
    history.push('/test/test-tag-1');
    render(<TestAppRouter history={history} />);
    await screen.findByText('entry-1-subject');
    await settle();
    server.use(
      tagsAdvanced(fixtureTag1),
      http.get(`${API}/entries`, ({request}) =>
        HttpResponse.json({
          ...onePage(request.url, 1),
          data: [editedEntry1],
          included: [fixtureJunction1],
        })
      )
    );
    const getTags = vi.spyOn(apiClient, 'getTags');

    // Straight back: nothing is asked.
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(getTags).not.toHaveBeenCalled();

    // Back after a while: the tags changed since the last sync are read, and
    // the tag shown moved, so its changes are read and listed.
    const now = vi
      .spyOn(Date, 'now')
      .mockReturnValue(store.tagsSyncedAt + TAGS_REFRESH_INTERVAL_MS);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    now.mockRestore();

    await screen.findByText('entry-1-edited');
    expect(getTags).toHaveBeenCalledTimes(1);
    expect(getTags.mock.calls[0]?.[0]).toMatchObject({
      'filter[date_updated.gt]': '2022-05-08T18:20:00',
    });
  });

  it('lists a change another tag sharing its entry stored after it was shown', async () => {
    // Entry 1 is in test-tag-2 as well, by junction 5.
    const junction5: TagTextEntry = {
      ...fixtureJunction1,
      id: '5',
      relationships: {
        ...fixtureJunction1.relationships,
        tag: {data: {type: 'Tag', id: '2'}},
      },
    };
    const inBoth = (entry: TextEntry): TextEntry => ({
      ...entry,
      relationships: {
        ...entry.relationships,
        text_entry_to_tag: {
          data: [
            {type: 'TagTextEntryThroughModel', id: '1'},
            {type: 'TagTextEntryThroughModel', id: '5'},
          ],
          meta: {count: 2},
        },
      },
    });
    const tag2 = {
      ...fixtureTag2,
      attributes: {...fixtureTag2.attributes, entry_count: 1},
    };
    server.use(
      http.get(`${API}/tags`, ({request}) =>
        HttpResponse.json({
          ...onePage(request.url, 2),
          data: [fixtureTag1, tag2],
          included: tagsResponse.included,
        })
      ),
      http.get(`${API}/entries`, ({request}) => {
        const tagId = new URL(request.url).searchParams.get('filter[tags.id]');
        return HttpResponse.json(
          tagId === '2'
            ? {
                ...onePage(request.url, 1),
                data: [inBoth(fixtureEntry1)],
                included: [fixtureJunction1, junction5],
              }
            : {
                ...entriesResponse,
                data: entriesResponse.data.map(entry =>
                  entry.id === '1' ? inBoth(entry) : entry
                ),
                included: [...(entriesResponse.included ?? []), junction5],
              }
        );
      })
    );
    const history = createMemoryHistory();
    history.push('/test/test-tag-2');
    const {rerender} = render(<TestAppRouter history={history} />);
    const show = (route: string) =>
      act(() => {
        history.push(route);
        rerender(<TestAppRouter history={history} />);
      });
    await screen.findByText('entry-1-subject');
    show('/test/test-tag-1');
    await waitFor(() => expect(screen.getAllByRole('entry')).toHaveLength(4));
    show('/test/test-tag-2');
    await settle();

    // Entry 1 was edited elsewhere: both tags advanced. Each tag's changes
    // come back when let through.
    const gates = {'1': gate(), '2': gate()};
    server.use(
      tagsAdvanced(fixtureTag1, tag2),
      http.get(`${API}/entries`, async ({request}) => {
        const tagId = new URL(request.url).searchParams.get('filter[tags.id]');
        invariant(tagId === '1' || tagId === '2', 'a tag sync');
        await gates[tagId].opened;
        return HttpResponse.json({
          ...onePage(request.url, 1),
          data: [inBoth(editedEntry1)],
          included: [fixtureJunction1, junction5],
        });
      })
    );
    // test-tag-2, shown, starts its sync; then test-tag-1 is shown (the
    // entry as the store holds it) and starts its own.
    await act(() => store.fetchTags('test'));
    show('/test/test-tag-1');
    expect(screen.getByText('entry-1-subject')).toBeInTheDocument();

    // test-tag-2's sync stores the edit; test-tag-1's then finds it stored.
    gates['2'].open();
    await waitFor(() =>
      expect(
        store.textEntriesArray.find(entry => entry.id === '1')?.attributes
          .subject
      ).toBe('entry-1-edited')
    );
    gates['1'].open();

    await screen.findByText('entry-1-edited');
  });

  it('shows a tag the tags sync brings a newer revision of', async () => {
    const history = createMemoryHistory();
    history.push('/test/test-tag-1');
    render(<TestAppRouter history={history} />);
    await screen.findByText('test-tag-2');

    const renamed = tagsResponse.data[1];
    invariant(renamed, 'the fixture holds it');
    server.use(
      http.get(`${API}/tags`, ({request}) =>
        HttpResponse.json({
          ...onePage(request.url, 1),
          data: [
            {
              ...renamed,
              attributes: {
                ...renamed.attributes,
                name: 'renamed-elsewhere',
                date_updated: '2030-01-01T00:00:00',
              },
            },
          ],
        })
      )
    );
    await act(() => store.fetchTags('test'));

    await screen.findByText('renamed-elsewhere');
    expect(screen.queryByText('test-tag-2')).not.toBeInTheDocument();
  });
});
