import {ThemeProvider} from '@mui/material/styles';
import {act, cleanup, fireEvent, render} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import invariant from 'invariant';
import {StrictMode} from 'react';
import {I18nextProvider} from 'react-i18next';
import {vi} from 'vitest';
import {EntryForm} from '../../../src/components/entries/EntryForm';
import {TagForm} from '../../../src/components/tags/TagForm';
import {i18n} from '../../../src/i18n/i18n';
import {appMode} from '../../../src/lib/shared';
import {
  defaultUiState,
  resetApplicationState,
  useAppState,
} from '../../../src/lib/state/appState';
import {registeredEditors} from '../../../src/lib/state/editorOwnership';
import {darkTheme} from '../../../src/theme/themes';

afterEach(() => cleanup());

function mountForm(kind: 'entry' | 'tag', id: string) {
  const result = render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider theme={darkTheme}>
          {kind === 'entry' ? (
            <EntryForm
              id={id}
              kind="new"
              subject="subject"
              body="body"
              onSave={vi.fn()}
              onCancel={vi.fn()}
            />
          ) : (
            <TagForm
              ids={{
                form: id,
                name: `${id}Name`,
                save: `${id}Save`,
                cancel: `${id}Cancel`,
              }}
              name="tag"
              onSave={vi.fn()}
              onCancel={vi.fn()}
              cycleFields
            />
          )}
        </ThemeProvider>
      </I18nextProvider>
    </StrictMode>
  );
  const control = (suffix: string) => {
    const field = result.container.querySelector<HTMLElement>(
      `[id="${id}${suffix}"]`
    );
    invariant(field, 'form control is mounted');
    return field;
  };
  return {...result, control};
}

it.each([
  ['entry', 'tag'],
  ['tag', 'entry'],
  ['entry', 'entry'],
  ['tag', 'tag'],
] as const)(
  'registers StrictMode roots once and releases only its own lifetime: %s/%s',
  (firstKind, secondKind) => {
    const first = mountForm(firstKind, 'first');
    const second = mountForm(secondKind, 'second');
    expect(
      registeredEditors(useAppState.getState().editorOwnership)
    ).toHaveLength(2);
    const field = second.control(secondKind === 'entry' ? 'Body' : 'Name');
    act(() => field.focus());
    first.unmount();
    expect(
      registeredEditors(useAppState.getState().editorOwnership)
    ).toHaveLength(1);
    expect(field).toHaveFocus();
    expect(fireEvent.keyDown(field, {key: 'Enter', code: 'Enter'})).toBe(true);
    expect(fireEvent.keyDown(field, {key: 'Tab', code: 'Tab'})).toBe(false);
    expect(second.control('Save')).toHaveFocus();
    second.unmount();
    expect(registeredEditors(useAppState.getState().editorOwnership)).toEqual(
      []
    );
    expect(useAppState.getState().appMode).toBe(
      secondKind === 'entry' ? appMode.entriesList : appMode.tagsList
    );
  }
);

it.each(['resetApplicationState', 'defaultUiState'])(
  '%s drops old registrations and ignores their later focus/cleanup after reopening',
  reset => {
    const old = mountForm('entry', 'same-id');
    act(() => {
      if (reset === 'resetApplicationState') resetApplicationState();
      else useAppState.setState(defaultUiState);
    });
    expect(registeredEditors(useAppState.getState().editorOwnership)).toEqual(
      []
    );
    const replacement = mountForm('entry', 'same-id');
    act(() => old.control('Body').focus());
    expect(
      registeredEditors(useAppState.getState().editorOwnership)
    ).toHaveLength(1);
    act(() => replacement.control('Body').focus());
    old.unmount();
    expect(
      fireEvent.keyDown(replacement.control('Body'), {key: 'Tab', code: 'Tab'})
    ).toBe(false);
    expect(replacement.control('Save')).toHaveFocus();
    replacement.unmount();
    expect(registeredEditors(useAppState.getState().editorOwnership)).toEqual(
      []
    );
  }
);

it('a remount cannot inherit the prior form field or registration', () => {
  const first = mountForm('entry', 'reopen');
  act(() => first.control('Body').focus());
  first.unmount();
  const next = mountForm('entry', 'reopen');
  expect(next.control('Subject')).toHaveFocus();
  expect(
    registeredEditors(useAppState.getState().editorOwnership)
  ).toHaveLength(1);
});

it('cycles the focused tag form rather than every same-kind form', () => {
  const first = mountForm('tag', 'first');
  const second = mountForm('tag', 'second');
  for (const form of [first, second, first]) {
    act(() => form.control('Name').focus());
    fireEvent.keyDown(form.control('Name'), {key: 'Tab', code: 'Tab'});
    expect(form.control('Save')).toHaveFocus();
  }
});

it('typing Enter, caret movement and Tab stay in a surviving entry', async () => {
  const user = userEvent.setup();
  const entry = mountForm('entry', 'entry');
  const tag = mountForm('tag', 'tag');
  await user.click(entry.control('Body'));
  tag.unmount();
  await user.keyboard('{End}{Enter}next{ArrowLeft}X');
  expect(entry.control('Body')).toHaveValue('body\nnexXt');
  await user.tab();
  expect(entry.control('Save')).toHaveFocus();
});

it('a background close cannot undo explicit list navigation', () => {
  const tag = mountForm('tag', 'tag');
  act(() => useAppState.getState().setAppMode(appMode.entriesList));
  tag.unmount();
  expect(useAppState.getState().appMode).toBe(appMode.entriesList);
  expect(registeredEditors(useAppState.getState().editorOwnership)).toEqual([]);
});
