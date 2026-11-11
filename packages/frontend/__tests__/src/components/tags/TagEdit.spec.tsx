import {ThemeProvider} from '@mui/material/styles';
import {act, fireEvent, render, waitFor} from '@testing-library/react';
import invariant from 'invariant';
import {I18nextProvider} from 'react-i18next';
import {vi} from 'vitest';
import {TagEdit} from '../../../../src/components/tags/TagEdit';
import {i18n} from '../../../../src/i18n/i18n';
import * as tagRename from '../../../../src/lib/data/tagRename';
import {InvalidWriteError} from '../../../../src/lib/data/writes';
import * as sessions from '../../../../src/lib/sync/session';
import {darkTheme} from '../../../../src/theme/themes';
import {signIn} from '../../../util/signIn';
import {tag} from '../../../util/storeFixtures';

const renameTag = vi.hoisted(() => vi.fn());

vi.mock('../../../../src/lib/data/writes', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../../src/lib/data/writes')>()),
  renameTag,
}));

beforeEach(() => signIn());
afterEach(() => renameTag.mockReset());

const object = tag('2', {name: 'the-tag'});

function renderEditor() {
  const onSave = vi.fn();
  const onStored = vi.fn();
  const onCancel = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={darkTheme}>
        <TagEdit
          object={object}
          handleSaveParent={onSave}
          handleStoredParent={onStored}
          handleCancelEditParent={onCancel}
        />
      </ThemeProvider>
    </I18nextProvider>
  );
  return {onSave, onStored, onCancel};
}

const byId = (id: string): HTMLElement => {
  const element = document.getElementById(id);
  invariant(element, `#${id} is rendered`);
  return element;
};

describe('TagEdit', () => {
  it('ignores a second Save while a rename is pending', async () => {
    vi.spyOn(tagRename, 'captureTagRenameIdentity').mockResolvedValue({
      accountId: undefined,
      version: undefined,
    });
    vi.spyOn(tagRename, 'isCurrentTagRename').mockResolvedValue(false);
    const pending = Promise.withResolvers<ReturnType<typeof tag>>();
    renameTag.mockReturnValue(pending.promise);
    const {onSave} = renderEditor();
    fireEvent.change(byId('tagEditTagName2'), {target: {value: 'first'}});
    fireEvent.click(byId('tagEditSave2'));
    await waitFor(() => expect(renameTag).toHaveBeenCalledOnce());
    try {
      await act(async () => {
        fireEvent.change(byId('tagEditTagName2'), {target: {value: 'second'}});
        fireEvent.click(byId('tagEditSave2'));
      });
      expect(renameTag).toHaveBeenCalledOnce();
      expect(renameTag).toHaveBeenLastCalledWith(
        expect.anything(),
        '2',
        'first',
        expect.anything()
      );
    } finally {
      await act(async () => pending.resolve(tag('2', {name: 'first'})));
    }
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('permits another Save after a failed rename', async () => {
    const failure = new InvalidWriteError('name: taken is taken');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    renameTag
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(tag('2', {name: 'free'}));
    const {onSave} = renderEditor();
    fireEvent.click(byId('tagEditSave2'));
    await waitFor(() =>
      expect(byId('tagEdit2Error')).toHaveTextContent(
        'Not saved: name: taken is taken'
      )
    );
    fireEvent.change(byId('tagEditTagName2'), {target: {value: 'free'}});
    fireEvent.click(byId('tagEditSave2'));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(renameTag).toHaveBeenCalledTimes(2);
    expect(errors).toHaveBeenCalledExactlyOnceWith(
      'Failed to update tag:',
      failure
    );
  });

  it('saves the name the field holds and closes without passing a row', async () => {
    const renamed = tag('2', {name: 'renamed'});
    renameTag.mockResolvedValue(renamed);
    const {onSave} = renderEditor();
    expect(byId('tagEditTagName2')).toHaveValue('the-tag');
    fireEvent.change(byId('tagEditTagName2'), {target: {value: 'renamed'}});

    fireEvent.click(byId('tagEditSave2'));

    await waitFor(() => expect(onSave).toHaveBeenCalledExactlyOnceWith());
    expect(renameTag).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      '2',
      'renamed',
      {accountId: undefined, version: undefined}
    );
  });

  it('closes the same mounted form when the session generation changed after saving', async () => {
    const generation = vi
      .spyOn(sessions, 'sessionsEndedCount')
      .mockReturnValue(1);
    const pending = Promise.withResolvers<ReturnType<typeof tag>>();
    renameTag.mockReturnValue(pending.promise);
    const {onSave, onStored} = renderEditor();
    fireEvent.click(byId('tagEditSave2'));
    await waitFor(() => expect(renameTag).toHaveBeenCalledOnce());
    generation.mockReturnValue(2);
    await act(async () => pending.resolve(tag('2', {name: 'stored'})));
    expect(onSave).toHaveBeenCalledExactlyOnceWith();
    expect(onStored).not.toHaveBeenCalled();
  });

  it('stays open when the tag is gone', async () => {
    const renamed = Promise.resolve(null);
    renameTag.mockReturnValue(renamed);
    const {onSave} = renderEditor();

    fireEvent.click(byId('tagEditSave2'));
    await waitFor(() => expect(renameTag).toHaveBeenCalledOnce());
    // After the editor's own handling of the answer.
    await act(async () => {
      await renamed;
    });

    expect(renameTag).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not start an unguarded write when identity capture fails', async () => {
    const failure = new Error('identity unavailable');
    const failed = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(tagRename, 'captureTagRenameIdentity').mockRejectedValueOnce(
      failure
    );
    const {onSave, onStored} = renderEditor();
    fireEvent.click(byId('tagEditSave2'));
    await waitFor(() =>
      expect(byId('tagEdit2Error')).toHaveTextContent(
        'Not saved: identity unavailable'
      )
    );
    expect(renameTag).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    expect(onStored).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledExactlyOnceWith(
      'Failed to update tag:',
      failure
    );
  });

  it('stays open with the name and says why when the save fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renameTag.mockRejectedValueOnce(
      new InvalidWriteError('name: taken is taken')
    );
    const {onSave} = renderEditor();
    fireEvent.change(byId('tagEditTagName2'), {target: {value: 'taken'}});

    fireEvent.click(byId('tagEditSave2'));

    await waitFor(() =>
      expect(byId('tagEdit2Error')).toHaveTextContent(
        'Not saved: name: taken is taken'
      )
    );
    expect(onSave).not.toHaveBeenCalled();
    expect(byId('tagEditTagName2')).toHaveValue('taken');
  });

  it.each([
    ['Cancel', () => fireEvent.click(byId('tagEditCancel2'))],
    [
      'Escape',
      () =>
        fireEvent.keyDown(byId('tagEditTagName2'), {
          key: 'Escape',
          code: 'Escape',
        }),
    ],
  ])('cancels on %s', (_, cancel) => {
    const {onCancel, onSave} = renderEditor();

    cancel();

    expect(onCancel).toHaveBeenCalledOnce();
    expect(renameTag).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
