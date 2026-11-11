import {ThemeProvider} from '@mui/material/styles';
import {act, cleanup, fireEvent, render, waitFor} from '@testing-library/react';
import invariant from 'invariant';
import {I18nextProvider} from 'react-i18next';
import {vi} from 'vitest';
import {TagNew} from '../../../../src/components/tags/TagNew';
import {i18n} from '../../../../src/i18n/i18n';
import {InvalidWriteError} from '../../../../src/lib/data/writes';

import {darkTheme} from '../../../../src/theme/themes';
import {signIn, store} from '../../../util/signIn';
import {tag} from '../../../util/storeFixtures';

const createTag = vi.hoisted(() => vi.fn());

vi.mock('../../../../src/lib/data/writes', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../../src/lib/data/writes')>()),
  createTag,
}));

beforeEach(() => {
  signIn();
  createTag.mockResolvedValue(tag('5', {name: 'fresh'}));
  // As File > New Tag opens the form.
  act(() => store.setTagNew('top'));
});
afterEach(() => {
  cleanup();
  createTag.mockReset();
});

function renderForm() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={darkTheme}>
        <TagNew id="tagNewTop" />
      </ThemeProvider>
    </I18nextProvider>
  );
}

const byId = (id: string): HTMLElement => {
  const element = document.getElementById(id);
  invariant(element, `#${id} is rendered`);
  return element;
};

describe('TagNew', () => {
  it('opens empty, with its name focused', () => {
    renderForm();

    expect(byId('tagNewTopTextField')).toHaveValue('');
    expect(document.activeElement).toBe(byId('tagNewTopTextField'));
  });

  it('keeps Tab in the form', () => {
    renderForm();

    const moved = fireEvent.keyDown(byId('tagNewTopTextField'), {
      key: 'Tab',
      code: 'Tab',
    });

    expect(moved).toBe(false);
    expect(byId('tagNewTop')).toContainElement(
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    );
  });

  it('moves Tab from the name to Save, Cancel and back', () => {
    renderForm();
    const tab = () =>
      act(() => {
        fireEvent.keyDown(document.activeElement ?? document, {
          key: 'Tab',
          code: 'Tab',
        });
      });

    tab();
    expect(document.activeElement).toBe(byId('tagNewTopSave'));
    tab();
    expect(document.activeElement).toBe(byId('tagNewTopCancel'));
    tab();
    expect(document.activeElement).toBe(byId('tagNewTopTextField'));
  });

  it('saves the name, and closes', async () => {
    renderForm();
    fireEvent.change(byId('tagNewTopTextField'), {target: {value: 'fresh'}});

    fireEvent.click(byId('tagNewTopSave'));

    expect(createTag).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      'fresh'
    );
    await waitFor(() => expect(store.tagNew).toBeNull());
  });

  it('stays open with the name and says why when the save fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    createTag.mockRejectedValueOnce(new InvalidWriteError('name: Too big'));
    renderForm();
    fireEvent.change(byId('tagNewTopTextField'), {target: {value: 'fresh'}});

    fireEvent.click(byId('tagNewTopSave'));

    await waitFor(() =>
      expect(byId('tagNewTopError')).toHaveTextContent(
        'Not saved: name: Too big'
      )
    );
    expect(store.tagNew).toBe('top');
    expect(byId('tagNewTopTextField')).toHaveValue('fresh');
  });

  it.each([
    ['Cancel', () => fireEvent.click(byId('tagNewTopCancel'))],
    [
      'Escape',
      () =>
        fireEvent.keyDown(byId('tagNewTopTextField'), {
          key: 'Escape',
          code: 'Escape',
        }),
    ],
  ])('closes unsaved on %s', (_, cancel) => {
    renderForm();
    fireEvent.change(byId('tagNewTopTextField'), {target: {value: 'fresh'}});

    cancel();

    expect(store.tagNew).toBeNull();
    expect(createTag).not.toHaveBeenCalled();
  });

  it('closes with the next form to open at its name', () => {
    const {unmount} = renderForm();
    fireEvent.keyDown(byId('tagNewTopTextField'), {key: 'Tab', code: 'Tab'});
    expect(document.activeElement).toBe(byId('tagNewTopSave'));

    unmount();

    renderForm();
    expect(document.activeElement).toBe(byId('tagNewTopTextField'));
  });
});
