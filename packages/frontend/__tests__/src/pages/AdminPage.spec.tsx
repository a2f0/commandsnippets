import {CODES} from '@commandsnippets/api-shared';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {HttpResponse, http} from 'msw';
import {setupServer} from 'msw/node';

import {errorDocument, onePage, pagination} from '../../../src/msw/documents';
import {assignLoggedInCookie} from '../../util/assignLoggedInCookie';
import {signIn, store} from '../../util/signIn';
import {TestAppRouter} from '../../util/TestAppRouter';

const API = 'http://localhost:9001/api/v1';

interface MockUser {
  id: string;
  username: string;
  email: string;
  is_staff: boolean;
  is_active: boolean;
}

let viewerIsStaff = true;
let adminForbidden = false;
let users: MockUser[] = [];
let listRequests: URLSearchParams[] = [];
let patches: unknown[] = [];

const resource = (user: MockUser) => ({
  type: 'AdminUser',
  id: user.id,
  attributes: {
    username: user.username,
    email: user.email,
    first_name: '',
    last_name: '',
    is_staff: user.is_staff,
    is_active: user.is_active,
    date_joined: '2026-01-02T03:04:05.000000',
    last_login: user.is_active ? '2026-09-01T00:00:00.000000' : null,
    last_active: user.is_active ? '2026-09-02T00:00:00.000000' : null,
    login_count: 4,
    date_updated: '2026-09-01T00:00:00.000000',
    entry_count: 12,
    tag_count: 3,
  },
});

const forbidden = () =>
  HttpResponse.json(
    errorDocument(
      403,
      CODES.permissionDenied,
      'You do not have permission to perform this action.'
    ),
    {status: 403}
  );

const server = setupServer(
  http.get(`${API}/user/`, () =>
    HttpResponse.json({
      data: {
        type: 'User',
        id: '1',
        attributes: {
          username: 'test',
          is_staff: viewerIsStaff,
          date_updated: '2026-09-01T00:00:00.000000',
        },
      },
    })
  ),
  http.get(`${API}/admin/users`, ({request}) => {
    if (adminForbidden) {
      return forbidden();
    }
    const params = new URL(request.url).searchParams;
    listRequests.push(params);
    const search = params.get('filter[search]')?.toLowerCase();
    const active = params.get('filter[is_active]');
    const matching = users.filter(
      user =>
        (search === undefined ||
          user.username.includes(search) ||
          user.email.includes(search)) &&
        (active === null || String(user.is_active) === active)
    );
    const size = Number(params.get('page[size]') ?? '25');
    const number = Number(params.get('page[number]') ?? '1');
    const pages = Math.max(1, Math.ceil(matching.length / size));
    if (number > pages) {
      return HttpResponse.json(
        errorDocument(404, CODES.notFound, 'Invalid page.'),
        {status: 404}
      );
    }
    return HttpResponse.json({
      ...pagination(request.url, number, pages, matching.length),
      data: matching.slice((number - 1) * size, number * size).map(resource),
    });
  }),
  http.patch(`${API}/admin/users/:id`, async ({params, request}) => {
    const body = await request.json();
    patches.push(body);
    const user = users.find(candidate => candidate.id === params['id']);
    if (user === undefined) {
      return HttpResponse.json(
        errorDocument(
          404,
          CODES.notFound,
          'No AdminUser matches the given query.'
        ),
        {status: 404}
      );
    }
    user.is_active = !user.is_active;
    return HttpResponse.json({data: resource(user)});
  }),
  http.get(`${API}/admin/audit_log`, ({request}) =>
    HttpResponse.json({
      ...onePage(request.url, 1),
      data: [
        {
          type: 'AdminAuditLogEntry',
          id: '9',
          attributes: {
            created: '2026-09-28T12:00:00.000000',
            action: 'deactivate_user',
            actor_id: '1',
            actor_username: 'test',
            target_user_id: '7',
            target_username: 'alice',
          },
        },
      ],
    })
  )
);

beforeAll(() => server.listen());
afterAll(() => server.close());

beforeEach(() => {
  signIn();
  assignLoggedInCookie();
  viewerIsStaff = true;
  adminForbidden = false;
  listRequests = [];
  patches = [];
  users = [
    {
      id: '1',
      username: 'test',
      email: 'test@example.com',
      is_staff: true,
      is_active: true,
    },
    {
      id: '7',
      username: 'alice',
      email: 'alice@example.com',
      is_staff: false,
      is_active: true,
    },
  ];
});

afterEach(() => {
  server.resetHandlers();
});

