/**
 * File > Restore Backup: a backup file is read and checked, the user is
 * warned what is deleted and what replaces it, and only their confirmation
 * replaces their data (the writes queued here sent first); the data then
 * syncs here.
 */
import {
  DATA_VERSION_HEADER,
  EXPECTED_USER_HEADER,
  EXPECTED_USER_ID_HEADER,
} from '@commandsnippets/api-shared/messages';
import {
  type Backup,
  dataVersionListDocumentSchema,
} from '@commandsnippets/api-shared/responses';
import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createMemoryHistory} from 'history';
import invariant from 'invariant';
import {HttpResponse, http} from 'msw';
import {vi} from 'vitest';
import {createEntry} from '../../../../../src/lib/data/writes';
import {OWNER_ID_KEY} from '../../../../../src/lib/db/database';
import {useAppState} from '../../../../../src/lib/state/appState';
import {heldVersion} from '../../../../../src/lib/sync/dataVersion';
import {syncSession} from '../../../../../src/lib/sync/session';
import {assignLoggedInCookie} from '../../../../util/assignLoggedInCookie';
import {server} from '../../../../util/msw';
import {restoreElsewhere} from '../../../../util/restoreElsewhere';
import {signIn, TEST_USER} from '../../../../util/signIn';
import {TestAppRouter} from '../../../../util/TestAppRouter';

const API = 'http://localhost:9001/api/v1';
const AT = '2026-10-01T09:30:00.000000';

/** Another account's backup: one tag, two entries, one of them tagged. */
const backup: Backup = {
  format: 'commandsnippets-backup',
  version: 1,
  date_exported: AT,
  user: {id: '42', username: 'someone-else'},
  tags: [
    {
      id: '500',
      name: 'restored-tag',
      order: 0,
      is_public: false,
      date_created: AT,
      date_updated: AT,
    },
  ],
  entries: [
    {
      id: '600',
      subject: 'restored-subject',
      body: 'restored body',
      is_public: false,
      date_created: AT,
      date_updated: AT,
    },
    {
      id: '601',
      subject: 'restored-untagged',
      body: 'another body',
      is_public: false,
      date_created: AT,
      date_updated: AT,
    },
  ],
  tags_entries: [
    {
      id: '700',
      tag_id: '500',
      text_entry_id: '600',
      order: 0,
      date_created: AT,
      date_updated: AT,
    },
  ],
  entry_reuses: [],
};

const fileOf = (content: unknown, name = 'backup.json') =>
  new File(
    [typeof content === 'string' ? content : JSON.stringify(content)],
    name,
    {type: 'application/json'}
  );

/** Each restore request: whom and which data version it named, and what it sent. */
interface RestoreRequest {
  user: string | null;
  account: string | null;
  version: string | null;
  body: unknown;
}

function restoreRequests(): RestoreRequest[] {
  const requests: RestoreRequest[] = [];
  server.events.on('request:start', async ({request}) => {
    if (new URL(request.url).pathname === '/api/v1/user/restore') {
      requests.push({
        user: request.headers.get(EXPECTED_USER_HEADER),
        account: request.headers.get(EXPECTED_USER_ID_HEADER),
        version: request.headers.get(DATA_VERSION_HEADER),
        body: await request.clone().json(),
      });
    }
  });
  return requests;
}

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
  vi.restoreAllMocks();
});
afterAll(() => server.close());
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
  // The mock API announces each request; a flush that fails warns.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

async function renderEntries() {
  const history = createMemoryHistory();
  history.push('/test/test-tag-1');
  render(<TestAppRouter history={history} />);
  await screen.findByText('entry-1-subject');
  // All of the user's data is here: the warning counts it.
  await syncSession(TEST_USER).sync.syncAll();
}

/** File > Restore Backup, then choose `file`. */
async function chooseFile(file: File) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('menu', {name: 'File'}));
  const click = vi.spyOn(HTMLInputElement.prototype, 'click');
  await user.click(screen.getByText('Restore Backup'));
  const input = document.getElementById('restoreBackupFile');
  invariant(input instanceof HTMLInputElement, 'the file input is rendered');
  expect(click.mock.contexts).toContain(input);
  await user.upload(input, file);
  return user;
}

const liveSubjects = async () => {
  const {db} = syncSession(TEST_USER);
  return (
    await db.entries
      .where('owner')
      .equals(TEST_USER)
      .filter(row => !row.attributes.is_deleted)
      .toArray()
  )
    .map(row => row.attributes.subject)
    .sort();
};

const liveTagNames = async () => {
  const {db} = syncSession(TEST_USER);
  return (
    await db.tags
      .where('owner')
      .equals(TEST_USER)
      .filter(row => !row.attributes.is_deleted)
      .toArray()
  )
    .map(row => row.attributes.name)
    .sort();
};

