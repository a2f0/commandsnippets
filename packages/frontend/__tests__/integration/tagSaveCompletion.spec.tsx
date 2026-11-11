import {ThemeProvider} from '@mui/material/styles';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {useState} from 'react';
import {I18nextProvider} from 'react-i18next';
import {vi} from 'vitest';
import {TagEdit} from '../../src/components/tags/TagEdit';
import {i18n} from '../../src/i18n/i18n';
import type {ITagJsonApi} from '../../src/lib/api/responses/types';
import * as tagRename from '../../src/lib/data/tagRename';
import * as writes from '../../src/lib/data/writes';
import {createTag} from '../../src/lib/data/writes';
import {
  claimData,
  endSyncSession,
  syncSession,
} from '../../src/lib/sync/session';
import {darkTheme} from '../../src/theme/themes';
import {signIn, TEST_USER} from '../util/signIn';
import {seed, tag, testUser} from '../util/storeFixtures';

beforeEach(() => signIn());
afterEach(() => cleanup());

it('closes the mounted editor after real persistence even when its session ended', async () => {
  const session = syncSession(TEST_USER);
  vi.spyOn(session.sync, 'flush').mockResolvedValue(undefined);
  const object = await createTag(session, 'first local tag');
  const stored = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const rename = writes.renameTag;
  const saving = vi
    .spyOn(writes, 'renameTag')
    .mockImplementationOnce(async (...args) => {
      const renamed = await rename(...args);
      stored.resolve();
      await resume.promise;
      return renamed;
    });
  const onStored = vi.fn();
  renderEditor(object, onStored);
  fireEvent.change(screen.getByRole('textbox'), {
    target: {value: 'stored before ending'},
  });
  try {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', {name: 'Save'}));
      await stored.promise;
      await endSyncSession(TEST_USER);
    });
    expect(screen.getByRole('textbox')).toHaveValue('stored before ending');
    const replacement = syncSession(TEST_USER);
    expect(replacement).not.toBe(session);
    expect(
      (await replacement.db.tags.get([TEST_USER, object.id]))?.attributes.name
    ).toBe('stored before ending');
    await act(async () => {
      resume.resolve();
      await Promise.all(saving.mock.results.map(result => result.value));
    });
    expect(screen.getByText('Editor closed')).toBeInTheDocument();
    expect(onStored).not.toHaveBeenCalled();
    expect(screen.queryByText(/Not saved:/)).toBeNull();
  } finally {
    await act(async () => resume.resolve());
  }
});

function renderEditor(
  object: ITagJsonApi,
  onStored: (renamed: ITagJsonApi) => void
) {
  function Editor() {
    const [editing, setEditing] = useState(true);
    return editing ? (
      <TagEdit
        object={object}
        handleSaveParent={() => setEditing(false)}
        handleStoredParent={onStored}
        handleCancelEditParent={() => setEditing(false)}
      />
    ) : (
      <p>Editor closed</p>
    );
  }
  return render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={darkTheme}>
        <Editor />
      </ThemeProvider>
    </I18nextProvider>
  );
}

it.each(['unbound local tag', 'failed follow-up read'])(
  'closes a successful real rename despite %s',
  async reason => {
    const session = syncSession(TEST_USER);
    // Keep the real local writes queued, as when the network is unavailable.
    vi.spyOn(session.sync, 'flush').mockResolvedValue(undefined);
    let object: ITagJsonApi;
    if (reason === 'unbound local tag') {
      object = await createTag(session, 'first local tag');
      expect(object.relationships.user.data.id).toBe('');
    } else {
      await claimData(TEST_USER, testUser.id);
      object = tag('1', {name: 'synced tag'});
      await seed([object]);
    }
    const original = tagRename.isCurrentTagRename;
    const read = vi.spyOn(tagRename, 'isCurrentTagRename');
    const failed = vi.spyOn(console, 'error').mockImplementation(() => {});
    if (reason === 'failed follow-up read') {
      read.mockImplementationOnce((...args) => {
        // Only the post-save check fails, not the real rename transaction.
        vi.spyOn(session.db, 'transaction').mockRejectedValueOnce(
          new Error('read unavailable')
        );
        return original(...args);
      });
    }
    const onStored = vi.fn();
    renderEditor(object, onStored);
    fireEvent.change(screen.getByRole('textbox'), {
      target: {value: 'renamed locally'},
    });
    fireEvent.click(screen.getByRole('button', {name: 'Save'}));
    await waitFor(() => expect(read).toHaveBeenCalledOnce());
    await act(async () => {
      await Promise.all(read.mock.results.map(result => result.value));
    });
    expect(
      (await session.db.tags.get([TEST_USER, object.id]))?.attributes.name
    ).toBe('renamed locally');
    if (reason === 'failed follow-up read') {
      expect(onStored).not.toHaveBeenCalled();
      expect(failed).toHaveBeenCalledExactlyOnceWith(
        'Failed to follow the renamed tag:',
        expect.objectContaining({message: 'read unavailable'})
      );
    } else {
      expect(onStored).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          attributes: expect.objectContaining({name: 'renamed locally'}),
        })
      );
      expect(failed).not.toHaveBeenCalled();
    }
    expect(screen.queryByText(/Not saved:/)).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Editor closed')).toBeInTheDocument();
  }
);
