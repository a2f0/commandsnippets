/** The tag shown, and the one the tag list highlights. */
import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import invariant from 'invariant';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {serveMockApi} from '../util/msw';
import {signIn, store} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

serveMockApi();
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
});

/** The element `#id`, which must be rendered. */
function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  invariant(element, `#${id} is rendered`);
  return element;
}

const highlighted = () =>
  screen
    .getAllByRole('tag')
    .filter(tag => tag.getAttribute('aria-current') === 'true')
    .map(tag => tag.id);

describe('The tag list', () => {
  it('highlights the tag selected, as Back and Forward change it', async () => {
    renderAppAt('/test/test-tag-1');
    await screen.findByText('test-tag-2');
    act(() => store.setTagSelectedID('1'));
    await waitFor(() => expect(highlighted()).toEqual(['tag-1']));

    act(() => store.setTagSelectedID('2'));

    await waitFor(() => expect(highlighted()).toEqual(['tag-2']));
  });

  it('follows the tag shown to its new name', async () => {
    const {history} = renderAppAt('/test/test-tag-1');
    await waitFor(() =>
      expect(screen.getAllByRole('entry').length).toBeGreaterThan(0)
    );
    const entries = screen.getAllByRole('entry').length;

    fireEvent.contextMenu(screen.getByText('test-tag-1'));
    fireEvent.click(await waitFor(() => byId('tag-context-menu-1-edit-tag')));
    fireEvent.change(byId('tagEditTagName1'), {target: {value: 'renamed'}});
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(history.location.pathname).toBe('/test/renamed')
    );
    expect(await screen.findByText('renamed')).toBeInTheDocument();
    expect(screen.getAllByRole('entry')).toHaveLength(entries);
  });
});
