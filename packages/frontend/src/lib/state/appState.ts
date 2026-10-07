/**
 * The app's state apart from the user's data (which is in IndexedDB,
 * `lib/db/`): who is signed in, their preferences, and what the UI is doing.
 * A zustand store: components read it with `useAppConfig()` (the whole state)
 * or a selector, and code outside React with `useAppState.getState()`. The
 * signed-in user and their preferences are saved to localStorage; the rest
 * starts afresh with each page.
 */

import {useCallback, useRef, useState, useSyncExternalStore} from 'react';
import {create} from 'zustand';
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from 'zustand/middleware';
import {apiClient, UserMismatchError} from '../api/apiClient';
import {setSignedInUser, setUnauthorizedHandler} from '../auth/authUtils';
import {environment} from '../environment';
import {clearMetrics} from '../metrics/timings';
import {
  activeEntryEditField,
  activeSearch,
  activeTagEditField,
  appMode,
} from '../shared';
import {subscribeRemaps} from '../sync/outbox';
import {endSyncSession} from '../sync/session';

/** What is saved to localStorage. */
export interface SavedState {
  loggedInUser: string | null;
  /** Whether the signed-in user is staff (offers the admin page). */
  isStaff: boolean;
  selectedTheme: string;
  tagSortOrder: string;
  /** The order of a tag's entries: `order` (the user's), or a sort key. */
  tagTextEntryThroughModelSortOrder: string;
  /** The order of the untagged and all entries lists. */
  entrySortOrder: string;
  showTagCounts: boolean;
}

/** The UI's state, which each page starts afresh. */
export interface UiState {
  appMode: appMode;
  activeSearch: activeSearch;
  activeEntryEditField: activeEntryEditField;
  activeTagEditField: activeTagEditField;
  /** Where a new entry's editor shows (`textEntry-top`, ...), or null. */
  entryNew: string | null;
  /** Where a new tag's editor shows, or null. */
  tagNew: string | null;
  entrySelectedID: string;
  tagSelectedID: string;
  entrySearchString: string;
  tagSearchString: string;
  mostRecentCopyType: string | null;
  mostRecentCopyID: string | null;
  clickCount: number;
}

export interface AppActions {
  setLoggedInUser(username: string | null): void;
  setIsStaff(isStaff: boolean): void;
  setSelectedTheme(theme: string): void;
  setTagSortOrder(order: string): void;
  setTagTextEntryThroughModelSortOrder(order: string): void;
  setEntrySortOrder(order: string): void;
  setShowTagCounts(value: boolean): void;
  setAppMode(value: appMode): void;
  setActiveSearch(value: activeSearch): void;
  setActiveEntryEditField(value: activeEntryEditField): void;
  setActiveTagEditField(value: activeTagEditField): void;
  setEntryNew(value: string | null): void;
  setTagNew(value: string | null): void;
  setEntrySelectedID(value: string): void;
  setTagSelectedID(value: string): void;
  setEntrySearchString(value: string): void;
  setTagSearchString(value: string): void;
  setMostRecentCopyType(value: string): void;
  setMostRecentCopyID(value: string): void;
  incrementClickCount(): void;
}

export type AppState = SavedState & UiState & AppActions;

export const defaultSavedState: SavedState = {
  loggedInUser: null,
  isStaff: false,
  selectedTheme: 'darkTheme',
  tagSortOrder: 'order',
  tagTextEntryThroughModelSortOrder: 'order',
  entrySortOrder: 'date_updated',
  showTagCounts: false,
};

export const defaultUiState: UiState = {
  appMode: appMode.tagsList,
  activeSearch: activeSearch.tags,
  activeEntryEditField: activeEntryEditField.subject,
  activeTagEditField: activeTagEditField.name,
  entryNew: null,
  tagNew: null,
  entrySelectedID: '',
  tagSelectedID: '',
  entrySearchString: '',
  tagSearchString: '',
  mostRecentCopyType: null,
  mostRecentCopyID: null,
  clickCount: 0,
};

export const STORAGE_KEY = `commandsnippets-${environment}`;

/** The user a saved state names, if it names one. */
const savedUserOf = (state: unknown): string | null =>
  typeof state === 'object' &&
  state !== null &&
  'loggedInUser' in state &&
  typeof state.loggedInUser === 'string'
    ? state.loggedInUser
    : null;

/** The user a saved state's JSON names, if it names one. */
function savedUserIn(json: string | null): string | null {
  if (json === null) {
    return null;
  }
  try {
    const saved: unknown = JSON.parse(json);
    return typeof saved === 'object' && saved !== null && 'state' in saved
      ? savedUserOf(saved.state)
      : null;
  } catch {
    return null;
  }
}

