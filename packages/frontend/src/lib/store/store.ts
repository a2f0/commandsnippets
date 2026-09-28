import type {IDisposer, Instance} from 'mobx-state-tree';
import {applySnapshot, destroy, onSnapshot} from 'mobx-state-tree';
import {setUnauthorizedHandler} from '../auth/authUtils';
import {environment} from '../environment';
import {type appState, defaultState} from '../shared';
import {RootModel} from './models/RootModel';

const localStorageKey = `mst-commandsnippets-${environment}`;

// Before the app was renamed Commandsnippets (September 2026) it saved its
// state under this key. readSavedState moves a snapshot from it once, so users
// who last opened the app before the rename stay signed in with their
// settings. Drop the legacy read, and its tests in store.spec.ts, a few months
// after the rename ships (early 2027), once returning users have loaded the
// app since.
const legacyLocalStorageKey = `mst-tearleads-${environment}`;

/**
 * The saved snapshot's JSON, or null. The current key wins; a snapshot only
 * under the legacy key is copied to the current key, and the legacy key is
 * removed either way.
 */
function readSavedState(): string | null {
  const saved = localStorage.getItem(localStorageKey);
  const legacy = localStorage.getItem(legacyLocalStorageKey);
  if (saved === null && legacy !== null) {
    localStorage.setItem(localStorageKey, legacy);
  }
  if (legacy !== null) {
    localStorage.removeItem(legacyLocalStorageKey);
  }
  return saved ?? legacy;
}

const localStorateState = readSavedState();
let state: appState;
if (localStorateState !== null) {
  state = JSON.parse(localStorateState);
} else {
  state = defaultState;
}

let snapshotListener: IDisposer;

// Merge in the default state to incorporate any new configuraiton options
function mergeInDefaultState(state: appState) {
  const newState: appState = {
    ...defaultState,
    ...state,
  };
  return newState;
}

export function createAppStateStore(
  snapshot: appState
): Instance<typeof RootModel> {
  // clean up snapshot listener
  if (snapshotListener) snapshotListener();
  // kill old store to prevent accidental use and run clean up hooks
  if (store) destroy(store);

  // create new one
  store = RootModel.create(defaultState);

  // It is possible that the model structure changes which would break the ability
  // to restore a snapshot.  If a snapshot restore fails, apply the default state.
  try {
    applySnapshot(store, snapshot);
  } catch {
    applySnapshot(store, defaultState);
  }

  // connect local storage
  snapshotListener = onSnapshot(store, snapshot => {
    localStorage.setItem(localStorageKey, JSON.stringify(snapshot));
  });
  return store;
}

/** Sign out of the app: put every stored setting back to its default. */
export function resetApplicationState() {
  applySnapshot(store, defaultState);
}

let store: ReturnType<typeof createAppStateStore>;
state = mergeInDefaultState(state);
store = createAppStateStore(state);
setUnauthorizedHandler(resetApplicationState);

export type Store = ReturnType<typeof createAppStateStore>;
export {store};
