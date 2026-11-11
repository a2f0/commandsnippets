import {ThemeProvider} from '@mui/material/styles';
import {act, fireEvent, render, waitFor} from '@testing-library/react';
import invariant from 'invariant';
import {I18nextProvider} from 'react-i18next';
import {vi} from 'vitest';
import {TagEdit} from '../../../../src/components/tags/TagEdit';
import {i18n} from '../../../../src/i18n/i18n';
import {InvalidWriteError} from '../../../../src/lib/data/writes';
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
  return {onSave, onCancel};
}

const byId = (id: string): HTMLElement => {
  const element = document.getElementById(id);
  invariant(element, `#${id} is rendered`);
  return element;
};

describe('TagEdit', () => {
  it('saves the name the field holds, with the renamed tag', async () => {
    const renamed = tag('2', {name: 'renamed'});
    renameTag.mockResolvedValue(renamed);
    const {onSave} = renderEditor();
    expect(byId('tagEditTagName2')).toHaveValue('the-tag');
    fireEvent.change(byId('tagEditTagName2'), {target: {value: 'renamed'}});

    fireEvent.click(byId('tagEditSave2'));

    expect(renameTag).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      '2',
      'renamed'
    );
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledExactlyOnceWith(renamed)
    );
  });

  it('stays open when the tag is gone', async () => {
    const renamed = Promise.resolve(null);
    renameTag.mockReturnValue(renamed);
    const {onSave} = renderEditor();

    fireEvent.click(byId('tagEditSave2'));
    // After the editor's own handling of the answer.
    await act(async () => {
      await renamed;
    });

    expect(renameTag).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
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
      () => fireEvent.keyDown(document, {key: 'Escape', code: 'Escape'}),
    ],
  ])('cancels on %s', (_, cancel) => {
    const {onCancel, onSave} = renderEditor();

    cancel();

    expect(onCancel).toHaveBeenCalledOnce();
    expect(renameTag).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