// The saved sign-in as this tab last read or wrote it (undefined: not read).
let knownUser: string | null | undefined;

/**
 * Where the state is saved: localStorage, shared by every tab, which a tab
 * writes only while the saved sign-in is the one it last read or wrote.
 * zustand saves on every change (a search typed too), so a tab whose user
 * another tab has since signed out, or in as someone else, would otherwise
 * save its user back over theirs; that tab leaves the session when the API
 * tells it (`leaveForeignSession`, which reads the saved state again). An
 * unchanged state is not written again.
 */
const guardedStorage: StateStorage = {
  getItem: name => {
    const json = localStorage.getItem(name);
    knownUser = savedUserIn(json);
    return json;
  },
  setItem: (name, json) => {
    const current = localStorage.getItem(name);
    if (
      json === current ||
      (knownUser !== undefined && savedUserIn(current) !== knownUser)
    ) {
      return;
    }
    localStorage.setItem(name, json);
    knownUser = savedUserIn(json);
  },
  removeItem: name => {
    localStorage.removeItem(name);
    knownUser = null;
  },
};

export const useAppState = create<AppState>()(
  persist(
    set => ({
      ...defaultSavedState,
      ...defaultUiState,
      setLoggedInUser: loggedInUser => set({loggedInUser}),
      setIsStaff: isStaff => set({isStaff}),
      setSelectedTheme: selectedTheme => set({selectedTheme}),
      setTagSortOrder: tagSortOrder => set({tagSortOrder}),
      setTagTextEntryThroughModelSortOrder: tagTextEntryThroughModelSortOrder =>
        set({tagTextEntryThroughModelSortOrder}),
      setEntrySortOrder: entrySortOrder => set({entrySortOrder}),
      setShowTagCounts: showTagCounts => set({showTagCounts}),
      setAppMode: appMode => set({appMode}),
      setActiveSearch: activeSearch => set({activeSearch}),
      setActiveEntryEditField: activeEntryEditField =>
        set({activeEntryEditField}),
      setActiveTagEditField: activeTagEditField => set({activeTagEditField}),
      setEntryNew: entryNew => set({entryNew}),
      setTagNew: tagNew => set({tagNew}),
      setEntrySelectedID: entrySelectedID => set({entrySelectedID}),
      setTagSelectedID: tagSelectedID => set({tagSelectedID}),
      setEntrySearchString: entrySearchString => set({entrySearchString}),
      setTagSearchString: tagSearchString => set({tagSearchString}),
      setMostRecentCopyType: mostRecentCopyType => set({mostRecentCopyType}),
      setMostRecentCopyID: mostRecentCopyID => set({mostRecentCopyID}),
      incrementClickCount: () =>
        set(state => ({clickCount: state.clickCount + 1})),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => guardedStorage),
      partialize: (state): SavedState => ({
        loggedInUser: state.loggedInUser,
        isStaff: state.isStaff,
        selectedTheme: state.selectedTheme,
        tagSortOrder: state.tagSortOrder,
        tagTextEntryThroughModelSortOrder:
          state.tagTextEntryThroughModelSortOrder,
        entrySortOrder: state.entrySortOrder,
        showTagCounts: state.showTagCounts,
      }),
    }
  )
);

const isField = (
  state: AppState,
  key: string | symbol
): key is keyof AppState => typeof key === 'string' && key in state;

/**
 * The state as one object that stays the same across renders, as a hook's
 * dependency (`[appConfig]`), and reads the current state on every access:
 * the component re-renders when a field it has read changes. (The app's
 * components were written against a MobX store that behaved so.) Where one
 * field is all a component needs, `useAppState(state => state.field)` does
 * less work.
 */
export function useAppConfig(): AppState {
  const [read] = useState(() => new Set<keyof AppState>());
  const [config] = useState(
    () =>
      // The target is only the first state: every read is of the current.
      new Proxy(useAppState.getState(), {
        get: (_, key) => {
          const state = useAppState.getState();
          if (!isField(state, key)) {
            return undefined;
          }
          read.add(key);
          return state[key];
        },
      })
  );
  // The state as of the last change to a field read, which React compares
  // after it subscribes too: a change made before then renders again.
  const seen = useRef(useAppState.getState());
  const snapshot = useCallback(() => {
    const state = useAppState.getState();
    for (const field of read) {
      if (state[field] !== seen.current[field]) {
        seen.current = state;
        break;
      }
    }
    return seen.current;
  }, [read]);
  useSyncExternalStore(useAppState.subscribe, snapshot);
  return config;
}

