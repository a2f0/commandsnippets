import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createMemoryHistory} from 'history';
import invariant from 'invariant';
import {HttpResponse, http} from 'msw';
import {setupServer} from 'msw/node';

import type {
  ITagJsonApiResponse,
  ITextEntryJsonApiResponse,
} from '../src/lib/api/responses/types';
import {entriesResponse} from '../test/mocks/entries/entriesResponse';
import {tagsResponse} from '../test/mocks/tags/tagsResponse';
import {assignLoggedInCookie} from './util/assignLoggedInCookie';
import {TestAppRouter} from './util/TestAppRouter';

const response = {
  data: {
    type: 'TagTextEntryThroughModel',
    id: '5',
    attributes: {
      order: 1,
      date_updated: '2022-05-14T02:33:53.995003',
      date_created: '2022-05-14T02:33:53.994989',
    },
    relationships: {
      tag: {
        data: {
          type: 'test-tag-2',
          id: '2',
        },
      },
      text_entry: {
        data: {
          type: 'TextEntry',
          id: '1',
        },
      },
      user: {
        data: {
          type: 'User',
          id: '1',
        },
      },
    },
  },
  included: [],
};

const server = setupServer(
  http.get('http://localhost:9001/api/v1/tags', () => {
    return HttpResponse.json<ITagJsonApiResponse>(tagsResponse, {status: 200});
  }),
  http.get('http://localhost:9001/api/v1/entries', () => {
    return HttpResponse.json<ITextEntryJsonApiResponse>(entriesResponse, {
      status: 200,
    });
  }),
  http.post('http://localhost:9001/api/v1/tags_entries', () => {
    return HttpResponse.json(response, {
      status: 200,
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => assignLoggedInCookie());

describe('Tag An Entry', () => {
  it('Is Taggable', async () => {
    const user = userEvent.setup();
    const history = createMemoryHistory();
    const route = '/test/test-tag-1';
    history.push(route);
    const {rerender} = render(<TestAppRouter history={history} />);
    expect(history.location.pathname).toBe('/test/test-tag-1');
    await waitFor(() => screen.getByText(/entry-1-subject/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/entry-1-body/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/entry-2-subject/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/entry-2-body/i), {timeout: 3000});
    expect(history.location.pathname).toBe('/test/test-tag-1');
    const entries = screen.getAllByRole('entry');
    expect(entries).toHaveLength(4);
    expect(entries[0]).toHaveTextContent('entry-1-subject');
    expect(entries[0]).toHaveTextContent('entry-1-body');
    expect(entries[1]).toHaveTextContent('entry-2-subject');
    expect(entries[1]).toHaveTextContent('entry-2-body');
    expect(entries[2]).toHaveTextContent('entry-3-subject');
    expect(entries[2]).toHaveTextContent('entry-3-body');
    expect(entries[3]).toHaveTextContent('entry-4-subject');
    expect(entries[3]).toHaveTextContent('entry-4-body');

    let tagLabelWrappers = screen.getAllByRole('tagLabelWrapper');
    expect(tagLabelWrappers).toHaveLength(4);
    invariant(tagLabelWrappers[1], 'tagLabelWrapper is undefined');
    await user.pointer({target: tagLabelWrappers[1], keys: '[MouseLeft]'});
    expect(history.location.pathname).toBe('/test/test-tag-2');
    rerender(<TestAppRouter history={history} />);
    await waitFor(
      () => expect(screen.queryAllByRole('entry')).toHaveLength(0),
      {timeout: 3000}
    );
    tagLabelWrappers = screen.getAllByRole('tagLabelWrapper');
    expect(tagLabelWrappers).toHaveLength(4);
    invariant(tagLabelWrappers[0], 'tagLabelWrapper is undefined');
    await user.pointer({target: tagLabelWrappers[0], keys: '[MouseLeft]'});
    expect(history.location.pathname).toBe('/test/test-tag-1');

    rerender(<TestAppRouter history={history} />);
    await waitFor(
      () => expect(screen.queryAllByRole('entry')).toHaveLength(4),
      {timeout: 3000}
    );
    const entryDragHandleContainers = screen.getAllByRole(
      'entryDragHandleContainer'
    );
    expect(entryDragHandleContainers).toHaveLength(4);
    invariant(
      entryDragHandleContainers[0],
      'entryDragHandleContainer is undefined'
    );
    await user.pointer({target: entryDragHandleContainers[0]});
    const tags = screen.getAllByRole('tag');
    expect(tags).toHaveLength(4);
    const entryDragHandle = screen.getByRole('entryDragHandle');
    await act(async () => {
      fireEvent.dragStart(entryDragHandle);
      invariant(tags[1], 'tag is undefined');
      fireEvent.dragEnter(tags[1]);
      fireEvent.dragOver(tags[1]);
      await new Promise(res => setTimeout(res, 0));
      fireEvent.drop(tags[1]);
    });
    tagLabelWrappers = screen.getAllByRole('tagLabelWrapper');
    expect(tagLabelWrappers).toHaveLength(4);
    invariant(tagLabelWrappers[1], 'tagLabelWrapper is undefined');
    await user.pointer({target: tagLabelWrappers[1], keys: '[MouseLeft]'});
    expect(history.location.pathname).toBe('/test/test-tag-2');
    rerender(<TestAppRouter history={history} />);
    await waitFor(
      () => expect(screen.queryAllByRole('entry')).toHaveLength(1),
      {timeout: 3000}
    );
    invariant(tags[1], 'tag is undefined');
  });
});
