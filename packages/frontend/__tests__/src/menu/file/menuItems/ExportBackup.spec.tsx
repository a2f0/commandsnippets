/**
 * File > Export Backup: the writes queued here are sent, then the API's
 * backup of the user's data is saved as a file; when none can be made, a
 * dialog says so and nothing is saved.
 */
import {
  EXPECTED_USER_HEADER,
  EXPECTED_USER_ID_HEADER,
} from '@commandsnippets/api-shared/messages';
import {backupSchema} from '@commandsnippets/api-shared/responses';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createMemoryHistory} from 'history';
import {HttpResponse, http} from 'msw';
import {vi} from 'vitest';
import {backupFileName} from '../../../../../src/lib/data/backup';
import {createEntry} from '../../../../../src/lib/data/writes';
import {OWNER_ID_KEY} from '../../../../../src/lib/db/database';
import {isLocalId} from '../../../../../src/lib/sync/outbox';
import {syncSession} from '../../../../../src/lib/sync/session';
import {assignLoggedInCookie} from '../../../../util/assignLoggedInCookie';
import {server} from '../../../../util/msw';
import {signIn, TEST_USER} from '../../../../util/signIn';
import {TestAppRouter} from '../../../../util/TestAppRouter';

const API = 'http://localhost:9001/api/v1';

interface Download {
  name: string;
  blob: Blob;
}

/**
 * The files the app offers for download. jsdom has no object URLs, and
 * would not download a link it is told to click.
 */
function captureDownloads(): Download[] {
  const downloads: Download[] = [];
  const blobs = new Map<string, Blob>();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: (blob: Blob) => {
      const url = `blob:test/${blobs.size}`;
      blobs.set(url, blob);
      return url;
    },
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: (url: string) => blobs.delete(url),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    const blob = blobs.get(this.href);
    if (blob !== undefined) {
      downloads.push({name: this.download, blob});
    }
  });
  return downloads;
}

let downloads: Download[];

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
  vi.restoreAllMocks();
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});
afterAll(() => server.close());
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
  downloads = captureDownloads();
  // The mock API announces each request; a flush that fails warns.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

async function renderEntries() {
  const history = createMemoryHistory();
  history.push('/test/test-tag-1');
  render(<TestAppRouter history={history} />);
  await screen.findByText('entry-1-subject');
}

async function exportBackup() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('menu', {name: 'File'}));
  await user.click(screen.getByText('Export Backup'));
  return user;
}

/** Who each backup request named: the user, and the account. */
function backupRequests(): [string | null, string | null][] {
  const requests: [string | null, string | null][] = [];
  server.events.on('request:start', ({request}) => {
    if (new URL(request.url).pathname === '/api/v1/user/backup') {
      requests.push([
        request.headers.get(EXPECTED_USER_HEADER),
        request.headers.get(EXPECTED_USER_ID_HEADER),
      ]);
    }
  });
  return requests;
}

async function savedBackup() {
  await waitFor(() => expect(downloads).toHaveLength(1));
  const [download] = downloads;
  if (download === undefined) throw new Error('nothing saved');
  expect(download.blob.type).toBe('application/json');
  const backup = backupSchema.parse(JSON.parse(await download.blob.text()));
  return {name: download.name, backup};
}

describe('Export Backup', () => {
  it("saves a backup of the user's data, with the API's ids", async () => {
    await renderEntries();
    const requests = backupRequests();
    await exportBackup();

    const {name, backup} = await savedBackup();
    expect(name).toBe(backupFileName(backup));
    expect(name).toMatch(
      /^commandsnippets-backup-test-\d{4}-\d{2}-\d{2}\.json$/
    );
    expect(backup.user).toEqual({id: '1', username: TEST_USER});
    expect(backup.tags.map(tag => [tag.id, tag.name])).toEqual(
      expect.arrayContaining([
        ['1', 'test-tag-1'],
        ['2', 'test-tag-2'],
      ])
    );
    expect(backup.entries).toContainEqual(
      expect.objectContaining({id: '1', subject: 'entry-1-subject'})
    );
    expect(backup.tags_entries).toContainEqual(
      expect.objectContaining({tag_id: '1', text_entry_id: '1'})
    );
    expect(screen.queryByText('Export failed')).toBeNull();
    // Asked for as the user, and the account their data is bound to.
    expect(requests).toEqual([[TEST_USER, '1']]);
  });

  it('sends the writes queued here first, so the backup holds them', async () => {
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

    await exportBackup();

    const {backup} = await savedBackup();
    const queued = backup.entries.find(
      entry => entry.subject === 'queued-subject'
    );
    expect(queued).toBeDefined();
    expect(isLocalId(queued?.id ?? 'local-')).toBe(false);
    expect(await session.db.outbox.count()).toBe(0);
  });

  it('saves nothing while queued writes cannot be sent', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await renderEntries();
    const session = syncSession(TEST_USER);
    const backupsRead = backupRequests();
    server.use(
      http.all(`${API}/*`, ({request}) =>
        request.method === 'GET' ? undefined : HttpResponse.error()
      )
    );
    await createEntry(session, 'unsent-subject', 'body');

    await exportBackup();

    expect(await screen.findByText('Export failed')).toBeInTheDocument();
    expect(downloads).toEqual([]);
    expect(backupsRead).toEqual([]);
    expect(error).toHaveBeenCalled();
  });

  it('says when the backup cannot be read, until dismissed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await renderEntries();
    server.use(http.get(`${API}/user/backup`, () => HttpResponse.error()));

    const user = await exportBackup();

    expect(await screen.findByText('Export failed')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your backup could not be made. Check your connection and try again.'
      )
    ).toBeInTheDocument();
    expect(downloads).toEqual([]);
    await user.click(screen.getByRole('button', {name: 'Dismiss'}));
    await waitFor(() => expect(screen.queryByText('Export failed')).toBeNull());

    // It works again once the API answers.
    server.resetHandlers();
    await exportBackup();
    await savedBackup();
  });

  it('refuses a backup that breaks the contract', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await renderEntries();
    server.use(
      http.get(`${API}/user/backup`, () =>
        HttpResponse.json({format: 'something-else'})
      )
    );

    await exportBackup();

    expect(await screen.findByText('Export failed')).toBeInTheDocument();
    expect(downloads).toEqual([]);
  });

  it('asks as the account the data is bound to, saving nothing for another of the name', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await renderEntries();
    const session = syncSession(TEST_USER);
    await session.sync.flush();
    // The data is bound to an account deleted since, whose name the account
    // now signed in (the mock API's, 1) has taken.
    await session.db.cursors.put({
      owner: TEST_USER,
      key: OWNER_ID_KEY,
      after: '99',
    });
    const requests = backupRequests();

    await exportBackup();

    expect(await screen.findByText('Export failed')).toBeInTheDocument();
    expect(requests).toEqual([[TEST_USER, '99']]);
    expect(downloads).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({name: 'UserMismatchError'})
    );
  });

  it("saves nothing when the API answers with another account's backup", async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await renderEntries();
    server.use(
      http.get(`${API}/user/backup`, () =>
        HttpResponse.json({
          format: 'commandsnippets-backup',
          version: 1,
          date_exported: '2026-10-06T00:00:00',
          user: {id: '7', username: TEST_USER},
          tags: [],
          entries: [],
          tags_entries: [],
          entry_reuses: [],
        })
      )
    );

    await exportBackup();

    expect(await screen.findByText('Export failed')).toBeInTheDocument();
    expect(downloads).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({name: 'BackupAccountError'})
    );
  });
});
