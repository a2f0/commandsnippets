/**
 * Selecting a tag lists its entries from the store at once. They are synced
 * in the background only when the tag's revision (from the tags sync) is
 * newer than the one they were last synced at, and listed again only when
 * that sync changed them.
 */
import type {TextEntry} from '@commandsnippets/api-shared';
import {act, render, screen, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import invariant from 'invariant';
import {applySnapshot} from 'mobx-state-tree';
import {HttpResponse, http} from 'msw';
import {vi} from 'vitest';
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
