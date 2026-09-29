import {act, render, screen} from '@testing-library/react';
import {Dexie} from 'dexie';
import {useEffect} from 'react';
import {describe, expect, it, vi} from 'vitest';

import {
  defaultSavedState,
  RETIRED_STORAGE_KEYS,
  resetApplicationState,
  STORAGE_KEY,
  useAppConfig,
} from '../../../../src/lib/state/appState';
import {syncSession} from '../../../../src/lib/sync/session';
import {signIn, store} from '../../../util/signIn';

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

  it("removes the retired MobX-State-Tree snapshots, with the user's snippets in them", async () => {
    for (const key of RETIRED_STORAGE_KEYS) {
      localStorage.setItem(key, '{"textEntries":[{"subject":"private"}]}');
    }
    vi.resetModules();
    await import('../../../../src/lib/state/appState');
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
