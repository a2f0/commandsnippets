/**
 * The app's state apart from the user's data (which is in IndexedDB,
 * `lib/db/`): who is signed in, their preferences, and what the UI is doing.
 * A zustand store: components read it with `useAppConfig()` (the whole state)
 * or a selector, and code outside React with `useAppState.getState()`. The
 * signed-in user and their preferences are saved to localStorage; the rest
 * starts afresh with each page.
 */
import {useEffect, useReducer, useState} from 'react';
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {setUnauthorizedHandler} from '../auth/authUtils';
import {environment} from '../environment';
import {
  activeEntryEditField,
  activeSearch,
  activeTagEditField,
  appMode,
} from '../shared';
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

/**
 * Where the MobX-State-Tree store saved its snapshot (with the user's whole
 * collection in it), under the current name and the one from before the
 * rename to Commandsnippets. Nothing reads them: they are removed on load,
 * so no user's snippets stay behind in them. The preferences in them are
 * not carried over, by choice: the app is greenfield, with no migrations
 * from its earlier state (a user signs in again, and picks them again).
 */
export const RETIRED_STORAGE_KEYS = [
  `mst-commandsnippets-${environment}`,
  `mst-tearleads-${environment}`,
];
for (const key of RETIRED_STORAGE_KEYS) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage unavailable: nothing was saved there either.
  }
}

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
      storage: createJSONStorage(() => localStorage),
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
  const [, render] = useReducer((count: number) => count + 1, 0);
  useEffect(
    () =>
      useAppState.subscribe((state, previous) => {
        for (const field of read) {
          if (state[field] !== previous[field]) {
            render();
            return;
          }
        }
      }),
    [read]
  );
  return config;
}

/**
 * Sign out of the app: every setting back to its default, which deletes the
 * user's IndexedDB data (below).
 */
export function resetApplicationState(): void {
  useAppState.setState({...defaultSavedState, ...defaultUiState});
}

// A user's IndexedDB data goes with them, however they leave: the menu, the
// cookie gone, a session the API ended, another sign-in.
useAppState.subscribe((state, previous) => {
  const {loggedInUser: leaving} = previous;
  if (leaving !== null && state.loggedInUser !== leaving) {
    endSyncSession(leaving).catch((error: unknown) => {
      console.error('ERROR: could not delete the IndexedDB data:', error);
    });
  }
});

setUnauthorizedHandler(resetApplicationState);
