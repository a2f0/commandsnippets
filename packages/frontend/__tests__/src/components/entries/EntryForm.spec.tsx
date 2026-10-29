import {ThemeProvider} from '@mui/material/styles';
import {act, fireEvent, render} from '@testing-library/react';
import invariant from 'invariant';
import {I18nextProvider} from 'react-i18next';
import {vi} from 'vitest';
import {
  EntryForm,
  type IEntryFormProps,
} from '../../../../src/components/entries/EntryForm';
import {i18n} from '../../../../src/i18n/i18n';
import {activeEntryEditField, appMode} from '../../../../src/lib/shared';
import {darkTheme} from '../../../../src/theme/themes';
import {signIn, store} from '../../../util/signIn';

beforeEach(() => {
  signIn();
  // As the menus and the context menus open an editor.
  act(() => store.setAppMode(appMode.entryEditor));
});
afterEach(() => vi.restoreAllMocks());

/** A form of `kind` with the id `form`, opened on a subject and body. */
function renderForm(
  kind: IEntryFormProps['kind'],
  props: Partial<IEntryFormProps> = {}
) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={darkTheme}>
        <EntryForm
          id="form"
          kind={kind}
          subject="the subject"
          body="the body"
          onSave={vi.fn()}
          onCancel={vi.fn()}
          {...props}
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

/** Press Tab where the focus is; whether the browser may still move it. */
const pressTab = () =>
  fireEvent.keyDown(document.activeElement ?? document, {
    key: 'Tab',
    code: 'Tab',
  });

describe.each(['new', 'edit'] as const)('EntryForm (%s)', kind => {
  it('opens at its subject, and Tab moves through its fields in turn', () => {
    renderForm(kind);
    expect(document.activeElement).toBe(byId('formSubject'));

    for (const field of ['Body', 'Save', 'Cancel', 'Subject', 'Body']) {
      // The form moves the focus itself, in place of the browser.
      expect(pressTab()).toBe(false);
      expect(document.activeElement).toBe(byId(`form${field}`));
    }
  });

  it('leaves Tab to the lists outside the entry editor', () => {
    renderForm(kind);
    act(() => store.setAppMode(appMode.entriesList));

    expect(pressTab()).toBe(true);
    expect(store.activeEntryEditField).toBe(activeEntryEditField.subject);
    expect(document.activeElement).toBe(byId('formSubject'));
  });

  it('closes with the next editor to open at its subject, in the entry list', () => {
    const {unmount} = renderForm(kind);
    pressTab();
    expect(store.activeEntryEditField).toBe(activeEntryEditField.body);

    unmount();

    expect(store.activeEntryEditField).toBe(activeEntryEditField.subject);
    expect(store.appMode).toBe(appMode.entriesList);
  });

  it('saves what its fields hold', () => {
    const onSave = vi.fn();
    renderForm(kind, {onSave});
    fireEvent.change(byId('formSubject'), {target: {value: 'new subject'}});
    fireEvent.change(byId('formBody'), {target: {value: 'new body'}});

    fireEvent.click(byId('formSave'));

    expect(onSave).toHaveBeenCalledExactlyOnceWith('new subject', 'new body');
  });
});

describe('EntryForm', () => {
  it("leaves the scroll alone as a new entry's form opens", () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');
    // Out of view: below the window, under the footer.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, window.innerHeight, 80, 30)
    );

    renderForm('new');

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
