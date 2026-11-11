import {ThemeProvider} from '@mui/material/styles';
import {act, render, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import invariant from 'invariant';
import {DndProvider} from 'react-dnd';
import {HTML5Backend} from 'react-dnd-html5-backend';
import {I18nextProvider} from 'react-i18next';
import {describe, expect, it, vi} from 'vitest';
import {i18n} from '../../../src/i18n/i18n';
import {Router} from '../../../src/lib/router/Router';
import {signedOutDataCleanedUp} from '../../../src/lib/state/appState';
import {syncSession} from '../../../src/lib/sync/session';
import {EntriesPage} from '../../../src/pages/EntriesPage';
import {darkTheme} from '../../../src/theme/themes';
import {mockResult} from '../../util/mockResult';
import {signIn, TEST_USER} from '../../util/signIn';

let interrupted: ReturnType<typeof observeCookieLogout>;
beforeEach(() => {
  signIn();
  interrupted = observeCookieLogout();
});
afterEach(async () => {
  // This layout fixture supplies no login cookie. Preserve that mount-time
  // sign-out and join its interrupted collection effect before resetting data.
  const {session, flush, syncs, errors} = interrupted;
  expect(session.db.hasBeenClosed()).toBe(true);
  expect(flush).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(syncs).toHaveBeenCalledTimes(1));
  await act(async () => {
    await expect(mockResult(flush)).rejects.toMatchObject({
      name: 'DatabaseClosedError',
    });
    await expect(mockResult(syncs)).rejects.toMatchObject({
      name: 'DatabaseClosedError',
    });
    await signedOutDataCleanedUp();
  });
  expect(errors).toHaveBeenCalledExactlyOnceWith(
    'ERROR: sync failed:',
    expect.objectContaining({name: 'DatabaseClosedError'})
  );
});

function observeCookieLogout() {
  const session = syncSession(TEST_USER);
  return {
    session,
    flush: vi.spyOn(session.sync, 'flush'),
    syncs: vi.spyOn(session.sync, 'syncAll'),
    errors: vi.spyOn(console, 'error'),
  };
}

vi.mock('react-cookie', () => ({
  useCookies: () => [{}, vi.fn(), vi.fn()],
}));

const history = createMemoryHistory();

const EntriesPageWithProviders = () => (
  <I18nextProvider i18n={i18n}>
    <ThemeProvider theme={darkTheme}>
      <Router history={history}>
        <DndProvider backend={HTML5Backend}>
          <EntriesPage />
        </DndProvider>
      </Router>
    </ThemeProvider>
  </I18nextProvider>
);

describe('EntriesPage Holy Grail Layout', () => {
  it('should have a flex column layout filling the viewport', () => {
    const {container} = render(<EntriesPageWithProviders />);

    const mainContainer = container.firstElementChild;
    expect(mainContainer).toBeInTheDocument();

    invariant(
      mainContainer,
      'The main container element (container.firstElementChild) should exist'
    );
    const computedStyles = window.getComputedStyle(mainContainer);
    expect(computedStyles.display).toBe('flex');
    expect(computedStyles.flexDirection).toBe('column');
    expect(computedStyles.minHeight).toBe(`${window.innerHeight}px`);
  });

  it('should render header AppBar with sticky positioning', () => {
    const {container} = render(<EntriesPageWithProviders />);

    const appBars = container.querySelectorAll('.MuiAppBar-root');
    const headerAppBar = appBars[0];

    expect(headerAppBar).toBeInTheDocument();

    invariant(
      headerAppBar,
      'The headerAppBar element (appBars[0]) should exist'
    );
    const computedStyles = window.getComputedStyle(headerAppBar);
    expect(computedStyles.position).toBe('sticky');
    expect(computedStyles.top).toBe('0px');
  });

  it('should render content area with flex layout', () => {
    const {container} = render(<EntriesPageWithProviders />);

    const mainContainer = container.firstElementChild;
    const contentArea = mainContainer?.children[1];

    expect(contentArea).toBeInTheDocument();

    invariant(
      contentArea,
      'The contentArea element (mainContainer.children[1]) should exist'
    );
    const computedStyles = window.getComputedStyle(contentArea);
    expect(computedStyles.display).toBe('flex');
    expect(computedStyles.flex).toBe('1 1 0%');
  });

  it('should render BottomToolbar as last child with marginTop auto', () => {
    const {container} = render(<EntriesPageWithProviders />);

    const mainContainer = container.firstElementChild;
    const lastChild = mainContainer?.lastElementChild;
    expect(lastChild).toBeInTheDocument();
    expect(lastChild?.classList.contains('MuiAppBar-root')).toBe(true);

    invariant(
      lastChild,
      'The lastChild element (mainContainer.lastElementChild) should exist'
    );
    const computedStyles = window.getComputedStyle(lastChild);
    expect(computedStyles.marginTop).toBe('auto');
  });

  it('should maintain layout structure with header, content, and fixed footer', () => {
    const {container} = render(<EntriesPageWithProviders />);

    const mainContainer = container.firstElementChild;
    expect(mainContainer).toBeInTheDocument();
    invariant(mainContainer, 'mainContainer should exist');
    expect(mainContainer.children.length).toBe(3);

    const [header, content, footer] = Array.from(mainContainer.children);
    invariant(header, 'header should exist');
    invariant(content, 'content should exist');
    invariant(footer, 'footer should exist');

    // Check header
    expect(header.classList.contains('MuiAppBar-root')).toBe(true);
    expect(window.getComputedStyle(header).position).toBe('sticky');

    // Check content area
    expect(window.getComputedStyle(content).display).toBe('flex');
    expect(window.getComputedStyle(content).flex).toBe('1 1 0%');

    // Check footer
    expect(footer.classList.contains('MuiAppBar-root')).toBe(true);
    expect(window.getComputedStyle(footer).marginTop).toBe('auto');
  });
});
