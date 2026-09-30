import {
  adminUserUpdateDocumentSchema,
  CODES,
} from '@commandsnippets/api-shared';
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
  date_marked_for_deletion?: string | null;
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
    date_marked_for_deletion: user.date_marked_for_deletion ?? null,
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
    const username = params.get('filter[username]');
    const matching = users.filter(
      user =>
        (search === undefined ||
          user.username.includes(search) ||
          user.email.includes(search)) &&
        (active === null || String(user.is_active) === active) &&
        (username === null || user.username === username)
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
    const {attributes = {}} = adminUserUpdateDocumentSchema.parse(body).data;
    if (attributes.marked_for_deletion !== undefined) {
      user.date_marked_for_deletion = attributes.marked_for_deletion
        ? '2026-09-28T12:00:00.000000'
        : null;
      if (attributes.marked_for_deletion) {
        user.is_active = false;
      }
    }
    if (attributes.is_active !== undefined) {
      user.is_active = attributes.is_active;
    }
    return HttpResponse.json({data: resource(user)});
  }),
  // A user's data, read-only (alice has none here).
  http.get(`${API}/admin/users/:id/:collection`, ({request}) => {
    const url = new URL(request.url);
    return HttpResponse.json(
      url.searchParams.has('page[after]')
        ? {links: {next: null}, data: []}
        : {...onePage(request.url, 0), data: []}
    );
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
        {
          type: 'AdminAuditLogEntry',
          id: '10',
          attributes: {
            created: '2026-09-28T13:00:00.000000',
            action: 'mark_user_for_deletion',
            actor_id: '1',
            actor_username: 'test',
            target_user_id: '9',
            target_username: 'bob',
          },
        },
        {
          // An action this app does not know yet shows by its name.
          type: 'AdminAuditLogEntry',
          id: '11',
          attributes: {
            created: '2026-09-28T14:00:00.000000',
            action: 'delete_user',
            actor_id: '1',
            actor_username: 'test',
            target_user_id: null,
            target_username: 'carol',
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

const row = (id: string) =>
  present(document.getElementById(`adminUserRow${id}`), `row ${id}`);

/** The items of user `id`'s menu, opened with its ⋮ button. */
async function openMenu(id: string): Promise<string[]> {
  fireEvent.click(
    present(
      document.getElementById(`adminUserMenuButton${id}`),
      `menu button ${id}`
    )
  );
  const items = await screen.findAllByRole('menuitem');
  return items.map(item => item.textContent ?? '');
}

/** Choose `item` from user `id`'s menu. */
async function choose(id: string, item: string) {
  await openMenu(id);
  fireEvent.click(screen.getByRole('menuitem', {name: item}));
}

/** Confirm the dialog with its `button`. */
async function confirm(button: string) {
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', {name: button}));
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

    const history = await renderAt('/admin');

    await waitFor(() => {
      expect(document.getElementById('signInPage')).toBeInTheDocument();
    });
    expect(history.location.pathname).toBe('/');
    expect(store.loggedInUser).toBeNull();
    expect(listRequests).toHaveLength(0);
  });

  it('sends signed-out visitors to the sign-in page', async () => {
    act(() => store.setLoggedInUser(null));

    const history = await renderAt('/admin');

    expect(history.location.pathname).toBe('/');
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

  it('deactivates a user from their menu, after confirmation', async () => {
    await renderAt('/admin');
    await usersTable();

    expect(await openMenu('7')).toEqual([
      'View data',
      'Deactivate',
      'Mark for deletion',
    ]);
    fireEvent.click(screen.getByRole('menuitem', {name: 'Deactivate'}));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Deactivate alice?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Deactivate'}));

    await waitFor(() => {
      expect(within(row('7')).getByText('Deactivated')).toBeInTheDocument();
    });
    expect(patches).toEqual([
      {data: {type: 'AdminUser', id: '7', attributes: {is_active: false}}},
    ]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await openMenu('7')).toEqual([
      'View data',
      'Reactivate',
      'Mark for deletion',
    ]);
  });

  it('opens the same menu on a right-click of the row', async () => {
    await renderAt('/admin');
    await usersTable();

    fireEvent.contextMenu(row('7'), {clientX: 200, clientY: 300});

    const items = await screen.findAllByRole('menuitem');
    expect(items.map(item => item.textContent)).toEqual([
      'View data',
      'Deactivate',
      'Mark for deletion',
    ]);
    fireEvent.click(screen.getByRole('menuitem', {name: 'Mark for deletion'}));
    expect(
      within(await screen.findByRole('dialog')).getByText(
        'Mark alice for deletion?'
      )
    ).toBeInTheDocument();
  });

  it('marks a user for deletion after confirmation', async () => {
    await renderAt('/admin');
    await usersTable();

    await choose('7', 'Mark for deletion');
    await confirm('Mark for deletion');

    await waitFor(() => {
      expect(
        within(row('7')).getByText('Marked for deletion')
      ).toBeInTheDocument();
    });
    expect(patches).toEqual([
      {
        data: {
          type: 'AdminUser',
          id: '7',
          attributes: {marked_for_deletion: true},
        },
      },
    ]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // A marked account stays deactivated: it can only be unmarked.
    expect(await openMenu('7')).toEqual(['View data', 'Unmark for deletion']);
  });

  it('unmarks a user, who stays deactivated', async () => {
    users = users.map(user =>
      user.id === '7'
        ? {
            ...user,
            is_active: false,
            date_marked_for_deletion: '2026-09-28T12:00:00.000000',
          }
        : user
    );
    await renderAt('/admin');
    await usersTable();
    expect(
      within(row('7')).getByText('Marked for deletion')
    ).toBeInTheDocument();

    await choose('7', 'Unmark for deletion');
    await confirm('Unmark for deletion');

    await waitFor(() => {
      expect(within(row('7')).getByText('Deactivated')).toBeInTheDocument();
    });
    expect(patches).toEqual([
      {
        data: {
          type: 'AdminUser',
          id: '7',
          attributes: {marked_for_deletion: false},
        },
      },
    ]);
  });

  it("leaves the session when it is another user's, deactivating no one", async () => {
    // Another tab has signed in as someone else since.
    server.use(
      http.patch(`${API}/admin/users/:id`, () =>
        HttpResponse.json(
          errorDocument(409, CODES.userMismatch, 'Not that user.'),
          {status: 409}
        )
      )
    );
    await renderAt('/admin');
    await usersTable();

    await choose('7', 'Deactivate');
    await confirm('Deactivate');

    await waitFor(() => expect(store.loggedInUser).toBeNull());
    expect(users.find(user => user.id === '7')?.is_active).toBe(true);
  });

  it("shows nothing of the last user's once the tab takes up another's sign-in", async () => {
    await renderAt('/admin');
    await usersTable();

    // Another tab signed in as someone who is not staff; this one takes it up.
    viewerIsStaff = false;
    act(() => store.setLoggedInUser('someone-else'));

    expect(screen.queryByRole('table', {name: 'Users'})).toBeNull();
    expect(
      await screen.findByText('You do not have access to this page.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('table', {name: 'Users'})).toBeNull();
  });

  it('reloads after a change, so a status filter stays accurate', async () => {
    await renderAt('/admin');
    await usersTable();
    fireEvent.click(screen.getByRole('button', {name: 'Active'}));
    await waitFor(() => {
      expect(listRequests.at(-1)?.get('filter[is_active]')).toBe('true');
    });

    await choose('7', 'Deactivate');
    await confirm('Deactivate');

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
      expect(document.getElementById('adminUserRow123')).not.toBeNull();
    });
    await choose('123', 'Deactivate');
    await confirm('Deactivate');

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

    await choose('7', 'Mark for deletion');
    fireEvent.click(await screen.findByRole('button', {name: 'Cancel'}));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(patches).toHaveLength(0);
  });

  it("won't let staff deactivate or mark their own account", async () => {
    await renderAt('/admin');
    await usersTable();

    expect(document.getElementById('adminUserMenuButton1')).toBeDisabled();
    expect(document.getElementById('adminUserMenuButton7')).toBeEnabled();
    expect(
      screen.getByRole('button', {name: 'Actions for alice'})
    ).toBeInTheDocument();
    fireEvent.contextMenu(row('1'));
    expect(screen.queryByRole('menuitem')).toBeNull();
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

  it("opens a user's data, read-only, on their page", async () => {
    const history = await renderAt('/admin');
    await usersTable();

    await choose('7', 'View data');

    await waitFor(() => expect(history.location.pathname).toMatch(/^\/alice/));
    expect(await screen.findByText('Read-only: alice')).toBeInTheDocument();
    expect(patches).toHaveLength(0);
  });

  it('shows the audit log', async () => {
    await renderAt('/admin');
    await usersTable();

    fireEvent.click(screen.getByRole('tab', {name: 'Audit log'}));

    const table = await screen.findByRole('table', {name: 'Audit log'});
    const actionOf = async (username: string) => {
      const cell = await within(table).findByText(username);
      return present(cell.closest('tr'), 'audit row');
    };
    expect(
      within(await actionOf('alice')).getByText('Deactivated')
    ).toBeInTheDocument();
    expect(
      within(await actionOf('bob')).getByText('Marked for deletion')
    ).toBeInTheDocument();
    expect(
      within(await actionOf('carol')).getByText('delete_user')
    ).toBeInTheDocument();
  });
});
