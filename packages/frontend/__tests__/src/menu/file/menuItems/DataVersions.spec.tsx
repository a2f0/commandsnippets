/**
 * File > Data Versions: the user's versions of their data, newest first;
 * one not active can be made active (after a warning) or deleted (after
 * another), and any exported.
 */
import {backupSchema} from '@commandsnippets/api-shared/responses';
import {act, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import invariant from 'invariant';
import {HttpResponse, http} from 'msw/http';
import {vi} from 'vitest';
import * as backupData from '../../../../../src/lib/data/backup';
import {heldVersion} from '../../../../../src/lib/sync/dataVersion';
import {syncSession} from '../../../../../src/lib/sync/session';
import {assignLoggedInCookie} from '../../../../util/assignLoggedInCookie';
import {mockResult} from '../../../../util/mockResult';
import {API, serveMockApi, server} from '../../../../util/msw';
import {observeSyncWork} from '../../../../util/observeSyncWork';
import {restoreElsewhere} from '../../../../util/restoreElsewhere';
import {signIn, TEST_USER} from '../../../../util/signIn';
import {renderAppAt} from '../../../../util/TestAppRouter';

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

serveMockApi();
afterEach(() => {
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

async function openVersions() {
  const work = observeSyncWork(TEST_USER);
  renderAppAt('/test/test-tag-1');
  await screen.findByText('entry-1-subject');
  await work.finish();
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
    const errors = vi.spyOn(console, 'error');
    await restoreElsewhere();
    const user = await openVersions();
    const activating = vi.spyOn(backupData, 'activateVersion');
    const work = observeSyncWork(TEST_USER);
    const {db} = syncSession(TEST_USER);
    await waitFor(async () => expect(await heldVersion(db, TEST_USER)).toBe(2));

    await user.click((await row(1)).getByText('Switch to'));
    expect(await screen.findByText('Switch to version 1?')).toBeInTheDocument();
    expect(screen.getByText(/you can switch back/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Switch'}));
    await act(async () => {
      await mockResult(activating, 0);
    });
    await work.finish();

    expect(
      await (await row(1)).findByText('Version 1 · Active')
    ).toBeInTheDocument();
    expect(await heldVersion(db, TEST_USER)).toBe(1);
    expect(errors).not.toHaveBeenCalled();
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

    // The list is read again (none shown meanwhile): version 2 alone.
    await waitFor(() => {
      expect(document.getElementById('dataVersion-1')).toBeNull();
      expect(document.getElementById('dataVersion-2')).not.toBeNull();
    });
  });

  it('says a delete was made when only the list could not be read again', async () => {
    await restoreElsewhere();
    let listFails = false;
    server.use(
      // The mock API deletes it (nothing answered here), then lists fail.
      http.delete(`${API}/user/data_versions/:version`, () => {
        listFails = true;
      }),
      http.get(`${API}/user/data_versions`, () =>
        listFails ? HttpResponse.json({errors: []}, {status: 500}) : undefined
      )
    );
    const user = await openVersions();

    await user.click((await row(1)).getByText('Delete'));
    await user.click(
      await screen.findByRole('button', {name: 'Delete version'})
    );

    expect(
      await screen.findByText(/^Done, but this page could not show/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Something went wrong/)).toBeNull();
    listFails = false;
    await user.click(screen.getByRole('button', {name: 'Dismiss'}));
    await waitFor(() => {
      expect(document.getElementById('dataVersion-1')).toBeNull();
      expect(document.getElementById('dataVersion-2')).not.toBeNull();
    });
  });

  it('says a switch was made when this copy could not follow it', async () => {
    await restoreElsewhere();
    const user = await openVersions();
    vi.spyOn(syncSession(TEST_USER).sync, 'adopt').mockRejectedValueOnce(
      new Error('the database is closing')
    );

    await user.click((await row(1)).getByText('Switch to'));
    await user.click(await screen.findByRole('button', {name: 'Switch'}));

    expect(
      await screen.findByText(/^Done, but this page could not show/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Something went wrong/)).toBeNull();
    await user.click(screen.getByRole('button', {name: 'Dismiss'}));
    // The API did switch.
    expect(
      await (await row(1)).findByText('Version 1 · Active')
    ).toBeInTheDocument();
  });

  it('says why the API refused', async () => {
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
