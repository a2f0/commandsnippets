import {fireEvent, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {useListKeyboard} from '../../../src/hooks/useListKeyboard';
import {appMode} from '../../../src/lib/shared';
import {useAppState} from '../../../src/lib/state/appState';

const rows = [{id: 'a'}, {id: 'b'}, {id: 'c'}];

/** The list's keyboard with `selectedId` selected, and what it did. */
function renderList(selectedId: string) {
  const onSelect = vi.fn();
  const onEnter = vi.fn();
  renderHook(() =>
    useListKeyboard({
      mode: appMode.tagsList,
      rows,
      selectedId,
      onSelect,
      onEnter,
    })
  );
  return {onSelect, onEnter};
}

const press = (key: string) => fireEvent.keyDown(document, {key, code: key});

describe('useListKeyboard', () => {
  beforeEach(() => useAppState.getState().setAppMode(appMode.tagsList));

  it('moves the selection with the arrow keys, within the list', () => {
    const {onSelect} = renderList('b');
    press('ArrowUp');
    press('ArrowDown');
    expect(onSelect.mock.calls).toEqual([
      [rows[0], 0, true],
      [rows[2], 2, false],
    ]);
  });

  it('stops at either end', () => {
    const {onSelect} = renderList('a');
    press('ArrowUp');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('acts on the selected row with Enter, taking the key from the page', () => {
    const {onEnter} = renderList('c');
    expect(press('Enter')).toBe(false);
    expect(onEnter).toHaveBeenCalledWith(rows[2]);
  });

  it("leaves the keys alone outside the list's mode", () => {
    useAppState.getState().setAppMode(appMode.entriesList);
    const {onSelect, onEnter} = renderList('b');
    expect(press('Enter')).toBe(true);
    press('ArrowDown');
    expect(onEnter).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('leaves a key another listener handled first', () => {
    const {onEnter} = renderList('b');
    const handled = (event: KeyboardEvent) => event.preventDefault();
    window.addEventListener('keydown', handled, {capture: true});
    try {
      press('Enter');
    } finally {
      window.removeEventListener('keydown', handled, {capture: true});
    }
    expect(onEnter).not.toHaveBeenCalled();
  });
});
