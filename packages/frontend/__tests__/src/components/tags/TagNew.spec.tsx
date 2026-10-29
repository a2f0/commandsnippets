import {ThemeProvider} from '@mui/material/styles';
import {act, fireEvent, render, waitFor} from '@testing-library/react';
import invariant from 'invariant';
import {vi} from 'vitest';
import {TagNew} from '../../../../src/components/tags/TagNew';
import {activeTagEditField, appMode} from '../../../../src/lib/shared';
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
  act(() => {
    store.setAppMode(appMode.tagEditor);
    store.setTagNew('top');
  });
});
afterEach(() => createTag.mockReset());

function renderForm() {
  return render(
    <ThemeProvider theme={darkTheme}>
      <TagNew id="tagNewTop" />
    </ThemeProvider>
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
    expect(store.activeTagEditField).toBe(activeTagEditField.save);
    expect(document.activeElement).toBe(byId('tagNewTopSave'));
    tab();
    expect(store.activeTagEditField).toBe(activeTagEditField.cancel);
    expect(document.activeElement).toBe(byId('tagNewTopCancel'));
    tab();
    expect(store.activeTagEditField).toBe(activeTagEditField.name);
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

  it.each([
    ['Cancel', () => fireEvent.click(byId('tagNewTopCancel'))],
    [
      'Escape',
      () => fireEvent.keyDown(document, {key: 'Escape', code: 'Escape'}),
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

    unmount();

    expect(store.activeTagEditField).toBe(activeTagEditField.name);
  });
});