describe('Restore Backup', () => {
  it('warns what it replaces and what is kept, and changes nothing when cancelled', async () => {
    await renderEntries();
    const subjects = await liveSubjects();
    const tags = await liveTagNames();
    const requests = restoreRequests();

    const user = await chooseFile(fileOf(backup));

    expect(await screen.findByText('Restore this backup?')).toBeInTheDocument();
    expect(
      screen.getByText(/makes the backup's tags and entries your data/)
    ).toBeInTheDocument();
    expect(screen.getByText(/kept as the version before/)).toBeInTheDocument();
    expect(document.getElementById('restoreBackupCurrent')).toHaveTextContent(
      `Tags: ${tags.length} · Entries: ${subjects.length}`
    );
    expect(document.getElementById('restoreBackupIncoming')).toHaveTextContent(
      'Tags: 1 · Entries: 2'
    );
    expect(
      screen.getByText(/The backup of someone-else's data, from/)
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: 'Cancel'}));

    await waitFor(() =>
      expect(screen.queryByText('Restore this backup?')).toBeNull()
    );
    expect(requests).toEqual([]);
    expect(await liveSubjects()).toEqual(subjects);
    expect(await liveTagNames()).toEqual(tags);
  });

  it("replaces the user's data with the backup's once confirmed", async () => {
    await renderEntries();
    const requests = restoreRequests();
    const user = await chooseFile(fileOf(backup));
    await screen.findByText('Restore this backup?');

    await user.click(screen.getByRole('button', {name: 'Restore backup'}));

    expect(await screen.findByText('Backup restored')).toBeInTheDocument();
    expect(screen.getByText('Tags: 1 · Entries: 2')).toBeInTheDocument();
    // Asked for as the user and their account, with the backup as it was.
    expect(requests).toEqual([
      {user: TEST_USER, account: '1', version: '1', body: backup},
    ]);
    // Synced here: the old data is gone, the backup's is shown.
    expect(await liveSubjects()).toEqual([
      'restored-subject',
      'restored-untagged',
    ]);
    expect(await liveTagNames()).toEqual(['restored-tag']);
    expect(await screen.findByText('restored-tag')).toBeInTheDocument();
    expect(screen.queryByText('test-tag-2')).toBeNull();

    await user.click(screen.getByRole('button', {name: 'Dismiss'}));
    await waitFor(() =>
      expect(screen.queryByText('Backup restored')).toBeNull()
    );
  });

  it('sends the writes queued here first', async () => {
    await renderEntries();
    const session = syncSession(TEST_USER);
    server.use(
      http.all(`${API}/*`, ({request}) =>
        request.method === 'GET' ? undefined : HttpResponse.error()
      )
    );
    await createEntry(session, 'queued-subject', 'body');
    await expect(session.sync.flush()).rejects.toThrow();
    server.resetHandlers();
    const posted: string[] = [];
    server.events.on('request:start', ({request}) => {
      if (request.method === 'POST') {
        posted.push(new URL(request.url).pathname);
      }
    });

    const user = await chooseFile(fileOf(backup));
    await user.click(
      await screen.findByRole('button', {name: 'Restore backup'})
    );

    expect(await screen.findByText('Backup restored')).toBeInTheDocument();
    expect(posted).toEqual(['/api/v1/entries', '/api/v1/user/restore']);
    expect(await session.db.outbox.count()).toBe(0);
    // Sent before the restore, which then deleted it with the rest.
    expect(await liveSubjects()).toEqual([
      'restored-subject',
      'restored-untagged',
    ]);
  });

  it('restores nothing while queued writes cannot be sent', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await renderEntries();
    const requests = restoreRequests();
    server.use(
      http.all(`${API}/*`, ({request}) =>
        request.method === 'GET' ? undefined : HttpResponse.error()
      )
    );
    await createEntry(syncSession(TEST_USER), 'unsent-subject', 'body');

    await chooseFile(fileOf(backup));

    // Before any warning: the queue is sent when the file is chosen.
    expect(await screen.findByText('Restore failed')).toBeInTheDocument();
    expect(screen.queryByText('Restore this backup?')).toBeNull();
    expect(requests).toEqual([]);
    expect(error).toHaveBeenCalled();
    expect(await liveSubjects()).toContain('entry-1-subject');
  });

  it('says why the API refused the backup', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await renderEntries();
    const detail =
      'Invalid backup at /tags/0/name: Ensure this field has no more than 24 characters.';
    server.use(
      http.post(`${API}/user/restore`, () =>
        HttpResponse.json(
          {
            errors: [
              {
                detail,
                status: '400',
                source: {pointer: '/tags/0/name'},
                code: 'max_length',
              },
            ],
          },
          {status: 400}
        )
      )
    );

    const user = await chooseFile(fileOf(backup));
    await user.click(
      await screen.findByRole('button', {name: 'Restore backup'})
    );

    expect(await screen.findByText('Restore failed')).toBeInTheDocument();
    expect(screen.getByText(detail)).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Dismiss'}));
    await waitFor(() =>
      expect(screen.queryByText('Restore failed')).toBeNull()
    );
  });

  it.each([
    ['not JSON', 'this is not json'],
    ['another format', {...backup, format: 'something-else'}],
    ['another version', {...backup, version: 2}],
  ])('refuses a file that is %s, sending nothing', async (_name, content) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await renderEntries();
    const requests = restoreRequests();

    await chooseFile(fileOf(content));

    expect(await screen.findByText('Not a backup')).toBeInTheDocument();
    expect(screen.queryByText('Restore this backup?')).toBeNull();
    expect(requests).toEqual([]);
  });

  it('closes the warning when another user signs in meanwhile, restoring nothing', async () => {
    // The admin page keeps the menu bar when the signed-in user changes.
    const history = createMemoryHistory();
    history.push('/admin');
    render(<TestAppRouter history={history} />);
    await screen.findByRole('table', {name: 'Users'});
    const requests = restoreRequests();
    await chooseFile(fileOf(backup));
    await screen.findByText('Restore this backup?');

    // Another tab signs in as someone else.
    act(() => useAppState.setState({loggedInUser: 'someone-else'}));

    await waitFor(() =>
      expect(screen.queryByText('Restore this backup?')).toBeNull()
    );
    expect(document.getElementById('file-menu-restore-backup')).not.toBeNull();
    expect(requests).toEqual([]);
  });

  it('restores over the version its copy is of, then holds the new one', async () => {
    await renderEntries();
    const named: (string | null)[] = [];
    server.events.on('request:start', ({request}) => {
      if (new URL(request.url).pathname === '/api/v1/user/restore') {
        named.push(request.headers.get(DATA_VERSION_HEADER));
      }
    });
    const user = await chooseFile(fileOf(backup));
    await user.click(
      await screen.findByRole('button', {name: 'Restore backup'})
    );

    expect(await screen.findByText(/as version 2/)).toBeInTheDocument();
    expect(named).toEqual(['1']);
    const {db} = syncSession(TEST_USER);
    expect(await heldVersion(db, TEST_USER)).toBe(2);
    // The version before is kept, there to switch back to.
    const {data} = dataVersionListDocumentSchema.parse(
      await (await fetch(`${API}/user/data_versions`)).json()
    );
    expect(
      data.map(({attributes}) => [attributes.version, attributes.active])
    ).toEqual([
      [2, true],
      [1, false],
    ]);
  });

  it('restores nothing over a version made active elsewhere since', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await renderEntries();
    const user = await chooseFile(fileOf(backup));
    await screen.findByText('Restore this backup?');
    // Another device restores meanwhile: version 2 is active, not 1.
    await restoreElsewhere(backup);
    const requests = restoreRequests();

    await user.click(screen.getByRole('button', {name: 'Restore backup'}));

    expect(await screen.findByText('Restore failed')).toBeInTheDocument();
    expect(requests.map(({version}) => version)).toEqual(['1']);
    const {data} = dataVersionListDocumentSchema.parse(
      await (await fetch(`${API}/user/data_versions`)).json()
    );
    expect(data).toHaveLength(2);
  });

  it('restores nothing over a version a sync here took up after the warning', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await renderEntries();
    const user = await chooseFile(fileOf(backup));
    await screen.findByText('Restore this backup?');
    // Another device restores, and this one syncs it: the data here is of
    // version 2 now, which the warning was not about.
    await restoreElsewhere(backup);
    const {db, sync} = syncSession(TEST_USER);
    await sync.syncAll();
    expect(await heldVersion(db, TEST_USER)).toBe(2);
    const requests = restoreRequests();

    await user.click(screen.getByRole('button', {name: 'Restore backup'}));

    expect(await screen.findByText('Restore failed')).toBeInTheDocument();
    expect(requests.map(({version}) => version)).toEqual(['1']);
    const {data} = dataVersionListDocumentSchema.parse(
      await (await fetch(`${API}/user/data_versions`)).json()
    );
    expect(data).toHaveLength(2);
  });

  it('restores only into the account the user was warned about', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await renderEntries();
    const {db} = syncSession(TEST_USER);
    const bindTo = (account: string) =>
      db.cursors.put({owner: TEST_USER, key: OWNER_ID_KEY, after: account});
    // Warned about the data of the account it is bound to then...
    await bindTo('99');
    const subjects = await liveSubjects();
    const requests = restoreRequests();
    const user = await chooseFile(fileOf(backup));
    await screen.findByText('Restore this backup?');

    // ...which another account of the same username replaced since.
    await bindTo('1');
    await user.click(screen.getByRole('button', {name: 'Restore backup'}));

    expect(await screen.findByText('Restore failed')).toBeInTheDocument();
    expect(requests).toEqual([]);
    expect(await liveSubjects()).toEqual(subjects);
    expect(error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({name: 'BackupAccountError'})
    );
  });
});
