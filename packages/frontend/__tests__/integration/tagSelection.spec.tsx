/** The tag shown, and the one the tag list highlights. */
import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import invariant from 'invariant';
import {vi} from 'vitest';
import * as saving from '../../src/hooks/useSaveError';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {serveMockApi} from '../util/msw';
import {observeSyncWork} from '../util/observeSyncWork';
import {signIn, store, TEST_USER} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

serveMockApi();
let syncWork: ReturnType<typeof observeSyncWork>;
// Finish the mounted fixture before MSW removes its handlers and DB reset.
afterEach(async () => {
  await syncWork.finish();
  expect(syncWork.syncAll).toHaveBeenCalledTimes(1);
});
beforeEach(() => {
  signIn();
  syncWork = observeSyncWork(TEST_USER);
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
    const saves: Promise<void>[] = [];
    const useSaveError = saving.useSaveError;
    vi.spyOn(saving, 'useSaveError').mockImplementation(what => {
      const state = useSaveError(what);
      return {
        ...state,
        save: (...args) => {
          const promise = state.save(...args);
          saves.push(promise);
          return promise;
        },
      };
    });
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
    // The save includes the post-persistence route correction, not just its write.
    expect(saves).toHaveLength(1);
    await act(async () => {
      await Promise.all(saves);
    });
  });
});
