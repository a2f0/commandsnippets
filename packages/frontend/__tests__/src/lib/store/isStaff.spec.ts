import {applySnapshot} from 'mobx-state-tree';
import {afterEach, describe, expect, it} from 'vitest';

import {defaultState} from '../../../../src/lib/shared';
import {store} from '../../../../src/lib/store/store';

// The store is saved to localStorage, and a snapshot that fails to load is
// replaced with the default state, which logs the user out. Snapshots saved
// before isStaff existed must still load.
describe('isStaff', () => {
  afterEach(() => {
    applySnapshot(store, defaultState);
  });

  it('defaults to false and loads snapshots saved before it existed', () => {
    const {isStaff, ...saved} = defaultState;
    expect(isStaff).toBe(false);

    applySnapshot(store, {...saved, loggedInUser: 'dan'});

    expect(store.loggedInUser).toBe('dan');
    expect(store.isStaff).toBe(false);
  });
});
