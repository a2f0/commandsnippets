import {Dexie} from 'dexie';
import {applySnapshot, getSnapshot} from 'mobx-state-tree';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {defaultState} from '../../../../src/lib/shared';
import {RootModel} from '../../../../src/lib/store/models/RootModel';
import {resetApplicationState, store} from '../../../../src/lib/store/store';
import {syncSession} from '../../../../src/lib/sync/session';

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

// However the user leaves, their IndexedDB data goes: the menu's sign-out
// (resetApplicationState), the cookie gone (EntriesPage), another sign-in.
describe('signing out', () => {
  afterEach(() => {
    applySnapshot(store, defaultState);
  });

  const hasData = async (username: string) => {
    const {db} = syncSession(username);
    await db.cursors.put({key: 'tags', after: '1970-01-01T00:00:00,0'});
    return db.name;
  };
  const gone = (name: string) =>
    vi.waitFor(async () => expect(await Dexie.exists(name)).toBe(false));

  it('deletes the IndexedDB data when the username is cleared', async () => {
    store.setLoggedInUser('frank');
    const name = await hasData('frank');
    store.setLoggedInUser(null);
    await gone(name);
  });

  it('deletes it on resetApplicationState, and on another sign-in', async () => {
    store.setLoggedInUser('grace');
    const grace = await hasData('grace');
    resetApplicationState();
    await gone(grace);

    store.setLoggedInUser('heidi');
    const heidi = await hasData('heidi');
    store.setLoggedInUser('ivan');
    await gone(heidi);
  });
});

// The store reads the saved snapshot when its module loads, so each test
// loads a fresh copy of the module.
describe('the saved snapshot', () => {
  const key = 'mst-commandsnippets-test';
  const legacyKey = 'mst-tearleads-test';
  const snapshot = (loggedInUser: string) =>
    JSON.stringify({
      ...defaultState,
      loggedInUser,
      selectedTheme: 'lightTheme',
    });

  const loadStore = async () => {
    vi.resetModules();
    const module = await import('../../../../src/lib/store/store');
    return module.store;
  };

  beforeEach(() => {
    localStorage.clear();
  });

  // Restore the Storage and console spies even when a test fails.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    localStorage.clear();
  });

  it('moves a snapshot saved under the legacy key to the current key', async () => {
    localStorage.setItem(legacyKey, snapshot('dan'));

    const loaded = await loadStore();

    expect(loaded.loggedInUser).toBe('dan');
    expect(loaded.selectedTheme).toBe('lightTheme');
    expect(localStorage.getItem(key)).toBe(snapshot('dan'));
    expect(localStorage.getItem(legacyKey)).toBeNull();
  });

  it('removes the legacy copy before writing the new one', async () => {
    localStorage.setItem(legacyKey, snapshot('dan'));
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    const set = vi.spyOn(Storage.prototype, 'setItem');

    await loadStore();

    const removedAt =
      remove.mock.invocationCallOrder[
        remove.mock.calls.findIndex(([name]) => name === legacyKey)
      ];
    const writtenAt =
      set.mock.invocationCallOrder[
        set.mock.calls.findIndex(([name]) => name === key)
      ];
    expect(removedAt).toBeLessThan(writtenAt ?? 0);
  });

  it('still loads, and keeps the legacy copy, when the new key cannot be written', async () => {
    localStorage.setItem(legacyKey, snapshot('dan'));
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      name,
      value
    ) {
      if (name === key) {
        throw new DOMException('Storage is full', 'QuotaExceededError');
      }
      setItem.call(this, name, value);
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const loaded = await loadStore();

    expect(loaded.loggedInUser).toBe('dan');
    expect(localStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem(legacyKey)).toBe(snapshot('dan'));
    expect(warn).toHaveBeenCalledWith(
      'Could not move the saved state to its new key:',
      expect.any(DOMException)
    );
  });

  it('prefers the current key when both keys are set', async () => {
    localStorage.setItem(key, snapshot('current'));
    localStorage.setItem(legacyKey, snapshot('legacy'));

    const loaded = await loadStore();

    expect(loaded.loggedInUser).toBe('current');
    expect(localStorage.getItem(key)).toBe(snapshot('current'));
    expect(localStorage.getItem(legacyKey)).toBeNull();
  });

  it('starts from the default state when nothing is saved', async () => {
    const loaded = await loadStore();

    expect(getSnapshot(loaded)).toEqual(
      getSnapshot(RootModel.create(defaultState))
    );
    expect(localStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem(legacyKey)).toBeNull();
  });
});
