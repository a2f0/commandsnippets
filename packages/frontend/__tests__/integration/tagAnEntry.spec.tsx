import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import invariant from 'invariant';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {serveMockApi} from '../util/msw';
import {signIn} from '../util/signIn';
import {renderAppAt, TestAppRouter} from '../util/TestAppRouter';

// The mock API tags entry 1 with test-tag-2 as the API would.
serveMockApi();
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
});

describe('Tag An Entry', () => {
  it('Is Taggable', async () => {
    const user = userEvent.setup();
    const {history, rerender} = renderAppAt('/test/test-tag-1');
    expect(history.location.pathname).toBe('/test/test-tag-1');
    await waitFor(() => screen.getByText(/entry-1-subject/i));
    await waitFor(() => screen.getByText(/entry-1-body/i));
    await waitFor(() => screen.getByText(/entry-2-subject/i));
    await waitFor(() => screen.getByText(/entry-2-body/i));
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
    await waitFor(() => expect(screen.queryAllByRole('entry')).toHaveLength(0));
    tagLabelWrappers = screen.getAllByRole('tagLabelWrapper');
    expect(tagLabelWrappers).toHaveLength(4);
    invariant(tagLabelWrappers[0], 'tagLabelWrapper is undefined');
    await user.pointer({target: tagLabelWrappers[0], keys: '[MouseLeft]'});
    expect(history.location.pathname).toBe('/test/test-tag-1');

    rerender(<TestAppRouter history={history} />);
    await waitFor(() => expect(screen.queryAllByRole('entry')).toHaveLength(4));
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
    await waitFor(() => expect(screen.queryAllByRole('entry')).toHaveLength(1));
    invariant(tags[1], 'tag is undefined');
  });
});
