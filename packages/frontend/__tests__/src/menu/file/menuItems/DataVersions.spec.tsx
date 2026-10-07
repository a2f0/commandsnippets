/**
 * File > Data Versions: the user's versions of their data, newest first;
 * one not active can be made active (after a warning) or deleted (after
 * another), and any exported.
 */
import {backupSchema} from '@commandsnippets/api-shared/responses';
import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createMemoryHistory} from 'history';
import invariant from 'invariant';
import {HttpResponse, http} from 'msw';
import {vi} from 'vitest';
import {heldVersion} from '../../../../../src/lib/sync/dataVersion';
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

/** The files the app offers for download (jsdom has no object URLs). */
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
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

/** Another device restores the user's own backup: version 2, active. */
async function restoreElsewhere(): Promise<void> {
  const backup = backupSchema.parse(
    await (await fetch(`${API}/user/backup`)).json()
  );
  await fetch(`${API}/user/restore`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(backup),
  });
}

async function openVersions() {
  const history = createMemoryHistory();
  history.push('/test/test-tag-1');
  render(<TestAppRouter history={history} />);
  await screen.findByText('entry-1-subject');
  await syncSession(TEST_USER).sync.syncAll();
  const user = userEvent.setup();
  await user.click(screen.getByRole('menu', {name: 'File'}));
  await user.click(screen.getByText('Data Versions'));
  await screen.findByText('Data versions');
  return user;
}

const row = async (version: number) => {
  const item = await waitFor(() => {
    const found = document.getElementById(`dataVersion-${version}`);
    invariant(found, `version ${version} is listed`);
    return found;
  });
  return within(item);
};

describe('Data Versions', () => {
  it('lists the versions, newest first, with where each came from', async () => {
    await restoreElsewhere();
    await openVersions();

    const newest = await row(2);
    expect(newest.getByText('Version 2 · Active')).toBeInTheDocument();
    expect(
      newest.getByText(/Restored from test's backup of/)
    ).toBeInTheDocument();
    const first = await row(1);
    expect(first.getByText('Version 1')).toBeInTheDocument();
    expect(first.getByText(/Your first data, from/)).toBeInTheDocument();
    expect(first.getByText(/Tags: \d+ · Entries: \d+/)).toBeInTheDocument();
    // Only one not active can be made active or deleted.
    expect(newest.queryByText('Switch to')).toBeNull();
    expect(newest.queryByText('Delete')).toBeNull();
    expect(first.getByText('Switch to')).toBeInTheDocument();
  });

  it('makes a version active again after a warning, and holds it here', async () => {
    await restoreElsewhere();
    const user = await openVersions();
    const {db} = syncSession(TEST_USER);
    await waitFor(async () => expect(await heldVersion(db, TEST_USER)).toBe(2));

    await user.click((await row(1)).getByText('Switch to'));
    expect(await screen.findByText('Switch to version 1?')).toBeInTheDocument();
    expect(screen.getByText(/you can switch back/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Switch'}));

    expect(
      await (await row(1)).findByText('Version 1 · Active')
    ).toBeInTheDocument();
    expect(await heldVersion(db, TEST_USER)).toBe(1);
  });

  it('changes nothing when the switch is cancelled', async () => {
    await restoreElsewhere();
    const user = await openVersions();
    await user.click((await row(1)).getByText('Switch to'));
    await screen.findByText('Switch to version 1?');
    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(
      await (await row(2)).findByText('Version 2 · Active')
    ).toBeInTheDocument();
  });

  it('exports a version that is not active', async () => {
    const downloads = captureDownloads();
    const before = backupSchema.parse(
      await (await fetch(`${API}/user/backup`)).json()
    );
    await restoreElsewhere();
    const user = await openVersions();

    await user.click((await row(1)).getByText('Export'));

    await waitFor(() => expect(downloads).toHaveLength(1));
    const [download] = downloads;
    invariant(download, 'a file was saved');
    expect(download.name).toMatch(/^commandsnippets-backup-test-.*-v1\.json$/);
    const saved = backupSchema.parse(JSON.parse(await download.blob.text()));
    expect(saved.entries.map(({id}) => id)).toEqual(
      before.entries.map(({id}) => id)
    );
  });

  it('deletes a version that is not active after a warning', async () => {
    await restoreElsewhere();
    const user = await openVersions();

    await user.click((await row(1)).getByText('Delete'));
    expect(await screen.findByText('Delete version 1?')).toBeInTheDocument();
    expect(screen.getByText(/This cannot be undone/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Delete version'}));

    await waitFor(() =>
      expect(document.getElementById('dataVersion-1')).toBeNull()
    );
    expect(document.getElementById('dataVersion-2')).not.toBeNull();
  });

  it('says why the API refused', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await restoreElsewhere();
    const detail = 'The active data version cannot be deleted.';
    server.use(
      http.delete(`${API}/user/data_versions/:version`, () =>
        HttpResponse.json(
          {errors: [{detail, status: '400', code: 'invalid'}]},
          {status: 400}
        )
      )
    );
    const user = await openVersions();

    await user.click((await row(1)).getByText('Delete'));
    await user.click(
      await screen.findByRole('button', {name: 'Delete version'})
    );

    expect(await screen.findByText(detail)).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Dismiss'}));
    expect(await row(1)).toBeTruthy();
  });
});
