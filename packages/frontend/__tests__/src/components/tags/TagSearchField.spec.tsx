import {ThemeProvider} from '@mui/material/styles';
import {act, fireEvent, render} from '@testing-library/react';
import invariant from 'invariant';
import {TagSearchField} from '../../../../src/components/tags/TagSearchField';
import {appMode} from '../../../../src/lib/shared';
import {darkTheme} from '../../../../src/theme/themes';
import {signIn, store} from '../../../util/signIn';

beforeEach(() => signIn());

const renderField = () =>
  render(
    <ThemeProvider theme={darkTheme}>
      <TagSearchField />
    </ThemeProvider>
  );

const pressEscape = () =>
  fireEvent.keyDown(document, {key: 'Escape', code: 'Escape'});

describe('TagSearchField', () => {
  it('clears the tag search on Escape, back in the tag list', () => {
    renderField();
    const input = document.getElementById('tagSearch');
    invariant(input, 'the tag search is rendered');
    fireEvent.change(input, {target: {value: 'abc'}});
    expect(store.tagSearchString).toBe('abc');
    act(() => store.setAppMode(appMode.entriesList));

    pressEscape();

    expect(input).toHaveValue('');
    expect(store.tagSearchString).toBe('');
    expect(store.appMode).toBe(appMode.tagsList);
  });

  it('leaves Escape alone once it is gone (another page)', () => {
    renderField().unmount();
    renderField().unmount();
    act(() => {
      store.setAppMode(appMode.entryEditor);
      store.setTagSearchString('abc');
    });

    pressEscape();

    expect(store.appMode).toBe(appMode.entryEditor);
    expect(store.tagSearchString).toBe('abc');
  });
});
