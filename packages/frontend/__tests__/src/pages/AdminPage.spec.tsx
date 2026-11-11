import {type AdminUser, CODES} from '@commandsnippets/api-shared';
import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import invariant from 'invariant';
import {HttpResponse, http} from 'msw/http';
import * as adminApi from '../../../src/lib/api/adminApi';

import {
  errorDocument,
  listDocument,
  pagination,
} from '../../../src/msw/documents';
import type {MockAdminUser} from '../../../src/msw/fixtures';
import {adminAuditLog, adminUsers} from '../../../src/msw/state';
import {assignLoggedInCookie} from '../../util/assignLoggedInCookie';
import {API, recordRequests, serveMockApi, server} from '../../util/msw';
import {signIn, store} from '../../util/signIn';
import {renderAppAt} from '../../util/TestAppRouter';

// The mock API's admin routes (src/msw/routes/admin.ts), over its users
// (`adminUsers`): test, who is staff and signs in, and alice.
serveMockApi();

beforeAll(async () => {
  // The route loads the page's module when first shown (React.lazy): load
  // it here, so the first test waits for the page, not for its import.
  await import('../../../src/pages/AdminPage');
});

/** The query of each `GET /admin/users`, and each `PATCH`'s document. */
let listRequests: URLSearchParams[];
let patches: unknown[];

