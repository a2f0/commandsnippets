import {act, render, screen} from '@testing-library/react';
import {Dexie} from 'dexie';
import invariant from 'invariant';
import {useEffect} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {apiClient, UserMismatchError} from '../../../../src/lib/api/apiClient';
import {
  CommandsnippetsDatabase,
  databaseName,
} from '../../../../src/lib/db/database';
import {
  defaultSavedState,
  leaveForeignSession,
  RETIRED_STORAGE_KEYS,
  resetApplicationState,
  STORAGE_KEY,
  signOut,
  useAppConfig,
} from '../../../../src/lib/state/appState';
import {syncSession} from '../../../../src/lib/sync/session';
import {signIn, store, TEST_USER} from '../../../util/signIn';
import {tag} from '../../../util/storeFixtures';

describe('the app state', () => {
  it('saves the signed-in user and their preferences, nothing else', () => {
    act(() => {
      store.setLoggedInUser('dan');
      store.setSelectedTheme('lightTheme');
      store.setEntrySearchString('deploy');
      store.setAppMode(3);
    });
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(saved.state).toEqual({
      ...defaultSavedState,
      loggedInUser: 'dan',
      selectedTheme: 'lightTheme',
    });
  });

  it("removes the retired MobX-State-Tree snapshots, and the named user's database first", async () => {
    // What that app saved: the signed-in user and their snippets, and the
    // database its sync kept for them.
    const [current, renamed] = RETIRED_STORAGE_KEYS;
    invariant(current && renamed, 'two retired keys');
    localStorage.setItem(
      current,
      JSON.stringify({
        loggedInUser: 'olduser',
        textEntries: [{subject: 'private'}],
      })
    );
    localStorage.setItem(renamed, 'not JSON');
    const name = databaseName('test', 'olduser');
    const old = new CommandsnippetsDatabase(name);
    await old.tags.put({...tag('1', {name: 'private'}), owner: 'olduser'});
    old.close();

    vi.resetModules();
    const reloaded = await import('../../../../src/lib/state/appState');
    await reloaded.retiredSnapshotsRemoved;

    expect(await Dexie.exists(name)).toBe(false);
    for (const key of RETIRED_STORAGE_KEYS) {
      expect(localStorage.getItem(key)).toBeNull();
    }
  });

  it('goes back to its defaults on sign-out', () => {
    signIn();
    act(() => {
      store.setIsStaff(true);
      store.setEntryNew('textEntry-top');
    });
    act(() => resetApplicationState());
    expect(store.loggedInUser).toBeNull();
    expect(store.isStaff).toBe(false);
    expect(store.entryNew).toBeNull();
  });
});

// However the user leaves, their IndexedDB data goes: the menu's sign-out
// (resetApplicationState), the cookie gone (EntriesPage), another sign-in.
describe('signing out', () => {
  const hasData = async (username: string) => {
    const {db} = syncSession(username);
    await db.cursors.put({
      owner: username,
      key: 'tags',
      after: '1970-01-01T00:00:00,0',
    });
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

describe('leaving a session the API no longer answers for', () => {
  /** Another tab signed in as `username`, and saved it. */
  function savedElsewhere(username: string) {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...saved,
        state: {...saved.state, loggedInUser: username},
      })
    );
  }

  it("leaves another tab's saved sign-in as this one changes, and takes it up", async () => {
    signIn();
    savedElsewhere('someone-else');

    // This tab goes on: a search typed, a preference picked.
    act(() => {
      store.setEntrySearchString('typing');
      store.setSelectedTheme('lightTheme');
    });
    const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(saved()).toMatchObject({state: {loggedInUser: 'someone-else'}});

    await leaveForeignSession(TEST_USER);
    expect(store.loggedInUser).toBe('someone-else');
    // Its own again: this tab saves what it changes.
    act(() => store.setSelectedTheme('darkTheme'));
    expect(saved()).toMatchObject({
      state: {loggedInUser: 'someone-else', selectedTheme: 'darkTheme'},
    });
  });

  it('signs out when no other sign-in was saved', async () => {
    signIn();
    await leaveForeignSession(TEST_USER);
    expect(store.loggedInUser).toBeNull();
  });

  it("takes up another tab's, which the old session's late failures leave", async () => {
    signIn();
    savedElsewhere('someone-else');

    // Its collection sync and its tag sync both fail, one after the other.
    await Promise.all([
      leaveForeignSession(TEST_USER),
      leaveForeignSession(TEST_USER),
    ]);
    expect(store.loggedInUser).toBe('someone-else');
    act(() => store.setEntrySearchString('theirs'));
    await leaveForeignSession(TEST_USER);

    expect(store.loggedInUser).toBe('someone-else');
    expect(store.entrySearchString).toBe('theirs');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject(
      {state: {loggedInUser: 'someone-else'}}
    );
  });
});

