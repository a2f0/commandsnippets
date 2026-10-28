import {ThemeProvider} from '@mui/material/styles';
import {act, fireEvent, render} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import invariant from 'invariant';
import {TextEntrySearchField} from '../../../../src/components/entries/TextEntrySearchField';
import {darkTheme} from '../../../../src/theme/themes';
import {signIn, store} from '../../../util/signIn';

beforeEach(() => signIn());

/** The search field, rendered. */
function renderField(): HTMLInputElement {
  render(
    <ThemeProvider theme={darkTheme}>
      <TextEntrySearchField />
    </ThemeProvider>
  );
  const input = document.getElementById('textEntrySearch');
  invariant(input instanceof HTMLInputElement, 'the search is rendered');
  return input;
}

describe('TextEntrySearchField', () => {
  it('keeps the caret where the user types, mid-text too', async () => {
    const user = userEvent.setup();
    const input = renderField();
    await user.type(input, 'abc');
    expect(store.entrySearchString).toBe('abc');

    await user.type(input, 'XY', {
      initialSelectionStart: 1,
      initialSelectionEnd: 1,
    });

    expect(input).toHaveValue('aXYbc');
    expect(input.selectionStart).toBe(3);
    expect(store.entrySearchString).toBe('aXYbc');
  });

  it('shows the search as the app changes it, and clears it on Escape', () => {
    const input = renderField();
    // (A tag click clears it, say.)
    act(() => store.setEntrySearchString('elsewhere'));
    expect(input).toHaveValue('elsewhere');

    fireEvent.keyDown(document, {key: 'Escape', code: 'Escape'});

    expect(input).toHaveValue('');
    expect(store.entrySearchString).toBe('');
  });
});
