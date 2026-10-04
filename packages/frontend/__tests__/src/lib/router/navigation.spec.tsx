import {act, fireEvent, render, screen} from '@testing-library/react';
import {createMemoryHistory, type MemoryHistory} from 'history';
import {describe, expect, it, vi} from 'vitest';
import {createBrowserHistory} from '../../../../src/lib/router/history';
import {
  currentRoute,
  navigate,
  useRouteParam,
  useSearchParam,
} from '../../../../src/lib/router/navigation';
import {Link, Navigate, Router} from '../../../../src/lib/router/Router';

/** Renders of each reader below, by what it reads. */
const renders = {user: 0, tag: 0, entries: 0};

const UserReader = () => {
  renders.user += 1;
  return <span data-testid="user">{useRouteParam('user')}</span>;
};
const TagReader = () => {
  renders.tag += 1;
  return <span data-testid="tag">{useRouteParam('tag')}</span>;
};
const EntriesReader = () => {
  renders.entries += 1;
  return <span data-testid="entries">{useSearchParam('entries')}</span>;
};

function renderAt(route: string, children = <></>): MemoryHistory {
  const history = createMemoryHistory({initialEntries: [route]});
  renders.user = 0;
  renders.tag = 0;
  renders.entries = 0;
  render(
    <Router history={history}>
      <UserReader />
      <TagReader />
      <EntriesReader />
      {children}
    </Router>
  );
  return history;
}

describe('reading the route', () => {
  it('renders a reader again only when what it reads changes', () => {
    renderAt('/test/shell');
    expect(screen.getByTestId('user')).toHaveTextContent('test');
    expect(screen.getByTestId('tag')).toHaveTextContent('shell');

    act(() => navigate('/test/docker'));

    expect(screen.getByTestId('tag')).toHaveTextContent('docker');
    expect(renders).toEqual({user: 1, tag: 2, entries: 1});

    act(() => navigate('/test?entries=all'));

    expect(screen.getByTestId('tag')).toBeEmptyDOMElement();
    expect(screen.getByTestId('entries')).toHaveTextContent('all');
    expect(renders).toEqual({user: 1, tag: 3, entries: 2});
  });

  it('reads the route now, without rendering', () => {
    renderAt('/test/shell');
    act(() => navigate('/alice'));
    expect(currentRoute()).toEqual({page: 'user', user: 'alice'});
  });
});

describe('navigate', () => {
  it('adds a history entry, or replaces the current one', () => {
    const history = renderAt('/test/shell');

    act(() => navigate('/test/docker'));
    expect(history.index).toBe(1);

    act(() => navigate('/test/git', {replace: true}));
    expect(history.index).toBe(1);
    expect(history.location.pathname).toBe('/test/git');
  });

  it('follows Back', () => {
    const history = renderAt('/test/shell');
    act(() => navigate('/test/docker'));

    act(() => history.back());

    expect(screen.getByTestId('tag')).toHaveTextContent('shell');
  });
});

describe('Navigate', () => {
  it('goes elsewhere once rendered, in place of the entry', () => {
    const history = renderAt('/nowhere/a/b', <Navigate to="/" replace />);

    expect(history.location.pathname).toBe('/');
    expect(history.index).toBe(0);
  });
});

describe('Link', () => {
  const renderLink = (onClick?: (event: React.MouseEvent) => void) =>
    renderAt(
      '/test/shell',
      <Link to="/admin" onClick={onClick}>
        Admin
      </Link>
    );

  it('goes to its path on a plain click', () => {
    const history = renderLink();
    const link = screen.getByRole('link', {name: 'Admin'});
    expect(link).toHaveAttribute('href', '/admin');

    fireEvent.click(link);

    expect(history.location.pathname).toBe('/admin');
    expect(history.index).toBe(1);
  });

  it('leaves a click to open elsewhere to the browser', () => {
    const history = renderLink();

    fireEvent.click(screen.getByRole('link', {name: 'Admin'}), {
      ctrlKey: true,
    });

    expect(history.location.pathname).toBe('/test/shell');
  });

  it('stays when its onClick prevents the default', () => {
    const history = renderLink(event => event.preventDefault());

    fireEvent.click(screen.getByRole('link', {name: 'Admin'}));

    expect(history.location.pathname).toBe('/test/shell');
  });

  it('replaces the entry when it is there already', () => {
    const history = renderAt('/admin', <Link to="/admin">Admin</Link>);

    fireEvent.click(screen.getByRole('link', {name: 'Admin'}));

    expect(history.index).toBe(0);
  });
});

describe('the browser history', () => {
  it('changes the URL, and tells of Back and Forward', () => {
    const history = createBrowserHistory();
    const listener = vi.fn();
    const unlisten = history.listen(listener);

    history.push('/test/shell?entries=all');
    expect(window.location.pathname).toBe('/test/shell');
    expect(history.location).toEqual({
      pathname: '/test/shell',
      search: '?entries=all',
    });
    history.replace('/test/docker');
    expect(listener).toHaveBeenCalledTimes(2);

    window.history.pushState(null, '', '/test/git');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(history.location.pathname).toBe('/test/git');
    expect(listener).toHaveBeenCalledTimes(3);
    unlisten();
    window.history.replaceState(null, '', '/');
  });
});
