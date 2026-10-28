import {ThemeProvider} from '@mui/material/styles';
import {fireEvent, render, screen} from '@testing-library/react';
import invariant from 'invariant';
import {I18nextProvider} from 'react-i18next';
import {vi} from 'vitest';
import {EntryEdit} from '../../../../src/components/entries/EntryEdit';
import {i18n} from '../../../../src/i18n/i18n';
import {darkTheme} from '../../../../src/theme/themes';
import {signIn} from '../../../util/signIn';
import {entry} from '../../../util/storeFixtures';

const updateEntry = vi.hoisted(() => vi.fn());

vi.mock('../../../../src/lib/data/writes', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../../src/lib/data/writes')>()),
  updateEntry,
}));

beforeEach(() => {
  signIn();
  updateEntry.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  updateEntry.mockReset();
});

const object = entry('1', {subject: 'the subject', body: 'the body'});

/** The editor of `object`, which `onCancel` leaves open. */
function renderEditor(onCancel = vi.fn()) {
  render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={darkTheme}>
        <EntryEdit
          id="edit"
          object={object}
          handleSaveParent={vi.fn()}
          handleCancelEditParent={onCancel}
        />
      </ThemeProvider>
    </I18nextProvider>
  );
}

const byId = (id: string): HTMLElement => {
  const element = document.getElementById(id);
  invariant(element, `#${id} is rendered`);
  return element;
};

/** A rectangle `top` pixels down the window. */
const rectAt = (top: number): DOMRect => ({
  x: 0,
  y: top,
  top,
  left: 0,
  width: 80,
  height: 30,
  bottom: top + 30,
  right: 80,
  toJSON: () => ({}),
});

describe('EntryEdit', () => {
  it('puts the subject and body back on Cancel', () => {
    const onCancel = vi.fn();
    renderEditor(onCancel);
    fireEvent.change(byId('editSubject'), {target: {value: 'new subject'}});
    fireEvent.change(byId('editBody'), {target: {value: 'new body'}});

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
    // What Save sends now: the entry as it was.
    fireEvent.click(screen.getByText('Save'));

    expect(updateEntry).toHaveBeenCalledWith(
      expect.anything(),
      '1',
      'the subject',
      'the body'
    );
  });

  it('scrolls its Save button into view when it opens out of view', () => {
    // Below the window (jsdom's is 768 pixels high), under the footer.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      rectAt(window.innerHeight)
    );
    const scrolled: Element[] = [];
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (
      this: Element
    ) {
      scrolled.push(this);
    });

    renderEditor();

    expect(scrolled).toEqual([byId('editSave')]);
  });

  it('scrolls nothing when its Save button opens in view', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      rectAt(200)
    );
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');

    renderEditor();

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
