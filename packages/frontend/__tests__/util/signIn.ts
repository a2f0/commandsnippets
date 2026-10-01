import {Dexie} from 'dexie';
/**
 * The app's state for a test: signed in as the mock API's user, or back to
 * the defaults (signed out, which deletes the user's IndexedDB data).
 * `__tests__/setup.ts` resets after every test.
 */
import {
  type AppState,
  defaultSavedState,
  defaultUiState,
  STORAGE_KEY,
  signedOutDataCleanedUp,
  useAppState,
} from '../../src/lib/state/appState';
import {endSyncSession} from '../../src/lib/sync/session';

/** The mock API's user (src/msw/handlers.ts). */
export const TEST_USER = 'test';

/** Sign in as the mock API's user. */
export function signIn(): void {
  useAppState.setState({loggedInUser: TEST_USER});
}

/**
 * Every setting back to its default, nothing saved (as a test may have
 * saved another tab's sign-in), and the user's IndexedDB data gone.
 */
export async function resetApp(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);
  await useAppState.persist.rehydrate();
  useAppState.setState({...defaultSavedState, ...defaultUiState});
  await signedOutDataCleanedUp();
  await endSyncSession(TEST_USER, {discardQueued: true});
  // Signing out keeps a database with queued writes: none outlives a test.
  const names = await Dexie.getDatabaseNames();
  await Promise.all(
    names
      .filter(name => name.startsWith('commandsnippets-'))
      .map(name => Dexie.delete(name))
  );
}

const isField = (
  state: AppState,
  key: string | symbol
): key is keyof AppState => typeof key === 'string' && key in state;

/**
 * The app's state as it is at each read (fields and actions), as components
 * use it: `store.setIsStaff(true)`, `store.isStaff`.
 */
export const store: AppState = new Proxy(useAppState.getState(), {
  get: (_, key) => {
    const state = useAppState.getState();
    return isField(state, key) ? state[key] : undefined;
  },
});