async function renderAt(path: string) {
  const history = createMemoryHistory();
  history.push(path);
  await act(async () => {
    render(<TestAppRouter history={history} />);
  });
  return history;
}

const usersTable = () => screen.findByRole('table', {name: 'Users'});

function present<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`missing ${what}`);
  }
  return value;
}

describe('AdminPage', () => {
  it('serves /admin as the admin page, not the page of a user named "admin"', async () => {
    await renderAt('/admin');

    const table = await usersTable();
    expect(document.getElementById('adminPage')).toBeInTheDocument();
    expect(within(table).getByText('alice@example.com')).toBeInTheDocument();
    expect(within(table).getByText('Staff')).toBeInTheDocument();
    expect(store.isStaff).toBe(true);
    // The menu's mode tabs now show, on Admin.
    const adminTab = screen.getByRole('tab', {name: 'Admin'});
    expect(adminTab).toHaveAttribute('href', '/admin');
    expect(adminTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', {name: 'User'})).toHaveAttribute(
      'aria-selected',
      'false'
    );
  });

  it('turns away users who are not staff, without logging them out', async () => {
    viewerIsStaff = false;
    act(() => store.setIsStaff(true));

    await renderAt('/admin');

    expect(
      await screen.findByText('You do not have access to this page.')
    ).toBeInTheDocument();
    expect(listRequests).toHaveLength(0);
    expect(store.isStaff).toBe(false);
    expect(store.loggedInUser).toBe('test');
    expect(document.getElementById('modeTabs')).toBeNull();
    // They get a plain link back to their entries instead.
    expect(document.getElementById('entriesLinkButton')).toHaveAttribute(
      'href',
      '/test'
    );
  });

  it('signs out a session that has expired', async () => {
    server.use(
      http.get(`${API}/user/`, () =>
        HttpResponse.json({errors: []}, {status: 401})
      )
    );

    await renderAt('/admin');

    await waitFor(() => {
      expect(document.getElementById('signInPage')).toBeInTheDocument();
    });
    expect(store.loggedInUser).toBeNull();
    expect(listRequests).toHaveLength(0);
  });

  it('shows the sign-in page to signed-out visitors', async () => {
    act(() => store.setLoggedInUser(null));

    await renderAt('/admin');

    expect(document.getElementById('signInPage')).toBeInTheDocument();
    expect(listRequests).toHaveLength(0);
  });

  it('says so when access is revoked while the page is open', async () => {
    adminForbidden = true;

    await renderAt('/admin');

    expect(
      await screen.findByText('You do not have access to this page.')
    ).toBeInTheDocument();
    expect(store.loggedInUser).toBe('test');
  });

  it('deactivates a user after confirmation', async () => {
    await renderAt('/admin');
    await usersTable();

    fireEvent.click(
      present(document.getElementById('adminUserToggle7'), 'toggle')
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Deactivate alice?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Deactivate'}));

    await waitFor(() => {
      expect(
        screen.getByRole('button', {name: 'Reactivate'})
      ).toBeInTheDocument();
    });
    expect(patches).toEqual([
      {data: {type: 'AdminUser', id: '7', attributes: {is_active: false}}},
    ]);
    const row = present(document.getElementById('adminUserRow7'), 'row');
    expect(within(row).getByText('Deactivated')).toBeInTheDocument();
  });

  it('reloads after a change, so a status filter stays accurate', async () => {
    await renderAt('/admin');
    await usersTable();
    fireEvent.click(screen.getByRole('button', {name: 'Active'}));
    await waitFor(() => {
      expect(listRequests.at(-1)?.get('filter[is_active]')).toBe('true');
    });

    fireEvent.click(
      present(document.getElementById('adminUserToggle7'), 'toggle')
    );
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Deactivate',
      })
    );

    await waitFor(() => {
      expect(document.getElementById('adminUserRow7')).toBeNull();
    });
    expect(listRequests.at(-1)?.get('filter[is_active]')).toBe('true');
  });

  it('steps back a page when a change empties the last one', async () => {
    users = [
      ...users,
      ...Array.from({length: 24}, (_, index) => ({
        id: String(100 + index),
        username: `user${index}`,
        email: `user${index}@example.com`,
        is_staff: false,
        is_active: true,
      })),
    ];
    await renderAt('/admin');
    await usersTable();
    fireEvent.click(screen.getByRole('button', {name: 'Active'}));
    await waitFor(() => {
      expect(listRequests.at(-1)?.get('filter[is_active]')).toBe('true');
    });
    // 26 active users: page 2 holds the 26th alone.
    fireEvent.click(await screen.findByRole('button', {name: /next page/i}));
    await waitFor(() => {
      expect(listRequests.at(-1)?.get('page[number]')).toBe('2');
    });
    const [lastRow] = await screen.findAllByRole('button', {
      name: 'Deactivate',
    });
    fireEvent.click(present(lastRow, 'toggle'));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Deactivate',
      })
    );

    await waitFor(() => {
      expect(listRequests.at(-1)?.get('page[number]')).toBe('1');
    });
    expect(await usersTable()).toBeInTheDocument();
    expect(
      screen.queryByText('Could not load this data. Try again.')
    ).toBeNull();
  });

  it('changes nothing when the confirmation is cancelled', async () => {
    await renderAt('/admin');
    await usersTable();

    fireEvent.click(
      present(document.getElementById('adminUserToggle7'), 'toggle')
    );
    fireEvent.click(await screen.findByRole('button', {name: 'Cancel'}));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(patches).toHaveLength(0);
  });

  it("won't let staff deactivate their own account", async () => {
    await renderAt('/admin');
    await usersTable();

    expect(document.getElementById('adminUserToggle1')).toBeDisabled();
    expect(document.getElementById('adminUserToggle7')).toBeEnabled();
  });

  it('searches and filters by status', async () => {
    await renderAt('/admin');
    await usersTable();

    fireEvent.change(screen.getByLabelText('Search username or email'), {
      target: {value: 'ali'},
    });
    await waitFor(() => {
      expect(listRequests.at(-1)?.get('filter[search]')).toBe('ali');
    });
    await waitFor(() => {
      expect(screen.queryByText('test@example.com')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', {name: 'Deactivated'}));
    await waitFor(() => {
      expect(listRequests.at(-1)?.get('filter[is_active]')).toBe('false');
    });
    expect(await screen.findByText('No users match.')).toBeInTheDocument();
  });

  it('sorts by a column', async () => {
    await renderAt('/admin');
    await usersTable();
    expect(listRequests.at(-1)?.get('sort')).toBe('-date_joined');

    fireEvent.click(screen.getByRole('button', {name: 'Username'}));

    await waitFor(() => {
      expect(listRequests.at(-1)?.get('sort')).toBe('username');
    });

    // Most recently active first.
    fireEvent.click(screen.getByRole('button', {name: 'Last active'}));

    await waitFor(() => {
      expect(listRequests.at(-1)?.get('sort')).toBe('-last_active');
    });
  });

  it('shows when each user was last active, after their last login', async () => {
    users = [
      ...users,
      {
        id: '9',
        username: 'bob',
        email: 'bob@example.com',
        is_staff: false,
        is_active: false,
      },
    ];
    await renderAt('/admin');
    const table = await usersTable();
    await within(table).findByText('alice');

    const headers = within(table)
      .getAllByRole('columnheader')
      .map(header => header.textContent);
    const column = headers.indexOf('Last active');
    expect(column).toBe(headers.indexOf('Last login') + 1);
    const cellText = (id: string) =>
      within(present(document.getElementById(`adminUserRow${id}`), 'row'))
        .getAllByRole('cell')
        .map(cell => cell.textContent)[column];
    // The fixtures' last_active: 2026-09-02 for active users, null otherwise.
    expect(cellText('7')).toMatch(/2026/);
    expect(cellText('9')).toBe('Never');
  });

  it('offers only menus that work here, and the User tab back to the entries', async () => {
    const history = await renderAt('/admin');
    await usersTable();

    // Staff have the mode tabs, so no separate link.
    expect(document.getElementById('entriesLinkButton')).toBeNull();
    const back = screen.getByRole('tab', {name: 'User'});
    expect(back).toHaveAttribute('href', '/test');

    expect(screen.queryByRole('menu', {name: 'Tags'})).toBeNull();
    expect(screen.queryByRole('menu', {name: 'Entries'})).toBeNull();
    fireEvent.click(screen.getByRole('menu', {name: 'File'}));
    expect(await screen.findByText('Logout')).toBeInTheDocument();
    expect(document.getElementById('file-menu-new-entry')).toBeNull();

    fireEvent.click(back);
    await waitFor(() => {
      expect(history.location.pathname).toBe('/test');
    });
  });

  it('shows the audit log', async () => {
    await renderAt('/admin');
    await usersTable();

    fireEvent.click(screen.getByRole('tab', {name: 'Audit log'}));

    const table = await screen.findByRole('table', {name: 'Audit log'});
    const cell = await within(table).findByText('alice');
    const row = present(cell.closest('tr'), 'audit row');
    expect(within(row).getByText('Deactivated')).toBeInTheDocument();
  });
});
