import type {IDisposer, Instance} from 'mobx-state-tree';
import {applySnapshot, destroy, onSnapshot} from 'mobx-state-tree';

import {RootModel} from './models/RootModel';
import {environment} from '../environment';
import {type appState, defaultState} from '../shared';

export const defaultStateStringified: string = JSON.stringify(defaultState);

const localStorageKey = `mst-tearleads-${environment}`;
const localStorateState = localStorage.getItem(localStorageKey);
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
  } catch (e) {
    applySnapshot(store, defaultState);
  }

  // connect local storage
  snapshotListener = onSnapshot(store, snapshot => {
    localStorage.setItem(localStorageKey, JSON.stringify(snapshot));
  });
  return store;
}

let store: ReturnType<typeof createAppStateStore>;
state = mergeInDefaultState(state);
store = createAppStateStore(state);

export type Store = ReturnType<typeof createAppStateStore>;
export {store};