describe('signOut', () => {
  it('signs out, whether or not the API could end the session', async () => {
    for (const logout of [
      () => Promise.resolve({}),
      () => Promise.reject(new Error('Logout failed: Bad Gateway')),
    ]) {
      signIn();
      vi.spyOn(apiClient, 'logout').mockImplementation(logout);
      vi.spyOn(console, 'error').mockImplementation(() => {});
      await signOut();
      expect(store.loggedInUser).toBeNull();
      vi.restoreAllMocks();
    }
  });

  it('leaves a sign-in this tab took up while the logout was answered', async () => {
    signIn();
    let answer = () => {};
    vi.spyOn(apiClient, 'logout').mockReturnValue(
      new Promise(resolve => {
        answer = () => resolve({});
      })
    );

    const signingOut = signOut();
    act(() => store.setLoggedInUser('someone-else'));
    answer();
    await signingOut;

    expect(store.loggedInUser).toBe('someone-else');
    vi.restoreAllMocks();
  });

  it("leaves another tab's sign-in standing when the session is theirs", async () => {
    // This tab signed in as alice; another has signed in as test since.
    act(() => store.setLoggedInUser('alice'));
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({state: {...defaultSavedState, loggedInUser: TEST_USER}})
    );
    vi.spyOn(apiClient, 'logout').mockRejectedValue(
      new UserMismatchError('Logout failed', 'alice')
    );

    await signOut();

    expect(store.loggedInUser).toBe(TEST_USER);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject(
      {state: {loggedInUser: TEST_USER}}
    );
    vi.restoreAllMocks();
  });
});

describe('useAppConfig', () => {
  it('stays one object, and renders again only for the fields read', () => {
    const renders: unknown[] = [];
    const effects: unknown[] = [];
    const Reader = () => {
      const appConfig = useAppConfig();
      renders.push(appConfig.entrySearchString);
      // As components list it: a dependency that must not change.
      useEffect(() => {
        effects.push(appConfig);
      }, [appConfig]);
      return null;
    };
    render(<Reader />);
    expect(renders).toEqual(['']);

    act(() => store.setTagSearchString('unread'));
    expect(renders).toEqual(['']);

    act(() => store.setEntrySearchString('read'));
    expect(renders).toEqual(['', 'read']);
    expect(effects).toHaveLength(1);
  });

  it('renders again for a change made before it subscribed', () => {
    // A child's mount effect runs before its parent's.
    const Child = () => {
      useEffect(() => store.setEntrySearchString('from-child'), []);
      return null;
    };
    const Parent = () => {
      const appConfig = useAppConfig();
      return (
        <div data-testid="parent">
          {appConfig.entrySearchString}
          <Child />
        </div>
      );
    };
    render(<Parent />);
    expect(screen.getByTestId('parent')).toHaveTextContent('from-child');
  });

  it('reads the current state, as later as it is read', () => {
    let config: ReturnType<typeof useAppConfig> | undefined;
    const Holder = () => {
      config = useAppConfig();
      return null;
    };
    render(<Holder />);
    act(() => store.setTagSortOrder('name'));
    expect(config?.tagSortOrder).toBe('name');
    // Not a field of the state: nothing.
    expect(
      config === undefined ? 'unset' : Reflect.get(config, 'missing')
    ).toBeUndefined();
  });
});
