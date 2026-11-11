import {ThemeProvider} from '@mui/material/styles';
import {
  act,
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import {useState} from 'react';
import {I18nextProvider} from 'react-i18next';
import {vi} from 'vitest';
import {TagContextMenu} from '../../../../src/components/tags/TagContextMenu';
import {i18n} from '../../../../src/i18n/i18n';
import {initialMouse} from '../../../../src/lib/shared';
import {darkTheme} from '../../../../src/theme/themes';
import {signIn} from '../../../util/signIn';

beforeEach(() => signIn());

/** A tag row as far as its menu sees it: it opens the menu, and closes it. */
const Row = ({deleteTag}: {deleteTag: () => void}) => {
  const [mouse, setMouse] = useState(initialMouse);
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={darkTheme}>
        <button
          type="button"
          onClick={() => setMouse({mouseX: 10, mouseY: 10})}
        >
          open
        </button>
        <TagContextMenu
          id="1"
          isPublic={false}
          mouse={mouse}
          onClose={() => setMouse(initialMouse)}
          deleteTagParent={deleteTag}
          handleBeginEditParent={() => {}}
        />
      </ThemeProvider>
    </I18nextProvider>
  );
};

describe('TagContextMenu', () => {
  beforeEach(() => vi.spyOn(console, 'error'));

  it("deletes with the row's latest handler, not the one it mounted with", async () => {
    const first = vi.fn();
    const latest = vi.fn();
    const {rerender} = render(<Row deleteTag={first} />);
    // The menu lives as long as the row, whose handler changes with what
    // it deletes through (its session).
    rerender(<Row deleteTag={latest} />);

    fireEvent.click(screen.getByRole('button', {name: 'open'}));
    const deleteItem = await screen.findByRole('menuitem', {
      name: 'Delete Tag',
    });
    await act(async () => {
      fireEvent.click(deleteItem);
    });
    fireEvent.click(await screen.findByRole('button', {name: 'Delete'}));

    expect(latest).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('closes the delete dialog on Escape without deleting', async () => {
    const deleteTag = vi.fn();
    render(<Row deleteTag={deleteTag} />);

    fireEvent.click(screen.getByRole('button', {name: 'open'}));
    const deleteItem = await screen.findByRole('menuitem', {
      name: 'Delete Tag',
    });
    await act(async () => {
      fireEvent.click(deleteItem);
    });
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, {key: 'Escape'});

    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
    expect(deleteTag).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});