/**
 * Sign out of the app: every setting back to its default, which deletes the
 * user's IndexedDB data (below).
 */
export function resetApplicationState(): void {
  useAppState.setState({...defaultSavedState, ...defaultUiState});
}

/**
 * Leave `username`'s session, which the API no longer answers for (the
 * cookie is another user's): when another tab has saved that sign-in since,
 * take it up here rather than clearing it for every tab; otherwise sign out.
 * Once `username` is not signed in here (a failure of theirs came late),
 * nothing changes.
 */
export async function leaveForeignSession(username: string): Promise<void> {
  const signedIn = () => useAppState.getState().loggedInUser === username;
  if (!signedIn()) {
    return;
  }
  try {
    const saved = await useAppState.persist
      .getOptions()
      .storage?.getItem(STORAGE_KEY);
    if (!signedIn()) {
      return;
    }
    const savedUser = savedUserOf(saved?.state);
    if (savedUser !== null && savedUser !== username) {
      await useAppState.persist.rehydrate();
      // What this tab showed was the other user's: its ids mean nothing now.
      useAppState.setState(defaultUiState);
      return;
    }
  } catch (error: unknown) {
    console.error('ERROR: could not read the saved sign-in:', error);
  }
  if (signedIn()) {
    resetApplicationState();
  }
}

// The user signing out by choice without their queued writes, while they
// do: however their sign-out happens (the API's answer, or a 401 ending the
// session first), their data goes, queue and all.
let discardingFor: string | null = null;

/**
 * Sign out through the API (it ends the session), then here
 * (`resetApplicationState`) while the same user is signed in. Writes still
 * queued stay on this device for the user's next sign-in here, unless
 * `discardQueued`. When the API refuses as another user's (another tab has
 * signed in as someone else since), this tab leaves the session instead
 * (`leaveForeignSession`), and the other sign-in stands.
 */
export async function signOut({
  discardQueued = false,
}: {
  discardQueued?: boolean;
} = {}): Promise<void> {
  const username = useAppState.getState().loggedInUser;
  discardingFor = discardQueued ? username : null;
  try {
    try {
      await apiClient.logout();
    } catch (error: unknown) {
      if (error instanceof UserMismatchError && username !== null) {
        await leaveForeignSession(username);
        return;
      }
      console.error('Logout error:', error);
    }
    // Unless this tab has left that session meanwhile (another tab's sign-in
    // taken up), which stands.
    if (useAppState.getState().loggedInUser === username) {
      resetApplicationState();
    }
  } finally {
    discardingFor = null;
  }
}

let cleanedUp: Promise<void> = Promise.resolve();

/**
 * Settles once the IndexedDB data of the user who last left is deleted (or
 * kept, holding queued writes).
 */
export const signedOutDataCleanedUp = (): Promise<void> => cleanedUp;

// A user's IndexedDB data goes with them, however they leave: the menu, the
// cookie gone, a session the API ended, another sign-in. (Unless writes are
// still queued in it: those stay for the user's next sign-in here.)
useAppState.subscribe((state, previous) => {
  const {loggedInUser: leaving} = previous;
  // The HUD's timings too: interactions name the lists they opened.
  if (state.loggedInUser !== leaving) {
    clearMetrics();
  }
  if (leaving !== null && state.loggedInUser !== leaving) {
    cleanedUp = endSyncSession(leaving, {
      discardQueued: discardingFor === leaving,
    }).catch((error: unknown) => {
      console.error('ERROR: could not delete the IndexedDB data:', error);
    });
  }
});

// A row made here gets the API's id once its create reaches the API: the
// selection follows it.
subscribeRemaps(({from, to}) => {
  const {tagSelectedID, entrySelectedID, mostRecentCopyID} =
    useAppState.getState();
  useAppState.setState({
    ...(tagSelectedID === from ? {tagSelectedID: to} : {}),
    ...(entrySelectedID === from ? {entrySelectedID: to} : {}),
    ...(mostRecentCopyID === from ? {mostRecentCopyID: to} : {}),
  });
});

setSignedInUser(() => useAppState.getState().loggedInUser);
// An answer that the session is gone signs out the user it was sent as; one
// that comes after this tab has left that session (another tab's sign-in
// taken up) changes nothing.
setUnauthorizedHandler(username => {
  if (useAppState.getState().loggedInUser === username) {
    resetApplicationState();
  }
});