beforeEach(() => {
  signIn();
  assignLoggedInCookie();
  listRequests = recordRequests(({method, url}, path) =>
    method === 'GET' && path === '/api/v1/admin/users'
      ? new URL(url).searchParams
      : undefined
  );
  patches = recordRequests(request =>
    request.method === 'PATCH' ? request.clone().json() : undefined
  );
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

/** The signed-in user is not staff (the mock API's is). */
const notStaff = () =>
  server.use(
    http.get(`${API}/user/`, () =>
      HttpResponse.json({
        data: {
          type: 'User',
          id: '1',
          attributes: {
            username: 'test',
            is_staff: false,
            date_updated: '2026-09-01T00:00:00.000000',
            data_version: 1,
          },
        },
      })
    )
  );

const resource = (user: MockAdminUser): AdminUser => ({
  type: 'AdminUser',
  id: user.id,
  attributes: {
    username: user.username,
    email: user.email,
    is_staff: user.is_staff,
    is_active: user.is_active,
    date_joined: '2026-01-02T03:04:05.000000',
    last_login: user.is_active ? '2026-09-01T00:00:00.000000' : null,
    last_active: user.is_active ? '2026-09-02T00:00:00.000000' : null,
    login_count: 4,
    date_updated: '2026-09-01T00:00:00.000000',
    date_marked_for_deletion: user.date_marked_for_deletion,
    entry_count: 12,
    tag_count: 3,
    data_version: 1,
  },
});

/**
 * `GET /admin/users` in pages, as the API answers it (the mock API lists
 * every user on one page), filtered by status, with the activity only of
 * active users (the mock API gives every user's).
 */
const pagedUsers = () =>
  server.use(
    http.get(`${API}/admin/users`, ({request}) => {
      const params = new URL(request.url).searchParams;
      const active = params.get('filter[is_active]');
      const matching = adminUsers.filter(
        user => active === null || String(user.is_active) === active
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
    })
  );

/** A user who is not staff, added to the mock API's. */
const addUser = (id: string, username: string, is_active = true) =>
  adminUsers.push({
    id,
    username,
    email: `${username}@example.com`,
    is_staff: false,
    is_active,
    date_marked_for_deletion: null,
  });

const usersTable = () => screen.findByRole('table', {name: 'Users'});

function row(id: string): HTMLElement {
  const element = document.getElementById(`adminUserRow${id}`);
  invariant(element, `row ${id} is shown`);
  return element;
}

/** The items of user `id`'s menu, opened with its ⋮ button. */
async function openMenu(id: string): Promise<string[]> {
  const button = document.getElementById(`adminUserMenuButton${id}`);
  invariant(button, `menu button ${id} is shown`);
  fireEvent.click(button);
  const items = await screen.findAllByRole('menuitem');
  return items.map(item => item.textContent ?? '');
}

/** Choose `item` from user `id`'s menu. */
async function choose(id: string, item: string) {
  await openMenu(id);
  fireEvent.click(screen.getByRole('menuitem', {name: item}));
}

/** Open the Audit log tab, and a finder of the row of `username`'s action. */
async function showAuditLog() {
  await renderAppAt('/admin', {act: true});
  await usersTable();
  fireEvent.click(screen.getByRole('tab', {name: 'Audit log'}));
  const table = await screen.findByRole('table', {name: 'Audit log'});
  return async (username: string) => {
    const cell = await within(table).findByText(username);
    const auditRow = cell.closest('tr');
    invariant(auditRow, `${username}'s audit row is shown`);
    return auditRow;
  };
}

/** Confirm the dialog with its `button`. */
async function confirm(button: string) {
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', {name: button}));
}

describe('AdminPage', () => {
  it('serves /admin as the admin page, not the page of a user named "admin"', async () => {
    await renderAppAt('/admin', {act: true});

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
    notStaff();
    act(() => store.setIsStaff(true));

    await renderAppAt('/admin', {act: true});

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

    const {history} = await renderAppAt('/admin', {act: true});

    await waitFor(() => {
      expect(document.getElementById('signInPage')).toBeInTheDocument();
    });
    expect(history.location.pathname).toBe('/');
    expect(store.loggedInUser).toBeNull();
    expect(listRequests).toHaveLength(0);
  });

  it('sends signed-out visitors to the sign-in page', async () => {
    act(() => store.setLoggedInUser(null));

    const {history} = await renderAppAt('/admin', {act: true});

    expect(history.location.pathname).toBe('/');
    expect(document.getElementById('signInPage')).toBeInTheDocument();
    expect(listRequests).toHaveLength(0);
  });

  it('says so when access is revoked while the page is open', async () => {
    server.use(http.get(`${API}/admin/users`, forbidden));

    await renderAppAt('/admin', {act: true});

    expect(
      await screen.findByText('You do not have access to this page.')
    ).toBeInTheDocument();
    expect(store.loggedInUser).toBe('test');
  });

  it('deactivates a user from their menu, after confirmation', async () => {
    await renderAppAt('/admin', {act: true});
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
    await renderAppAt('/admin', {act: true});
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
    await renderAppAt('/admin', {act: true});
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
    const alice = adminUsers.find(user => user.id === '7');
    invariant(alice, 'the mock API has alice');
    alice.is_active = false;
    alice.date_marked_for_deletion = '2026-09-28T12:00:00.000000';
    await renderAppAt('/admin', {act: true});
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
    await renderAppAt('/admin', {act: true});
    await usersTable();

    await choose('7', 'Deactivate');
    await confirm('Deactivate');

    await waitFor(() => expect(store.loggedInUser).toBeNull());
    expect(adminUsers.find(user => user.id === '7')?.is_active).toBe(true);
  });

  it("shows nothing of the last user's once the tab takes up another's sign-in", async () => {
    await renderAppAt('/admin', {act: true});
    await usersTable();

    // Another tab signed in as someone who is not staff; this one takes it up.
    notStaff();
    act(() => store.setLoggedInUser('someone-else'));

    expect(screen.queryByRole('table', {name: 'Users'})).toBeNull();
    expect(
      await screen.findByText('You do not have access to this page.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('table', {name: 'Users'})).toBeNull();
  });

  it('ignores a forbidden mutation from the previous admin identity', async () => {
    const old = Promise.withResolvers<adminApi.AdminUser>();
    const mutation = vi
      .spyOn(adminApi, 'setUserActive')
      .mockReturnValueOnce(old.promise);
    const view = await renderAppAt('/admin', {act: true});
    try {
      await usersTable();
      await choose('7', 'Deactivate');
      await confirm('Deactivate');
      await waitFor(() => expect(mutation).toHaveBeenCalledTimes(1));

      act(() => store.setLoggedInUser('replacement-user'));
      await usersTable();
      expect(store.isStaff).toBe(true);
      await act(async () => {
        old.reject(new adminApi.AdminForbiddenError());
        await old.promise.catch(() => undefined);
      });

      expect(store.loggedInUser).toBe('replacement-user');
      expect(store.isStaff).toBe(true);
      expect(screen.getByRole('table', {name: 'Users'})).toBeInTheDocument();
      expect(
        screen.queryByText('You do not have access to this page.')
      ).toBeNull();
    } finally {
      old.reject(new adminApi.AdminForbiddenError());
      await old.promise.catch(() => undefined);
      view.unmount();
    }
  });

  it('reloads after a change, so a status filter stays accurate', async () => {
    await renderAppAt('/admin', {act: true});
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
    for (let index = 0; index < 24; index += 1) {
      addUser(String(100 + index), `user${index}`);
    }
    pagedUsers();
    await renderAppAt('/admin', {act: true});
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
    await renderAppAt('/admin', {act: true});
    await usersTable();

    await choose('7', 'Mark for deletion');
    fireEvent.click(await screen.findByRole('button', {name: 'Cancel'}));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(patches).toHaveLength(0);
  });

  it("won't let staff deactivate or mark their own account", async () => {
    await renderAppAt('/admin', {act: true});
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
    await renderAppAt('/admin', {act: true});
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
    await renderAppAt('/admin', {act: true});
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
    addUser('9', 'bob', false);
    pagedUsers();
    await renderAppAt('/admin', {act: true});
    const table = await usersTable();
    await within(table).findByText('alice');

    const headers = within(table)
      .getAllByRole('columnheader')
      .map(header => header.textContent);
    const column = headers.indexOf('Last active');
    expect(column).toBe(headers.indexOf('Last login') + 1);
    const cellText = (id: string) =>
      within(row(id))
        .getAllByRole('cell')
        .map(cell => cell.textContent)[column];
    // `pagedUsers`' last_active: 2026-09-02 for active users, null otherwise.
    expect(cellText('7')).toMatch(/2026/);
    expect(cellText('9')).toBe('Never');
  });

  it('offers only menus that work here, and the User tab back to the entries', async () => {
    const {history} = await renderAppAt('/admin', {act: true});
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
    // Backups of their own data work from any page.
    expect(screen.getByText('Export Backup')).toBeInTheDocument();
    expect(screen.getByText('Restore Backup')).toBeInTheDocument();
    expect(screen.getByText('Data Versions')).toBeInTheDocument();

    fireEvent.click(back);
    await waitFor(() => {
      expect(history.location.pathname).toBe('/test');
    });
  });

  it("opens a user's data, read-only, on their page", async () => {
    const {history} = await renderAppAt('/admin', {act: true});
    await usersTable();

    await choose('7', 'View data');

    await waitFor(() => expect(history.location.pathname).toMatch(/^\/alice/));
    expect(await screen.findByText('Read-only: alice')).toBeInTheDocument();
    expect(patches).toHaveLength(0);
  });

  it('shows the audit log', async () => {
    adminAuditLog.push(
      {
        id: '2',
        created: '2026-09-28T13:00:00.000000',
        action: 'mark_user_for_deletion',
        target: 'bob',
      },
      {
        id: '1',
        created: '2026-09-28T12:00:00.000000',
        action: 'deactivate_user',
        target: 'alice',
      }
    );
    const actionOf = await showAuditLog();

    expect(
      within(await actionOf('alice')).getByText('Deactivated')
    ).toBeInTheDocument();
    expect(
      within(await actionOf('bob')).getByText('Marked for deletion')
    ).toBeInTheDocument();
  });

  it('shows an action it does not know by its name', async () => {
    // One the API added since (the mock API records only those it knows).
    server.use(
      http.get(`${API}/admin/audit_log`, ({request}) =>
        HttpResponse.json(
          listDocument(request.url, [
            {
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
          ])
        )
      )
    );
    const actionOf = await showAuditLog();

    expect(
      within(await actionOf('carol')).getByText('delete_user')
    ).toBeInTheDocument();
  });
});
